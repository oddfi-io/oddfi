/**
 * DD-119 §5 错误码 → UI 映射（纯函数，可单测）。
 *
 * 覆盖：report-tx 业务码（§5.1）+ deposit anomalyReason（§5.2，带 default 兜底）+ 前端预校验错误。
 * message 字段值为相对 'invest' 命名空间的 i18n key，由调用方 t(message) 翻译后展示。
 * form: "pending"|"silent" 的条目 message 为空串，调用方不展示。
 * 钱包/链侧错误复用 lib/wallet-error.ts，不在此重复。
 */
import type { DepositValidationError } from "./deposit-validation";

export type DepositErrorForm = "toast" | "dialog" | "silent" | "pending";

export interface MappedDepositError {
  form: DepositErrorForm;
  /** i18n key relative to 'invest' namespace, 由调用方 t(message) 翻译 */
  message: string;
  showBscScan?: boolean;
  showSupport?: boolean;
}

/** report-tx / deposit 查询的后端业务码 → UI（§5.1）。 */
export function mapDepositErrorCode(code: number): MappedDepositError {
  switch (code) {
    case 40001: // AMOUNT_TOO_SMALL
      return { form: "toast", message: "depositError.belowMin" };
    case 40006: // INVALID_TX
      return {
        form: "dialog",
        message: "depositError.invalidTx",
        showBscScan: true,
      };
    case 40007: // TX_NOT_TO_VAULT
      return { form: "dialog", message: "depositError.notToVault", showBscScan: true };
    case 40008: // TX_NOT_USDT
      return { form: "dialog", message: "depositError.notUsdt", showBscScan: true };
    case 40405: // TX_NOT_FOUND — worker 未确认，按 pending 继续轮询，不提示
      return { form: "pending", message: "" };
    case 40901: // ROUND_NOT_ACTIVE
      return { form: "toast", message: "depositError.roundNotActive" };
    case 40902: // WALLET_MISMATCH
      return { form: "dialog", message: "depositError.walletMismatch" };
    case 50301: // LISTENER_LAG — 监控用，不展示
      return { form: "silent", message: "" };
    default:
      return { form: "toast", message: "depositError.unknown" };
  }
}

/** referral/bind 业务码 → UI（§5.1，手动绑场景非静默；自动绑由调用方决定静默）。 */
export function mapBindErrorCode(code: number): MappedDepositError {
  switch (code) {
    case 40004: // SELF_REFERRAL
      return { form: "toast", message: "bindError.selfReferral" };
    case 40404: // INVALID_CODE
      return { form: "toast", message: "bindError.invalidCode" };
    case 40903: // ALREADY_BOUND
      return { form: "toast", message: "bindError.alreadyBound" };
    default:
      return { form: "toast", message: "bindError.unknown" };
  }
}

export interface MappedAnomaly {
  /** i18n key relative to 'invest' namespace, 由调用方 t(message) 翻译 */
  message: string;
  showSupport: boolean;
  showBscScan: boolean;
}

/**
 * deposit anomalyReason → UI（§5.2）。统一"已记录 + 运营 24h 内确认 + 客服 + BSCScan"，不让用户慌。
 * ⚠️ 必须带 default 兜底：后端可能新增枚举（如 no_referrer_record），未知值走通用文案。
 * 注意：paused_arrival 的 status 是 confirmed（非 anomaly），由调用方在 confirmed 分支单独处理，不进此表。
 */
export function mapAnomalyReason(reason: string | null): MappedAnomaly {
  const base = { showSupport: true, showBscScan: true };
  switch (reason) {
    case "overflow":
      return { ...base, message: "anomaly.overflow" };
    case "from_mismatch":
      return { ...base, message: "anomaly.fromMismatch" };
    case "round_mismatch":
      return { ...base, message: "anomaly.roundMismatch" };
    case "late_arrival":
      return { ...base, message: "anomaly.lateArrival" };
    case "non_usdt":
      return { ...base, message: "anomaly.nonUsdt" };
    case "below_min":
      return { ...base, message: "anomaly.belowMin" };
    case "unclaimed":
    case "fake_referrer":
      return { ...base, message: "anomaly.generic" };
    default:
      // no_referrer_record 及后端未来新增值 → 通用兜底
      return { ...base, message: "anomaly.generic" };
  }
}

/** 前端预校验错误 → i18n key（相对 'invest' 命名空间），由调用方 t(key, ctx) 翻译后展示。 */
export function mapDepositValidationError(
  error: DepositValidationError,
  ctx: { minSubscribeUsd?: string } = {}
): string {
  switch (error) {
    case "not_authenticated":
      return "validationError.notAuthenticated";
    case "wrong_chain":
      return "validationError.wrongChain";
    case "invalid_amount":
      return "validationError.invalidAmount";
    case "round_not_active":
      return "validationError.roundNotActive";
    case "below_min":
      // 调用方须用 t("validationError.belowMin", { min: ctx.minSubscribeUsd }) 或 t("validationError.belowMinNoCtx")
      return ctx.minSubscribeUsd ? "validationError.belowMin" : "validationError.belowMinNoCtx";
    case "exceeds_remaining":
      return "validationError.exceedsRemaining";
    case "near_boundary":
      return "validationError.nearBoundary";
    case "insufficient_balance":
      return "validationError.insufficientBalance";
    default:
      return "validationError.unknown";
  }
}
