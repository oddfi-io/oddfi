/**
 * DD-136 W3：AI 分析正文末尾「oddfi-picks」机器协议块的解析与流式隐藏。
 *
 * 协议（由 system-prompt Layer 3 约定，LLM 在正文末尾输出）：
 *   ```oddfi-picks
 *   {"picks":[{"market":"1x2","side":"Home","confidence":"high","reason":"…"}]}
 *   ```
 *
 * 设计原则：
 *   - 解析失败绝不阻塞正文展示 —— 坏块也要从展示文本中剥离，picks 返回 null 由上层兜底
 *   - 校验宽松进、严格出：未知字段忽略；market/side/confidence 非法的条目整条丢弃
 *   - 每个玩法至多一条（首条生效），总数上限 3
 */
import type { AnalysisPick, PickConfidence, PickMarket } from "@/lib/betting/recommend-selection";

const FENCE_OPEN = "```oddfi-picks";
const FENCE_CLOSE = "```";
/** reason 展示上限（LLM 约定 ≤20 字，超长截断防御） */
const REASON_MAX_LEN = 40;

const VALID_MARKETS: ReadonlySet<string> = new Set(["1x2", "asian_handicap", "asian_total"]);
const VALID_CONFIDENCE: ReadonlySet<string> = new Set(["high", "mid", "low"]);
const VALID_SIDES: Record<PickMarket, ReadonlySet<string>> = {
  "1x2": new Set(["Home", "Draw", "Away"]),
  asian_handicap: new Set(["Home", "Away", "1", "2"]),
  asian_total: new Set(["Over", "Under"]),
};

export interface ExtractedPicks {
  /** 剥离 picks 块后的展示文本（含坏块剥离） */
  cleanContent: string;
  /** 校验通过的 picks；块缺失 / 解析失败 → null（上层走纯赔率派生兜底） */
  picks: AnalysisPick[] | null;
}

function validatePicks(raw: unknown): AnalysisPick[] | null {
  if (!raw || typeof raw !== "object") return null;
  const arr = (raw as { picks?: unknown }).picks;
  if (!Array.isArray(arr)) return null;
  const seen = new Set<string>();
  const out: AnalysisPick[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const { market, side, confidence, reason } = item as Record<string, unknown>;
    if (typeof market !== "string" || !VALID_MARKETS.has(market)) continue;
    if (typeof confidence !== "string" || !VALID_CONFIDENCE.has(confidence)) continue;
    const m = market as PickMarket;
    if (typeof side !== "string" || !VALID_SIDES[m].has(side)) continue;
    if (seen.has(m)) continue; // 每玩法至多一条，首条生效
    seen.add(m);
    out.push({
      market: m,
      side,
      confidence: confidence as PickConfidence,
      reason: typeof reason === "string" ? reason.slice(0, REASON_MAX_LEN) : undefined,
    });
    if (out.length >= 3) break;
  }
  return out.length > 0 ? out : null;
}

/**
 * 流结束后调用：剥离 picks 块并解析。
 * 块不存在 → 原文返回 + picks=null；块存在但坏 → 剥离 + picks=null。
 */
export function extractPicksBlock(content: string): ExtractedPicks {
  const openIdx = content.lastIndexOf(FENCE_OPEN);
  if (openIdx === -1) return { cleanContent: content, picks: null };

  const bodyStart = openIdx + FENCE_OPEN.length;
  // REV-v1-A M-2：关闭 fence 必须独立行（行首 ```），不与 body 内的行内反引号碰撞
  // （LLM 可能在 reason 字段输出反引号，任意位置 indexOf 会提前截断 JSON 并把残块漏给用户）
  const closeIdx = (() => {
    let search = bodyStart;
    while (true) {
      const idx = content.indexOf(FENCE_CLOSE, search);
      if (idx === -1) return -1;
      if (idx === 0 || content[idx - 1] === "\n") return idx;
      search = idx + 1;
    }
  })();
  const body = closeIdx === -1 ? content.slice(bodyStart) : content.slice(bodyStart, closeIdx);
  const tail = closeIdx === -1 ? "" : content.slice(closeIdx + FENCE_CLOSE.length);
  const cleanContent = (content.slice(0, openIdx) + tail).trimEnd();

  try {
    const parsed: unknown = JSON.parse(body.trim());
    return { cleanContent, picks: validatePicks(parsed) };
  } catch {
    console.warn("[ai/picks] Failed to parse oddfi-picks block — falling back to default pick");
    return { cleanContent, picks: null };
  }
}

/**
 * 流式中间态调用：隐藏（可能不完整的）picks 块，避免协议 JSON 闪现给用户。
 * - 已出现完整 fence 开头 → 从开头处截断
 * - 文本结尾是 fence 开头的部分前缀（如 "``" / "```oddf"）→ 一并裁掉，防止逐字符闪现
 */
export function hidePartialPicksBlock(streaming: string): string {
  const openIdx = streaming.indexOf(FENCE_OPEN);
  if (openIdx !== -1) return streaming.slice(0, openIdx).trimEnd();
  // 结尾部分前缀检测：最长可能前缀 = FENCE_OPEN.length - 1
  const maxProbe = Math.min(FENCE_OPEN.length - 1, streaming.length);
  for (let len = maxProbe; len > 0; len--) {
    if (streaming.endsWith(FENCE_OPEN.slice(0, len))) {
      return streaming.slice(0, streaming.length - len);
    }
  }
  return streaming;
}
