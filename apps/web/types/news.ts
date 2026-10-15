/**
 * DD-110 v3.2 — oddfi-agent-backend 推送卡数据契约。
 *
 * **权威来源**：`/Users/hang/work/oddfi-agent-backend/docs/api.md` §3
 *           + `internal/pushtypes/types.go::PushCard`
 *
 * 注意：扁平 schema（不是嵌套对象），与 docs/api.md §3 字段一一对齐。
 */

export type EnrichStatus = "pending" | "ok" | "skipped" | "failed";

/** 后端 tag 枚举（仅 enrichStatus === "ok" 时存在）。 */
export type TagKind = "odds" | "match" | "market";

/**
 * AI 解读字段（仅 enrichStatus === "ok" 时存在）。
 * - `change`：一句中文核心要点，**纯文本**
 * - `priceImpact` / `probImpact`：唯一允许 `<b class="delta-up|delta-down">±N%</b>` HTML 标签的两字段
 */
export interface AiAnalysis {
  change: string;
  priceImpact: string;
  probImpact: string;
}

/** 建议动作（仅 enrichStatus === "ok" 时存在）—— 所有子字段纯文本。 */
export interface Suggest {
  text: string;
  /** ≤ 8 字主按钮文案。 */
  action: string;
  /** ≤ 8 字副按钮文案。 */
  alt: string;
}

/** 持仓块（V1 仅 dev inject 注入，生产不产出，本前端不渲染）。 */
export interface Position {
  pick: string;
  entryOdd: number;
  stake: number;
  newOdd: number;
  pnl: number;
}

/**
 * 后端 PushCard 扁平结构。
 *
 * `enrichStatus !== "ok"` 时只保证基础字段（id/originalText/source/sourceUrl/createdAt/ingestedAt/enrichStatus）；
 * `enrichStatus === "ok"` 时 tag/tagLabel/title/aiAnalysis/suggest 才齐全。
 */
export interface PushCard {
  /** 推文原 ID（天然去重键）。 */
  id: string;
  /** 推文原文（必有，纯文本）。 */
  originalText: string;
  /** 来源字符串（含 emoji + handle），如 "🐦 @Romano"。 */
  source: string;
  /** 推文外链，如 `x.com/Romano/status/123`。 */
  sourceUrl: string;
  /** 作者名（可选，独立于 source 字符串的友好名）。 */
  authorName?: string;
  /** 推文发布时间（unix ms），用于「N 分钟前」。 */
  createdAt: number;
  /** 入库时间（unix ms），用于 cursor 翻页 + SSE since 续传。 */
  ingestedAt: number;
  /** 决定 UI 状态文案的核心字段。 */
  enrichStatus: EnrichStatus;

  // ── enrichStatus === "ok" 时才有以下字段 ──

  tag?: TagKind;
  /** tag 的中文 label，如「赔率剧变」/「球赛变更」/「市场变化」。 */
  tagLabel?: string;
  /** AI 生成的中文标题（≤ 20 字）。 */
  title?: string;
  /** 比赛标签，如 "Real Madrid vs PSG"。 */
  match?: string;
  aiAnalysis?: AiAnalysis;
  suggest?: Suggest;
  position?: Position;

  // ── 后端 deprecated 字段（兼容期保留，下个版本删除） ──

  /** 后端预算好的相对时间，如 "5 分钟前"；前端请用 createdAt 自算。 */
  time?: string;
  /** = (enrichStatus === "ok")；新代码用 enrichStatus。 */
  aiEnriched?: boolean;
}

/**
 * GET /api/push 响应。
 *
 * 注意：后端字段名 `items`（不是 cards）。前端 hook 对外保留 `cards` 名称，
 * 在 fetchPush 内部做 items → cards 映射。
 */
export interface PushResponse {
  items: PushCard[];
  count: number;
  hasMore: boolean;
  /** 72h 回溯到底标记。 */
  truncated: boolean;
  cursor: {
    /** 用于翻页 — 下一页 `before` 参数。 */
    next: number | null;
    /** 用于 SSE — 首次 stream `since` 参数。 */
    latest: number | null;
  };
}
