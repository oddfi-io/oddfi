// useRiskList — 赛事风险列表查询状态收敛（DD002 T07）。
// 职责：useTable(events) + 筛选 Tab ↔ CrudFilter 双向映射 + 排序映射 + 最大敞口定位高亮。
// 30s 轮询沿用 audit/list.tsx 同款 refetchInterval；筛选经 syncWithLocation 进 URL 可分享。
import { useCallback, useEffect, useRef, useState } from "react";
import { useTable } from "@refinedev/antd";
import type { CrudFilter } from "@refinedev/core";
import type { RiskEvent } from "@/types/events";

// 筛选 Tab：全部 / 进行中 / 待开始 / 已结算 / 红灯 / 橙灯。
// 橙 Tab 含红（原型 :4455 包含语义）→ signal=orange,red；包含关系由前端组装，契约层是纯并集。
export type RiskTab = "all" | "active" | "pending" | "settled" | "red" | "orange";

// 排序字段（契约 sort_by 枚举）；default = 不传排序参数。
export type RiskSortField = "default" | "bet" | "exposure" | "time";

// 「按时间」的 Tab 语境默认方向（DD003 W1b 走查 6/5）：
// 待开始/进行中 → asc（距今最近的未来赛事先）；已结算 → desc（最近结算的先）；
// 全部/红/橙 → desc（混合状态下 asc 会把最久远的已结算顶首屏，保守取 desc；
// 精确「距今最近」需上游 time_proximity 排序，见 DD003 OPS-01）。
// 仅在用户显式选中「按时间」时作为初始方向（setSort 省参调用），切 Tab 不隐式重置
// （syncWithLocation 下 sorters 是 URL 派生态，隐式重置会与分享链接还原打架）。
export function defaultTimeOrder(tab: RiskTab): "asc" | "desc" {
  return tab === "pending" || tab === "active" ? "asc" : "desc";
}

// Tab → 服务端 filters。signal 多值 = 数组，dataProvider join(",") 成单 key。
export function tabToFilters(tab: RiskTab): CrudFilter[] {
  switch (tab) {
    case "active":
    case "pending":
    case "settled":
      return [{ field: "status", operator: "eq", value: tab }];
    case "red":
      return [{ field: "signal", operator: "in", value: ["red"] }];
    case "orange":
      return [{ field: "signal", operator: "in", value: ["orange", "red"] }];
    default:
      return [];
  }
}

// filters → Tab（reload / URL 直入时还原选中态）。value 为空的 filter（merge 移除语义残留）跳过。
export function deriveTab(filters: CrudFilter[]): RiskTab {
  for (const f of filters) {
    if (!("field" in f)) continue;
    if (f.value == null) continue;
    if (f.field === "signal") {
      const values = Array.isArray(f.value) ? f.value.map(String) : [String(f.value)];
      return values.includes("orange") ? "orange" : "red";
    }
    if (f.field === "status") {
      const v = String(f.value);
      if (v === "active" || v === "pending" || v === "settled") return v;
    }
  }
  return "all";
}

// filters → include 开关态（ENH-008）。开关经 filters 进 URL（可分享）与 getList query，
// 单一真值源；契约：false = 移除 filter（省略不传），true = "true"，禁止 "false" 字面量。
export function deriveIncludeFlag(filters: CrudFilter[], field: string): boolean {
  for (const f of filters) {
    if (!("field" in f)) continue;
    if (f.field === field && f.value != null && f.value !== "") {
      return String(f.value) === "true";
    }
  }
  return false;
}

// filters → 选中的 league（reload / URL 直入还原）。value 为空（merge 移除残留）跳过。
export function deriveLeague(filters: CrudFilter[]): string | undefined {
  for (const f of filters) {
    if (!("field" in f)) continue;
    if (f.field === "league" && f.value != null && f.value !== "") {
      return String(f.value);
    }
  }
  return undefined;
}

