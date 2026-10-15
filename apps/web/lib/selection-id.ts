/**
 * 标准化 label：SportMonks API 对 asian_handicap 可能返回 "1"/"2" 而非 "Home"/"Away"
 */
function normalizeLabel(label: string, marketId: number): string {
  if (marketId === 6) {
    if (label === "1") return "Home";
    if (label === "2") return "Away";
  }
  return label;
}

/**
 * 标准化 lineValue：去掉尾零，避免 "-0.50" vs "-0.5" 不匹配
 */
function normalizeLineValue(val: string): string {
  const n = parseFloat(val);
  return isNaN(n) ? val : String(n);
}

/**
 * 构造 BetSelection 唯一 ID — 全站唯一入口
 *
 * 格式：
 *   1X2 (market_id=1): "${fixtureId}-1-${label}"
 *   让球 (market_id=6): "${fixtureId}-6-${label}-${lineValue}"
 *   大小 (market_id=7): "${fixtureId}-7-${label}-${lineValue}"
 *
 * 内部自动归一化 label 和 lineValue，调用方无需处理。
 */
export function makeSelectionId(
  fixtureId: number,
  marketId: number,
  label: string,
  lineValue?: string | null
): string {
  const normalized = normalizeLabel(label, marketId);
  if (lineValue != null && lineValue !== "") {
    return `${fixtureId}-${marketId}-${normalized}-${normalizeLineValue(lineValue)}`;
  }
  return `${fixtureId}-${marketId}-${normalized}`;
}
