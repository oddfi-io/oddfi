/**
 * Reward Hub（奖励中心）数据类型 —— DD-150
 *
 * ⚠️ 后端 DTO 锚定（architect Major M1）：
 * 本期为纯前端 fixture 驱动，无后端接口。下方类型即「未来后端任务/奖励接口的目标形状」。
 * 后端契约定稿后若字段有差异，**新增 `lib/rewards/adapter.ts` 做 DTO → ViewModel 转换**，
 * 叶子组件只吃这里的 ViewModel 类型 props，不直接吃后端原始 DTO，
 * 以把后端接入的改动收敛在 adapter + 顶层容器，不连锁改叶子组件。
 *
 * 术语：见 CONTEXT.md §3.5 —— 本页奖励是 **TaskReward**（任务领取奖励），
 * 与 referral 页的 **ReferralReward**（推荐返佣）不可混用。
 */

/**
 * 任务项状态机（正交模型 · critic Major）。
 *
 * Figma 的「四种视觉」并非四个枚举值，而是 status × verifyKind 的组合：
 *   - default                → 未开始
 *   - verifying + click 按钮  → 待验证（点击式：关注 / 加群 / 转发）
 *   - verifying + input 输入框 → 待验证（输入式：粘贴链接 / 填写凭据）
 *   - done                   → 已完成 ✓
 */
export type TaskItemStatus = "default" | "verifying" | "done";

/** 验证 UI 形态：按钮（一键校验）还是输入框 + 提交 */
export type TaskVerifyKind = "click" | "input";

/** 单个任务项 */
export interface TaskItem {
  /** 稳定 id，同时作为 i18n key 后缀（`rewards.tasks.<id>.title`） */
  id: string;
  status: TaskItemStatus;
  verifyKind: TaskVerifyKind;
  /** 该任务奖励的 ODD 数量（字符串，展示走 formatAmount） */
  reward: string;
}

/** 任务组（新手任务 / 每日社媒任务） */
export interface TaskGroup {
  /** 稳定 id，同时作为 i18n key 后缀（`rewards.groups.<id>.title`） */
  id: string;
  /** Phosphor 图标键，组件内映射到具体 Icon 组件 */
  iconName: string;
  /** 组总奖励 ODD（用于副标题插值「总计 250 ODD」） */
  totalReward: string;
  /** 组累计已发放 / 统计值（组头带 ODD 币种图标的数字，如 "5,930"） */
  poolStat: string;
  /** 倒计时截止（UTC「YYYY-MM-DD HH:mm:ss」，喂 useCountdown） */
  endTime: string;
  /** 倒计时是否展示「天」chip：新手任务 true（DD/HH/MM/SS），每日任务 false（HH/MM/SS） */
  showDays: boolean;
  tasks: TaskItem[];
}

/** 奖励记录状态（待领取 / 已领取 / 已过期） */
export type RewardStatus = "claimable" | "claimed" | "expired";

/** 单条奖励记录 */
export interface RewardRecord {
  /** 稳定 id，同时作为 i18n key 后缀（`rewards.records.<id>.title` / `.desc`） */
  id: string;
  status: RewardStatus;
  /** 奖励 ODD 数量（展示为 `+100 ODD`，走 formatAmount） */
  amount: string;
  /** 发放日期（`YYYY-MM-DD`，与描述拼成「2026-06-12 · 引用喊单推」） */
  date: string;
}
