/**
 * DD-118: marketId 规范化 + 校验。
 *
 * 后端 oddfi-data-ws `normalizeMarketID()` 要求：
 *   - lowercase
 *   - 0x 前缀
 *   - 长度 66（0x + 64 hex）
 * 非法的 marketId 后端 silently 丢弃，前端必须 fail-fast 抛错。
 */

export class InvalidMarketIdError extends Error {
  constructor(raw: string, reason: string) {
    super(`[InvalidMarketId] ${reason}: ${JSON.stringify(raw)}`);
    this.name = "InvalidMarketIdError";
  }
}

const HEX64_RE = /^0x[0-9a-f]{64}$/;

/**
 * 规范化 marketId 为后端要求的 lowercase 0x-prefix 66-char 形式。
 * 任何不符合规则的输入抛 InvalidMarketIdError —— 不静默修正。
 */
export function normalizeMarketId(raw: string | null | undefined): string {
  if (typeof raw !== "string" || raw.length === 0) {
    throw new InvalidMarketIdError(String(raw), "must be non-empty string");
  }
  const trimmed = raw.trim();
  if (!trimmed.startsWith("0x") && !trimmed.startsWith("0X")) {
    throw new InvalidMarketIdError(raw, "must start with 0x");
  }
  const lower = trimmed.toLowerCase();
  if (lower.length !== 66) {
    throw new InvalidMarketIdError(raw, `must be 66 chars (got ${lower.length})`);
  }
  if (!HEX64_RE.test(lower)) {
    throw new InvalidMarketIdError(raw, "must be 0x + 64 hex chars");
  }
  return lower;
}

/** 不抛错的 boolean 版本，便于 UI 层条件判断。 */
export function isValidMarketId(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  try {
    normalizeMarketId(raw);
    return true;
  } catch {
    return false;
  }
}
