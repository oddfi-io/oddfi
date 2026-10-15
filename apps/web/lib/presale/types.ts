/**
 * DD-119 Presale / Referral 后端 DTO 类型 + adapter。
 *
 * 契约真值：oddfi-backend/web-api/docs/dd-invest/02-api-contract.md
 * 实测样例：同目录 frontend-integration.md（live response，字段名以此为准）
 *
 * ⚠️ 契约稿 vs 实测存在字段名漂移（DD §2.2）：
 *   - deposit/list、referral/list：契约 `list` / 实测 `items` → adaptXxxList 归一
 *   - referral/me stats：契约 `invitedCount` / 实测 `totalReferred` → adaptReferralMe 归一
 *   - referral list item：契约 `joinedAt` / 实测 `boundAt` → adaptReferralList 归一
 * 强约束：组件禁止直读原始键，一律走 adapter 输出的稳定 shape。
 *
 * 全局约定（契约 §4）：金额一律 string（decimal 精度）；时间一律 epoch ms（number）。
 */

// ── 枚举 ──────────────────────────────────────────────────────────
export type RoundType = "private" | "public";
export type RoundStatus = "upcoming" | "active" | "paused" | "ended";
export type DepositStatus = "pending" | "confirmed" | "anomaly";

/**
 * anomalyReason 已知枚举（实测 5 + 契约补充 + 建表 COMMENT 出现的 no_referrer_record）。
 * 后端可能继续新增值（DD §5.2 REV-v1-B），故 UI 映射必须带 default 兜底，
 * 类型用 `string & {}` 放行未知值同时保留已知值的自动补全。
 */
export type AnomalyReason =
  | "overflow"
  | "from_mismatch"
  | "round_mismatch"
  | "late_arrival"
  | "paused_arrival"
  | "non_usdt"
  | "below_min"
  | "unclaimed"
  | "fake_referrer"
  | "no_referrer_record";
// `string & {}` 放行后端未来新增的未知 reason，同时保留已知值的自动补全
export type AnomalyReasonRaw = AnomalyReason | (string & {});

// ── config ───────────────────────────────────────────────────────
export interface PresaleVault {
  depositAddress: `0x${string}`;
  chain: string;
  chainId: number; // 56 (BSC)
  asset: string; // "USDT"
  usdtAddress: `0x${string}`;
  minSubscribeUsd: string;
  totalRaisedUsd: string;
  totalTargetUsd: string;
  tgeTs: number; // epoch ms 绝对时刻
  tgeOpenPriceUsd: string;
  audit: string;
  boundaryToleranceMin: number;
}

export interface PresaleRound {
  id: string; // 后端真值 id（seed / public_a ... 下划线），不再用本地枚举
  name: string;
  roundType: RoundType;
  price: string;
  supply: string;
  sold: string;
  raised: string;
  targetRaiseUsd: string;
  /** 后端衍生进度，语义在契约/实测间有歧义（百分比 vs 0~1）→ 前端不信任，用 sold/supply 自算 */
  soldPercent?: number;
  tgeReleasePct: string | number;
  linearReleaseDays: number;
  referralRewardPct: string;
  tgeDiscountPct: string | number;
  startTs: number; // epoch ms
  endTs: number; // epoch ms
  status: RoundStatus;
  badge: string | null;
  minPerOrderUsd: string | null;
  maxPerWalletUsd: string | null;
}

export interface PresaleConfig {
  vault: PresaleVault;
  rounds: PresaleRound[];
  serverTs?: number;
}

// ── deposit ──────────────────────────────────────────────────────
/** 单笔查询 + 列表项共用（列表字段更少，富字段设为 optional）。 */
export interface Deposit {
  depositId: string;
  txHash: string;
  status: DepositStatus;
  anomalyReason: AnomalyReasonRaw | null;
  roundId: string;
  amountUsdt: string;
  sharesOdd: string;
  blockTimestamp: number;
  priceUsd?: string;
  referrerEoa?: string | null;
  referralRewardOdd?: string;
  referralRewardPct?: string;
  blockNumber?: number;
  source?: string;
  confirmedAt?: number | null;
  createdAt?: number;
}

