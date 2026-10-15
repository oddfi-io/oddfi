/**
 * Recents 会话快照工具（DD-121 PC / DD-135 H5 双端同构）。
 *
 * 会话模型：单会话生效，Recents 仅前端视觉（session 级快照，不持久化）。
 * PC（AiChatMainView）与 H5（MobileAiChatSheet）各自持有本地 state，
 * 快照标题派生 / 相对时间 / 上限淘汰规则共享此处，保证两端语义一致。
 */

export const RECENTS_LIMIT = 20;

export interface RecentSnapshot {
  id: string;
  title: string;
  ts: number;
}

/** 取当前会话首条用户消息为标题（截断 40 字），无则回退。 */
export function deriveSessionTitle(firstUserContent: string | undefined): string {
  const trimmed = firstUserContent?.trim();
  if (!trimmed) return "New Chat";
  return trimmed.length > 40 ? `${trimmed.slice(0, 40)}…` : trimmed;
}

/** 紧凑相对时间（now / Nm / Nh / Nd），对齐设计稿 "5m" 风格（视觉用）。 */
export function compactAge(ts: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
