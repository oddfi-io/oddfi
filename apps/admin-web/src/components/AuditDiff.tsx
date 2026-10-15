// AuditDiff — before/after 对比渲染组件。
// 契约：docs/spa-presale-admin/04-components.md §4。
// 规则：design-tokens.md（走 token，禁硬编码颜色）、code-quality.md（禁 dangerouslySetInnerHTML）。
import { theme, Descriptions, Tag, Typography } from "antd";

export interface AuditDiffProps {
  /** beforeJson 字段：JSON 字符串、对象或 null。*/
  before: Record<string, unknown> | string | null;
  /** afterJson 字段：JSON 字符串、对象或 null。*/
  after: Record<string, unknown> | string | null;
}

// ── 工具函数 ──────────────────────────────────────────────────────────────────

/** 把入参归一化成 Record<string, unknown> | null。string 入参尝试 JSON.parse；失败退化到原样字符串展示。*/
function normalise(
  raw: Record<string, unknown> | string | null,
): Record<string, unknown> | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "object") return raw as Record<string, unknown>;
  // string 分支
  try {
    const parsed = JSON.parse(raw);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    // JSON 合法但顶层不是对象（数组/基本类型）→ 包成 {value} 展示
    return { value: parsed };
  } catch {
    console.warn("[AuditDiff] malformed audit json — treating as raw string", raw);
    return { value: raw };
  }
}

/** 把任意值序列化成可读字符串，用于单元格展示。*/
function display(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v || "—";
  return JSON.stringify(v, null, 2);
}

// ── 主组件 ────────────────────────────────────────────────────────────────────

export function AuditDiff({ before, after }: AuditDiffProps): React.ReactElement {
  const { token } = theme.useToken();

  const beforeObj = normalise(before);
  const afterObj = normalise(after);

  // 两边都为 null → 无变更
  if (beforeObj === null && afterObj === null) {
    return (
      <Typography.Text type="secondary" style={{ padding: "8px 0", display: "block" }}>
        无变更
      </Typography.Text>
    );
  }

  // 并集 keys，保持稳定顺序（before keys 在前，after 新增 keys 追加）
  const beforeKeys = Object.keys(beforeObj ?? {});
  const afterKeys = Object.keys(afterObj ?? {});
  const allKeys = [...new Set([...beforeKeys, ...afterKeys])];

  const items = allKeys.map((key) => {
    const bVal = beforeObj?.[key];
    const aVal = afterObj?.[key];

    const bStr = display(bVal);
    const aStr = display(aVal);
    const changed = bStr !== aStr;

    const isAdded = beforeObj === null || !(key in (beforeObj ?? {}));
    const isRemoved = afterObj === null || !(key in (afterObj ?? {}));

    // 渲染单个值单元格（React 节点，严禁 dangerouslySetInnerHTML）
    const renderVal = (val: unknown, highlight: string | null) => {
      const str = display(val);
      const bgStyle: React.CSSProperties = highlight
        ? { background: highlight, padding: "2px 6px", borderRadius: token.borderRadiusXS }
        : { padding: "2px 6px" };
      return (
        <Typography.Text code style={bgStyle}>
          {str}
        </Typography.Text>
      );
    };

    let beforeCell: React.ReactNode;
    let afterCell: React.ReactNode;

    if (isAdded) {
      // 新增字段：before 侧空，after 侧绿底
      beforeCell = <Typography.Text type="secondary">—</Typography.Text>;
      afterCell = renderVal(aVal, token.colorSuccessBg);
    } else if (isRemoved) {
      // 删除字段：before 侧红底，after 侧空
      beforeCell = renderVal(bVal, token.colorErrorBg);
      afterCell = <Typography.Text type="secondary">—</Typography.Text>;
    } else if (changed) {
      // 变更字段：两侧都高亮
      beforeCell = renderVal(bVal, token.colorErrorBg);
      afterCell = renderVal(aVal, token.colorSuccessBg);
    } else {
      // 无变化：原样展示
      beforeCell = renderVal(bVal, null);
      afterCell = renderVal(aVal, null);
    }

    return {
      key,
      label: (
        <Typography.Text style={{ fontFamily: token.fontFamilyCode, fontSize: token.fontSizeSM }}>
          {key}
          {changed && (
            <Tag color="warning" style={{ marginLeft: 6, fontSize: 11, lineHeight: "18px" }}>
              变更
            </Tag>
          )}
        </Typography.Text>
      ),
      children: (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
          <span style={{ minWidth: 0, flex: 1 }}>{beforeCell}</span>
          {/* arrow → */}
          <Typography.Text type="secondary" style={{ flexShrink: 0, lineHeight: "24px" }}>
            →
          </Typography.Text>
          <span style={{ minWidth: 0, flex: 1 }}>{afterCell}</span>
        </div>
      ),
    };
  });

  return (
    <div style={{ padding: "8px 0" }}>
      <Descriptions
        column={1}
        size="small"
        bordered
        items={items}
        styles={{
          label: {
            width: 180,
            verticalAlign: "top",
            background: token.colorBgLayout,
            fontSize: token.fontSizeSM,
          },
          content: { verticalAlign: "top" },
        }}
      />
    </div>
  );
}
