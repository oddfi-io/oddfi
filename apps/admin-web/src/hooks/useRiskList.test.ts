// useRiskList 纯函数层：Tab ↔ filters 双向映射（组件态由联调 A / 页面 smoke 覆盖）。
import { describe, it, expect } from "vitest";
import type { CrudFilter } from "@refinedev/core";
import { tabToFilters, deriveTab, deriveLeague, defaultTimeOrder, type RiskTab } from "./useRiskList";

describe("tabToFilters", () => {
  it("all → 空 filters", () => {
    expect(tabToFilters("all")).toEqual([]);
  });

  it.each<["active" | "pending" | "settled"]>([["active"], ["pending"], ["settled"]])(
    "%s → status eq",
    (tab) => {
      expect(tabToFilters(tab)).toEqual([{ field: "status", operator: "eq", value: tab }]);
    },
  );

  it("red → signal=[red]", () => {
    expect(tabToFilters("red")).toEqual([
      { field: "signal", operator: "in", value: ["red"] },
    ]);
  });

  it("orange → signal=[orange,red]（橙含红，原型包含语义）", () => {
    expect(tabToFilters("orange")).toEqual([
      { field: "signal", operator: "in", value: ["orange", "red"] },
    ]);
  });
});

describe("deriveTab", () => {
  it("空 filters → all", () => {
    expect(deriveTab([])).toBe("all");
  });

  it.each<[RiskTab]>([["all"], ["active"], ["pending"], ["settled"], ["red"], ["orange"]])(
    "roundtrip：tabToFilters(%s) → deriveTab 还原",
    (tab) => {
      expect(deriveTab(tabToFilters(tab))).toBe(tab);
    },
  );

  it("signal 单字符串值（URL 手输）也能识别", () => {
    const filters: CrudFilter[] = [{ field: "signal", operator: "eq", value: "red" }];
    expect(deriveTab(filters)).toBe("red");
  });

  it("未知 status 值 → 兜底 all", () => {
    const filters: CrudFilter[] = [{ field: "status", operator: "eq", value: "weird" }];
    expect(deriveTab(filters)).toBe("all");
  });

  it("value=undefined 的移除语义残留 filter → 跳过（联调 A merge 模式回归）", () => {
    const filters: CrudFilter[] = [
      { field: "signal", operator: "in", value: undefined },
      { field: "status", operator: "eq", value: "active" },
    ];
    expect(deriveTab(filters)).toBe("active");
  });
});

// DD004 #2（走查 6/8）：从 filters 还原 league 选中值（URL 直入/reload 还原）。
describe("deriveLeague", () => {
  it("无 league filter → undefined", () => {
    expect(deriveLeague([])).toBeUndefined();
    expect(deriveLeague([{ field: "status", operator: "eq", value: "active" }])).toBeUndefined();
  });
  it("有 league filter → 取值", () => {
    expect(
      deriveLeague([{ field: "league", operator: "eq", value: "世界杯" }]),
    ).toBe("世界杯");
  });
  it("league value=undefined（移除语义残留）→ undefined", () => {
    expect(
      deriveLeague([{ field: "league", operator: "eq", value: undefined }]),
    ).toBeUndefined();
  });
});

// DD003 W1b（走查 6/5）：「按时间」的 Tab 语境默认方向。
// 待开始/进行中=asc（距今最近的未来赛事先）；已结算=desc（最近结算的先）；
// 全部/红/橙=desc（混合状态 asc 会把最久远的已结算顶首屏，保守取 desc，精确版等 OPS-01 proximity）。
describe("defaultTimeOrder", () => {
  it.each<[RiskTab, "asc" | "desc"]>([
    ["pending", "asc"],
    ["active", "asc"],
    ["settled", "desc"],
    ["all", "desc"],
    ["red", "desc"],
    ["orange", "desc"],
  ])("%s → %s", (tab, expected) => {
    expect(defaultTimeOrder(tab)).toBe(expected);
  });
});

// ENH-008：include 开关 ↔ filters 映射（单一真值源在 filters/URL）。
import { deriveIncludeFlag } from "./useRiskList";

describe("deriveIncludeFlag", () => {
  it("空 filters → false（默认过滤后宇宙）", () => {
    expect(deriveIncludeFlag([], "include_test")).toBe(false);
  });

  it('value "true" → true', () => {
    const filters: CrudFilter[] = [{ field: "include_test", operator: "eq", value: "true" }];
    expect(deriveIncludeFlag(filters, "include_test")).toBe(true);
    expect(deriveIncludeFlag(filters, "include_archived")).toBe(false);
  });

  it("merge 移除残留（value undefined/空串）→ false", () => {
    expect(
      deriveIncludeFlag([{ field: "include_test", operator: "eq", value: undefined }], "include_test"),
    ).toBe(false);
    expect(
      deriveIncludeFlag([{ field: "include_archived", operator: "eq", value: "" }], "include_archived"),
    ).toBe(false);
  });

  it('防御："false" 字面量（违反契约的脏 URL）→ false 而非 true', () => {
    expect(
      deriveIncludeFlag([{ field: "include_test", operator: "eq", value: "false" }], "include_test"),
    ).toBe(false);
  });
});