export interface ReportTxReq {
  txHash: string;
  expectedRoundId?: string;
  expectedAmountUsdt?: string;
}

export interface ReportTxRes {
  depositId: string;
  status: DepositStatus;
  roundId?: string;
  txHash?: string;
}

/** deposit/list 原始 wire（list/items 二选一） */
export interface DepositListWire {
  list?: Deposit[];
  items?: Deposit[];
  total?: number;
  page?: number;
  size?: number;
}

export interface DepositListResult {
  items: Deposit[];
  total: number;
}

// ── position ─────────────────────────────────────────────────────
export interface PerRoundPosition {
  roundId: string;
  totalOdd: string;
  investedUsd: string;
  lockedPriceAvg: string;
  referralOdd: string;
}

export interface Position {
  holdings: string;
  holdingsBySource: { invest: string; referral: string };
  investedUsd: string;
  lockedPriceAvg: string;
  perRound: PerRoundPosition[];
}

// ── referral ─────────────────────────────────────────────────────
export interface Referrer {
  userId?: string;
  eoa: string;
  code: string;
  boundAt: number;
}

/** 归一后的稳定 stats（invitedCount 取 live totalReferred / 契约 invitedCount） */
export interface ReferralStats {
  invitedCount: number;
  totalRewardOdd: string;
}

export interface ReferralMe {
  myCode: string;
  shareLink: string;
  referrer: Referrer | null;
  stats: ReferralStats;
}

export interface ReferralMeWire {
  myCode: string;
  shareLink: string;
  referrer: Referrer | null;
  stats: { invitedCount?: number; totalReferred?: number; totalRewardOdd: string };
}

export interface BindReq {
  code: string;
  source: "link" | "manual";
  business?: string;
}

export interface BindRes {
  referrerEoa: string;
  referrerCode: string;
  boundAt: number;
}

export interface ReferralDeposit {
  depositId?: string;
  txHash: string;
  roundId: string;
  amountUsdt?: string;
  investedUsd?: string;
  sharesOdd?: string;
  rewardOdd: string;
  referralRewardPct?: string;
  blockTimestamp?: number;
  ts?: number;
}

/** 归一后的稳定列表项（joinedAt 取 live boundAt / 契约 joinedAt） */
export interface ReferralListItem {
  userId: string;
  eoa: string;
  code?: string;
  joinedAt: number;
  totalRewardOdd: string;
  deposits: ReferralDeposit[];
}

interface ReferralListItemWire {
  userId: string;
  eoa: string;
  code?: string;
  joinedAt?: number;
  boundAt?: number;
  totalRewardOdd: string;
  deposits?: ReferralDeposit[];
}

export interface ReferralListWire {
  list?: ReferralListItemWire[];
  items?: ReferralListItemWire[];
  total?: number;
  page?: number;
  size?: number;
}

export interface ReferralListResult {
  items: ReferralListItem[];
  total: number;
}

export interface ListQuery {
  page?: number;
  size?: number;
  status?: string;
  business?: string;
}

// ── adapters（归一前后端字段漂移，禁止组件直读原始键） ───────────────
export function adaptDepositList(raw: DepositListWire | null | undefined): DepositListResult {
  const items = raw?.items ?? raw?.list ?? [];
  return { items, total: raw?.total ?? items.length };
}

export function adaptReferralMe(raw: ReferralMeWire): ReferralMe {
  return {
    myCode: raw.myCode,
    shareLink: raw.shareLink,
    referrer: raw.referrer ?? null,
    stats: {
      invitedCount: raw.stats?.totalReferred ?? raw.stats?.invitedCount ?? 0,
      totalRewardOdd: raw.stats?.totalRewardOdd ?? "0",
    },
  };
}

export function adaptReferralList(raw: ReferralListWire | null | undefined): ReferralListResult {
  const rawItems = raw?.items ?? raw?.list ?? [];
  const items: ReferralListItem[] = rawItems.map((it) => ({
    userId: it.userId,
    eoa: it.eoa,
    code: it.code,
    joinedAt: it.boundAt ?? it.joinedAt ?? 0,
    totalRewardOdd: it.totalRewardOdd ?? "0",
    deposits: it.deposits ?? [],
  }));
  return { items, total: raw?.total ?? items.length };
}
