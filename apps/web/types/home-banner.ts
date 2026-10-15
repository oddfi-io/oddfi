// Home Banner 类型契约
// 来源：Lark wiki Market_Banner v1.0 §三接口契约
// 后端：GET /api/v1/market/banners?lang=xx → market-api.oddfi.io（已接入真接口）

/**
 * Banner 模板键（与后端契约对齐 — 5 个语义 snake_case 键）
 * - top_wins_the_world_cup：夺冠盘
 * - total_goals：球员进球总数
 * - top_golden_ball_name：金球奖 / MVP
 * - top_golden_boot_name：金靴奖
 * - top_golden_glove_name：金手套奖
 */
export type TemplateId =
  | "top_wins_the_world_cup"
  | "total_goals"
  | "top_golden_ball_name"
  | "top_golden_boot_name"
  | "top_golden_glove_name";

export type BetMode = "single";

export interface BannerItemExtra {
  /** 该档位对应的 TVL（成交量，USDC） */
  tvl?: number;
  /** top_wins_the_world_cup 专用：热度 0-5（Figma visual 显示按排名递减 3/2/1/0） */
  heat?: number;
  /** total_goals 专用：整数档位，如 1/2/3 goals */
  goals_slot?: number;
  /** total_goals 专用：最火档位标记 ⭐ */
  is_favorite?: boolean;
  /** top_golden_boot_name 专用：进球数，首页进度条 width = goals / max * 100% */
  goals?: number;
  /** top_golden_glove_name 专用：扑救数，显示 "{saves} Saves" */
  saves?: number;
}

export interface BannerItem {
  /** 显示名（球队 / 球员 / 档位文案） */
  name: string;
  /** 赔率（十进制，如 3.2） */
  odds: number;
  /** 隐含概率，百分数（后端契约：20 = 20%；非 0~1 比率） */
  implied_probability?: number;
  /** 市场 ID（int64 — banner_bet_place 必填，2026-04-27 后端契约统一） */
  market_id: number;
  /** 选项 ID（int64 — banner_bet_place 必填，2026-04-27 后端契约统一） */
  selection_id: number;
  /** 投注模式，Phase 1 固定 ["single"] */
  bet_mode: BetMode[];
  /** ISO 3166-1 alpha-2，除 total_goals 外使用；GB-ENG 为特例 */
  country_code?: string;
  /** 球员 ID，金球/金靴/金手套使用 */
  player_id?: string;
  /** 球员头像 key，金球/金靴/金手套使用 */
  avatar_key?: string;
  /** 模板特定字段 */
  extra: BannerItemExtra;
}

export interface HomeBannerData {
  banner_id: string;
  template_id: TemplateId;
  /** 排序用，升序 */
  sort_order: number;
  /** false 的 banner 前端过滤掉 */
  is_active: boolean;
  /** 左上标签文案（大写），如 "HOT MARKET" */
  tag_text: string;
  /** 标签动态配色（hex / CSS 字符串） */
  tag_color: string;
  /** 主标题（大写） */
  title: string;
  /** 副标题，可空（total_goals 使用："CRISTIANO RONALDO · FWD · #7"） */
  subtitle: string | null;
  /** 装饰图 key，前端映射到 BANNER_DECORATIONS */
  decoration_key: string;
  /** 截止时间 — UTC+0，格式 "YYYY-MM-DD HH:mm:ss"（无时区标记，前端按 UTC 解析）
   *  接口示例：`"2026-07-22 23:59:59"`，前端 useCountdown(end_time) 计算剩余 D/H/M/S */
  end_time?: string;
  /** 档位列表 */
  items: BannerItem[];
}

// Banner 详情接口（DD-085）
// 后端：GET /api/v1/market/banners/{template_id}?lang=xx → market-api.oddfi.io
// 返回扁平 BannerItem[]，不含 banner 元数据（元数据从 list 接口取）

/** 详情接口单项；继承 BannerItem，添加可选 image_url */
export interface BannerItemDetail extends BannerItem {
  /** 国旗 / 球员头像 CDN URL（夺冠盘已返回；后端 CDN 未就绪前前端**不消费**，
   *  国旗仍走 country-flag-icons，球员头像走 public/banner/avatars/。
   *  Phase 3 CDN 就绪后切 image_url。 */
  image_url?: string;
}
