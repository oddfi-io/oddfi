/** performLogin 中的 3 个阶段，让 friendly 文案能按用户实际操作步骤区分提示 */
export type LoginPhase = "connect" | "switch" | "sign";

/**
 * BUG-013 v2 · 错误严重度（驱动 UI icon 色 + Sentry 报告决策）
 * - info：用户主动取消，预期内行为，不报告
 * - warning：钱包/客户端侧问题，可重试，UI 不暗示后端故障
 * - error：系统/后端/网络问题，需要 ops 介入
 */
export type WalletErrorSeverity = "info" | "warning" | "error";

/**
 * BUG-013 v2 · 错误分类（11 kind），用于 i18n key 拼接 `wallet.error.{kind}.title/description`
 * 与既有 `classifyWalletError` 返回的字符串相比，本类型多了 phase 拆分 +
 * server-error / network-error 区分，避免客户端 wallet 问题被 UI 错显为"服务器问题"。
 */
export type WalletErrorKind =
  | "user-rejected-connect"
  | "user-rejected-switch"
  | "user-rejected-sign"
  | "connector-not-connected"
  | "connector-chain-mismatch"
  | "chain-switch-failed"
  | "chain-switch-timeout"
  | "sign-timeout"
  | "server-error"
  | "network-error"
  | "unknown";

export interface WalletErrorInfo {
  kind: WalletErrorKind;
  severity: WalletErrorSeverity;
}

const KIND_SEVERITY: Record<WalletErrorKind, WalletErrorSeverity> = {
  "user-rejected-connect": "info",
  "user-rejected-switch": "info",
  "user-rejected-sign": "info",
  "connector-not-connected": "warning",
  "connector-chain-mismatch": "warning",
  "chain-switch-failed": "warning",
  "chain-switch-timeout": "warning",
  "sign-timeout": "warning",
  "server-error": "error",
  "network-error": "error",
  unknown: "error",
};

/** ky HTTPError / 后端 4xx-5xx 检测 */
function isHttpError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === "HTTPError") return true;
  return /Request failed with status code|HTTP \d{3}/i.test(err.message);
}

/** fetch 网络层失败 / ky TimeoutError 检测（与 sign-timeout 区分：后者是钱包侧） */
function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === "TimeoutError" && /Request timed out/i.test(err.message)) return true;
  return /Failed to fetch|Network request failed|fetch failed|NetworkError/i.test(err.message);
}

/**
 * BUG-013 v2 · 结构化错误分类，UI 优先消费 kind 走 i18n 文案矩阵
 * `wallet.error.{kind}.title` + `wallet.error.{kind}.description`。
 *
 * 与既有 `classifyWalletError` 的差异：
 * - user-rejected 按 phase 拆三种 kind
 * - unknown 进一步区分 server-error / network-error / unknown
 * - severity 信息让 UI 决定 icon 色与 Sentry 决定是否上报
 */
export function getWalletErrorInfo(err: unknown, phase?: LoginPhase): WalletErrorInfo {
  const base = classifyWalletError(err);

  let kind: WalletErrorKind;
  if (base === "user-rejected") {
    kind = `user-rejected-${phase ?? "connect"}` as WalletErrorKind;
  } else if (base === "unknown") {
    if (isHttpError(err)) kind = "server-error";
    else if (isNetworkError(err)) kind = "network-error";
    else kind = "unknown";
  } else {
    kind = base as WalletErrorKind;
  }

  return { kind, severity: KIND_SEVERITY[kind] };
}

export function classifyWalletError(err: unknown): string {
  if (!(err instanceof Error)) return "unknown";
  if (err.name === "ConnectorChainMismatchError") return "connector-chain-mismatch";
  if (/connector.*does not match.*connection/i.test(err.message)) return "connector-chain-mismatch";
  // BUG-013: 多扩展 provider contention 导致 wagmi state.current 被异步清空 → signMessage 抛 ConnectorNotConnectedError
  if (err.name === "ConnectorNotConnectedError") return "connector-not-connected";
  if (/Connector not connected/i.test(err.message)) return "connector-not-connected";
  // BD-008 ensureCoreChain 抛的 3 类 friendly Error 必须先于通用 regex 命中，否则落 unknown 让 Sentry 维度失准
  if (/Please switch your wallet to/i.test(err.message)) return "user-rejected";
  if (/Wallet connection was canceled|Wallet not fully connected/i.test(err.message))
    return "user-rejected";
  if (/Failed to switch to .*please switch manually/i.test(err.message))
    return "chain-switch-failed";
  if (/store-chain-sync-timeout|did not switch.*in time|did not reflect/i.test(err.message))
    return "chain-switch-timeout";
  if (/reject|denied/i.test(err.message)) return "user-rejected";
  if (/timeout/i.test(err.message)) return "sign-timeout";
  return "unknown";
}

/**
 * user-cancel 文案常量化：`userRejectedMessage`（生成）与 `isUserCanceledMessage`（反向匹配）共用，
 * 避免改文案需双改两处的漏改隐患。
 */
const USER_CANCEL_MSGS: Record<LoginPhase, string> = {
  sign: "Signature canceled. Please try again",
  switch: "Network switch canceled. Please try again",
  connect: "Wallet connection canceled. Please try again",
};
const USER_CANCEL_MSG_SET = new Set<string>(Object.values(USER_CANCEL_MSGS));

/** 用户主动取消的 user-rejected 按业界标准文案分阶段提示。 */
function userRejectedMessage(err: unknown, phase?: LoginPhase): string {
  // ensureCoreChain 抛的已经是 friendly 切链提示（"Please switch your wallet to..."）保留原文
  if (err instanceof Error && /Please switch your wallet to/i.test(err.message)) return err.message;
  return USER_CANCEL_MSGS[phase ?? "connect"];
}

export function mapWalletError(err: unknown, phase?: LoginPhase): string {
  const kind = classifyWalletError(err);
  switch (kind) {
    case "connector-chain-mismatch":
      return "Wallet network is still syncing — please retry";
    case "connector-not-connected":
      return "Wallet connection lost — please try again";
    case "user-rejected":
      return userRejectedMessage(err, phase);
    case "chain-switch-failed":
      return err instanceof Error ? err.message : "Failed to switch chain — please retry";
    case "chain-switch-timeout":
      return err instanceof Error ? err.message : "Chain switch timed out — please retry";
    case "sign-timeout":
      return "Signature timeout — please open your wallet app to sign";
    default:
      return "Login failed. Please try again.";
  }
}

/** Sentry 上报判断：用户主动取消不应上报告警噪音。 */
export function shouldReportToSentry(err: unknown): boolean {
  return classifyWalletError(err) !== "user-rejected";
}

/**
 * 判断 loginError 字符串是否来自用户主动取消（而非系统/接口报错）。
 * 供 SigningPanel / SigningView 区分"签名已取消" vs "登录失败"两套文案。
 */
export function isUserCanceledMessage(msg: string | null): boolean {
  if (!msg) return false;
  return USER_CANCEL_MSG_SET.has(msg) || /Please switch your wallet to/i.test(msg);
}
