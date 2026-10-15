/**
 * DD-110 §3.3 v3 D16 — 新闻 SSE 通知音。
 *
 * 复用 aiAgentStore.config.sound 作为唯一权威；不引新 store。
 *
 * 抑制条件（任一命中即不播）：
 * 1. `document.hidden`（tab 隐藏 — 首版不接 OS 通知）
 * 2. 用户正在看 news tab（mode !== "closed" && activeTab === "news"）
 * 3. master 开关 off 或 sound.id === null
 * 4. 5s 节流（防赔率密集时段连环音爆 + 浏览器 NotAllowedError）
 *
 * `card.update` **不**触发音效（仅 enrich 完成的复述，非新信息）。
 */
import { useAiAgentStore } from "@/stores/aiAgentStore";
import { useAiChatSessionStore } from "@/stores/aiChatSessionStore";

export const NOTIFY_SOUND_THROTTLE_MS = 5_000;

let lastPlayAt = 0;

export function playNotifySound(): void {
  if (typeof window === "undefined") return;

  if (document.hidden) return;

  const sessionState = useAiChatSessionStore.getState();
  if (sessionState.mode !== "closed" && sessionState.activeTab === "news") {
    return;
  }

  const { sound } = useAiAgentStore.getState().config;
  if (!sound.enabled || !sound.id) return;

  const now = Date.now();
  if (now - lastPlayAt < NOTIFY_SOUND_THROTTLE_MS) return;
  lastPlayAt = now;

  try {
    const audio = new Audio(`/sounds/notify-${sound.id}.mp3`);
    audio.volume = 0.6;
    void audio.play().catch((e) => {
      console.warn("[news/notify-sound] play failed", e);
    });
  } catch (e) {
    console.warn("[news/notify-sound] Audio construct failed", e);
  }
}

/** 测试用：重置节流时间戳。 */
export function resetNotifySoundThrottleForTest(): void {
  lastPlayAt = 0;
}
