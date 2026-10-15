/**
 * DD-126 · 比赛直播流类型（与 oddfi-web-api/handler/fixture_streams.go 契约对齐）。
 *
 * 后端：GET /api/v1/fixture/:fixture_id/streams
 * 成功永远 HTTP 200 + body code 200；非 200 由 marketGet 抛 MarketApiError。
 */

/** 直播流状态三态（后端 deriveStreamStatus 推导）。 */
export type StreamStatus = "available" | "pending" | "unavailable";

/** 单条直播流（后端 streamResp，仅暴露白名单字段）。 */
export interface FixtureStreamItem {
  /** 源标识，内测期固定 streamed.pk，上线前切 sportmonks */
  provider: string;
  /** 嵌入播放地址，已过后端白名单二次过滤 */
  embed_url: string;
  /** 语言名，可空字符串 */
  language: string;
  /** 是否高清 */
  hd: boolean;
  /** 同一 source 多路时编号 */
  stream_no: number;
}

/** GET /fixture/:id/streams 的 data 体。 */
export interface FixtureStreamsResponse {
  fixture_id: number;
  stream_status: StreamStatus;
  /** 后端已按 hd desc, stream_no asc 排序，前端按数组顺序展示即可 */
  streams: FixtureStreamItem[];
}
