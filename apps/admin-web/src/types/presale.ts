// presale 资源 DTO（camelCase）。
// 字段 = oddfi-admin-backend/internal/client/types.go 的 DTO（前端收到的真实 shape）。
// ⚠️ 唯一真值，比 DB 模型字段少很多。DB 有、下面没有的字段 = 后端未透出，前端拿不到。
// 契约：03-pages.md §0。

export type RoundStatus = "upcoming" | "active" | "paused" | "ended";

export interface Round {
  id: string; // seed/strategic/ecosystem/public_a/public_b/public_c
  status: RoundStatus;
  priceUsd: string;
  supplyOdd: string;
  soldOdd: string;
  raisedUsd: string;
  startTs: number; // epoch ms
  endTs: number; // epoch ms
  minPerOrderUsd: string; // 可能为 "" / "0"（后端 string，非 null）
  maxPerWalletUsd: string;
  tgeReleasePct: string; // ⚠️ string（DECIMAL 序列化），不是 number
  linearReleaseDays: number;
  referralRewardPct: string;
  manualOverride: boolean;
  createdAt: number;
  updatedAt: number;
}

// 后端 RoundItem 不含 name / roundType / targetRaiseUsd / badge / sortOrder。
// 展示名走前端映射；募集进度用 soldOdd/supplyOdd（无 targetRaiseUsd）。
export const ROUND_NAMES: Record<string, string> = {
  seed: "种子轮",
  strategic: "战略轮",
  ecosystem: "生态轮",
  public_a: "公募 A 轮",
  public_b: "公募 B 轮",
  public_c: "公募 C 轮",
};

export type DepositStatus = "pending" | "confirmed" | "anomaly";

export interface Deposit {
  txHash: string;
  roundId: string;
  eoaAddress: string;
  vaultAddress: string;
  amountUsdt: string;
  sharesOdd: string;
  status: DepositStatus;
  blockTs: number; // ⚠️ blockTs（不是 blockTimestamp），epoch ms
  createdAt: number;
  updatedAt: number;
}
// ⚠️ 不含 logIndex/blockNumber/priceUsd/referrer*/referralReward*/anomalyReason/source。

export interface MigrateResult {
  // migrate-round 响应
  txHash: string;
  oldRoundId: string;
  newRoundId: string;
  oldSharesOdd: string;
  newSharesOdd: string;
  deposit: Deposit;
}

export type AnomalyStatus = "pending" | "notified" | "resolved" | "rejected";

export interface AnomalyEvent {
  id: number;
  eventType: string;
  txHash: string;
  eoaAddress: string;
  amountUsdt: string;
  status: AnomalyStatus;
  resolution: string; // resolve 后才有值
  note: string;
  operatorId: string;
  createdAt: number;
  updatedAt: number;
}
// ⚠️ 不含 payloadJson/depositId/resolvedBy/resolvedAt/resolveNote。

export interface PresaleConfig {
  tgeTs: number;
  tgeOpenPriceUsd: string;
  vaultAddress: string;
  minSubscribeUsd: string;
  boundaryToleranceMin: number;
  totalTargetUsd: string;
  auditLabel: string;
  larkWebhookUrl: string; // 前端展示前必须打码，且不给复制按钮（凭据敏感）
  updatedAt: number;
}

export interface UpdateConfigResult {
  config: PresaleConfig;
  warning?: string;
}

// KOL 特殊返佣（REQ-004）。字段 = admin-backend client.KolReferralItem。
// referralPct 为 decimal string（如 "8.0000"），禁止 number 化丢精度。
// createdAt/updatedAt 为 epoch ms（number），与其它 presale 资源一致。
export interface KolReferral {
  referrerEoa: string;
  referralPct: string;
  note: string;
  createdBy: string; // Lark user_id
  createdAt: number;
  updatedAt: number;
}

export type AuditTargetType = "round" | "deposit" | "config" | "anomaly";
export type AuditSource = "api" | "script";

export interface AuditLog {
  id: number;
  operator: string;
  operatorRole: string;
  action: string;
  targetType: AuditTargetType;
  targetId: string;
  beforeJson: string | null;
  afterJson: string | null;
  source: AuditSource;
  ip: string | null;
  note: string;
  createdAt: number;
}