export function useRiskList() {
  const table = useTable<RiskEvent>({
    resource: "events",
    syncWithLocation: true,
    // 默认 20/页（refine-conventions.md；Refine 默认 10，联调 A 实测纠偏）
    pagination: { pageSize: 20 },
    // DD004 #1（走查 6/8）：进页默认按开赛时间升序＝距今最近在前。
    // 仅 URL 无 sorters 时生效（syncWithLocation 优先 URL，分享链接不失真）。
    // 后端 sort_by=time 是真实升序（web-api admin_events.go），非近似。
    sorters: { initial: [{ field: "time", order: "asc" }] },
    queryOptions: { refetchInterval: 30000 },
  });
  const { filters, setFilters, sorters, setSorters } = table;

  const tab = deriveTab(filters);
  // Tab 切换用 merge + undefined 移除语义：联调 A 实测 setFilters([], "replace") 清不掉
  // 既有筛选（落 all 失效）——按 Refine 文档「value=undefined 即移除该字段」逐字段覆盖。
  // 版本锚点：@refinedev/core@5 / @refinedev/antd@6（升级 Refine 时跑 useRiskList.test 回归此语义）。
  const applyTab = useCallback(
    (next: RiskTab) => {
      const wanted = tabToFilters(next);
      const signal = wanted.find((f) => "field" in f && f.field === "signal");
      const status = wanted.find((f) => "field" in f && f.field === "status");
      setFilters([
        { field: "signal", operator: "in", value: signal?.value },
        { field: "status", operator: "eq", value: status?.value },
      ]);
    },
    [setFilters],
  );
  const selectTab = applyTab;

  // league 筛选（DD004 #2）：独立于 tab 的 filter；setFilters 默认 merge，
  // 切 tab（只动 signal/status）不会清掉 league，反之亦然。空值＝移除该 filter。
  const league = deriveLeague(filters);
  const setLeague = useCallback(
    (next: string | undefined) => {
      setFilters([{ field: "league", operator: "eq", value: next || undefined }]);
    },
    [setFilters],
  );

  // include_test / include_archived（ENH-008）：与 tab/league 同走 merge + undefined 移除语义。
  // 注意 summary 卡片必须用同一组开关值请求（list.tsx 从本 hook 取值喂 useCustom），否则口径分裂。
  const includeTest = deriveIncludeFlag(filters, "include_test");
  const includeArchived = deriveIncludeFlag(filters, "include_archived");
  const setIncludeTest = useCallback(
    (v: boolean) => {
      setFilters([{ field: "include_test", operator: "eq", value: v ? "true" : undefined }]);
    },
    [setFilters],
  );
  const setIncludeArchived = useCallback(
    (v: boolean) => {
      setFilters([{ field: "include_archived", operator: "eq", value: v ? "true" : undefined }]);
    },
    [setFilters],
  );

  // 排序：单列，default = 清空（后端按默认序返回）。
  // order 省略 = 用户显式切换排序字段 → time 取 Tab 语境默认方向（DD003 W1b），
  // 其余字段沿用 desc；显式传 order（↑/↓ 按钮）始终优先。
  const sortField = (sorters[0]?.field as RiskSortField | undefined) ?? "default";
  const sortOrder = sorters[0]?.order ?? "desc";
  const setSort = useCallback(
    (field: RiskSortField, order?: "asc" | "desc") => {
      if (field === "default") setSorters([]);
      else setSorters([{ field, order: order ?? (field === "time" ? defaultTimeOrder(tab) : "desc") }]);
    },
    [setSorters, tab],
  );

  // 最大敞口卡点击 → 清筛选回 all + 高亮目标行并滚动定位（原型 jumpToMaxRisk :1080）。
  // 目标行不在当前页时仅清筛选（mock/真实首屏 50 条内基本可见，不做跨页寻址）。
  const [highlightId, setHighlightId] = useState<string | null>(null);
  // 每次 jump 只滚动一次（M-Code-3）：dataSource 留在 deps 里是为了等清筛选后的数据渲染出目标行，
  // 但 30s 轮询也会换 dataSource 引用 —— 用 ref 防止高亮窗口内被轮询触发二次滚动。
  const scrolledRef = useRef(false);
  const jumpToEvent = useCallback(
    (eventId: string) => {
      applyTab("all");
      // 跨类目标：目标事件可能不属当前 league 筛选 → 必须一并清 league，
      // 否则目标行被 league filter 挡掉、高亮/滚动静默失败（review B-Major-1）。
      setLeague(undefined);
      scrolledRef.current = false;
      setHighlightId(eventId);
    },
    [applyTab, setLeague],
  );

  const dataSource = table.tableProps.dataSource;
  useEffect(() => {
    if (!highlightId) return;
    if (!scrolledRef.current) {
      const el = document.querySelector(`tr[data-row-key="${CSS.escape(highlightId)}"]`);
      if (el) {
        scrolledRef.current = true;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
    const timer = setTimeout(() => setHighlightId(null), 5000);
    return () => clearTimeout(timer);
  }, [highlightId, dataSource]);

  return {
    ...table,
    tab,
    selectTab,
    league,
    setLeague,
    sortField,
    sortOrder,
    setSort,
    highlightId,
    jumpToEvent,
    includeTest,
    setIncludeTest,
    includeArchived,
    setIncludeArchived,
  };
}
