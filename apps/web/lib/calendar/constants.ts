/**
 * Calendar 页前端硬编码常量（不走后端）。
 * 详见 DD-091 §3.5 + 附录 A。
 */
import type { CalendarStageId } from "@/types/calendar";

/** 赛事 ID（PRD 唯一值） */
export const TOURNAMENT_ID = "fifa_wc_2026";

/** 联赛 ID（市场页 SportMonks 编号） */
export const LEAGUE_ID = 732;

/**
 * Y 轴 15 档 UTC 基准时间。
 * - 实测真实数据 13 档（00-04, 16-23），无 15:00；15:00 / 05:00 行作 PRD 兼容空槽 +
 *   末行 buffer，让 04:00 行的比赛卡片底部留出视觉缓冲
 * - 跨日规则：'00'/'01'/.../'05' 为次日凌晨档
 * - 切到 IANA 时区时由 `lib/calendar/timezone.ts` 平移生成展示数组
 */
export const Y_TIMES_UTC = [
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "00",
  "01",
  "02",
  "03",
  "04",
  "05",
] as const;

/**
 * SportMonks stage_id → CalendarStageId 映射。
 * 实测来源于 GET /api/v1/detail/sports_all?league=732（B0 校对 7 段全量）
 */
export const STAGE_ID_MAP: Record<number, CalendarStageId> = {
  77478590: "group",
  77479086: "r32",
  77479087: "r16",
  77479088: "qf",
  77479089: "sf",
  77479090: "final",
  77479091: "third",
};

/** 7 段固定排序（用于 stages[] 排序、cascade 序列计算） */
export const STAGE_ORDER: CalendarStageId[] = ["group", "r32", "r16", "qf", "sf", "third", "final"];

/** 各 stage 的 i18n fallback label（实际展示走 next-intl t(`calendarPage.stages.${stage_id}`)） */
export const STAGE_LABEL: Record<CalendarStageId, string> = {
  group: "Group Stage",
  r32: "Round of 32",
  r16: "Round of 16",
  qf: "Quarter-finals",
  sf: "Semi-finals",
  third: "3rd Place",
  final: "Final",
};

/** Hover popover 进入延迟 */
export const HOVER_ENTER_MS = 200;
/** Hover popover 离开延迟 */
export const HOVER_LEAVE_MS = 80;

/** PC 网格列宽 */
export const COL_WIDTH_PC = 192;
/** 同时段双卡每张宽度 */
export const COL_WIDTH_PC_PAIR = 96;
/** 行高（每小时档） */
export const ROW_HEIGHT = 56;
/** 时间轴列宽 */
export const TIME_AXIS_WIDTH = 72;
/** 日期轴行高（UTC corner / date pill 行；Figma `4379:88270` spacer 高 35） */
export const DATE_AXIS_HEIGHT = 35;
/** 行与行之间的间距（Figma label 间距 8） */
export const ROW_GAP = 8;
/** 日期列与日期列之间的 CSS Grid column-gap（Figma 8px） */
export const COL_GAP = 8;
/** 比赛卡片高度（Figma `4384:88424` 系列 = 95） */
export const MATCH_CARD_HEIGHT = 95;

/** 时区偏好持久化 key（localStorage） */
export const TZ_PREF_KEY = "calendar_tz_pref";

/** Calendar 模拟接口延迟（ms） */
export const MOCK_API_DELAY_MS = 50;

/**
 * 7 段 stage 视觉调色板（Figma `4384:88425`）。
 * 用于 SectionBanner 左 border + 半透明背景，以及 MatchCard 左色边。
 *
 * group / qf / sf / third / final 对应项目已有的 fn-{brand|green|yellow|orange|red} token；
 * r32 / r16 在 Figma 是裸值（无 token），按 design-tokens.md 镜像硬编码。
 */
export const STAGE_PALETTE: Record<CalendarStageId, { hex: string; bgRgba: string }> = {
  group: { hex: "#28f4d2", bgRgba: "rgba(40,244,210,0.1)" },
  // @figma-hardcoded: #2c48ef r32-border, rgba(44,72,239,0.2) r32-bg — pending design token
  r32: { hex: "#2c48ef", bgRgba: "rgba(44,72,239,0.2)" },
  // @figma-hardcoded: #8f39ff r16-border, rgba(143,57,255,0.2) r16-bg — pending design token
  r16: { hex: "#8f39ff", bgRgba: "rgba(143,57,255,0.2)" },
  qf: { hex: "#2db270", bgRgba: "rgba(45,178,112,0.1)" },
  sf: { hex: "#f1c409", bgRgba: "rgba(244,208,58,0.1)" },
  third: { hex: "#ed7442", bgRgba: "rgba(237,116,66,0.2)" },
  final: { hex: "#ed4c52", bgRgba: "rgba(237,76,82,0.1)" },
};
