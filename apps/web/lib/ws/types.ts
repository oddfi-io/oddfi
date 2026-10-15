/**
 * DD-101: 通用 WebSocket 协议类型（JSON-RPC 风格 + 服务端推送事件混合）
 *
 * 后端协议参考：[【接口文档】ws服务文档]
 * https://ygb8h37py5b.sg.larksuite.com/wiki/BIH5wepWpir7Wfkxma5l7Tl9gWc
 */

export const WS_ERR_CODES = {
  PARAM_ERROR: 40001,
  AUTH_REQUIRED: 40101,
  TOKEN_INVALID: 40102,
  TOKEN_EXPIRED: 40103,
  TOKEN_REVOKED: 40104,
  SERVER_ERROR: 50001,
} as const;

export type WsErrCode = (typeof WS_ERR_CODES)[keyof typeof WS_ERR_CODES];

/** Codes that mean the token cannot be self-healed by L1 refresh — must clear session and reconnect. */
export function isTerminalAuthError(code: number): boolean {
  return code === WS_ERR_CODES.TOKEN_INVALID || code === WS_ERR_CODES.TOKEN_REVOKED;
}

export interface WsRequest<TParams = unknown> {
  id: string;
  method: string;
  params: TParams;
}

export interface WsResponse<TData = unknown> {
  id: string;
  code: number;
  msg: string;
  data?: TData;
}

export interface WsEvent<TData = unknown> {
  event: string;
  data: TData;
}

/**
 * Connection lifecycle states.
 *
 * idle → connecting → authing → ready
 *                                ↓
 *                         reconnecting → connecting → ...
 *                                ↓
 *                         closed (user-initiated, terminal)
 */
export type WsState = "idle" | "connecting" | "authing" | "ready" | "reconnecting" | "closed";

export interface WsClientLogger {
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export interface WsClientOpts {
  url: string;
  /** Read current access_token from auth store. Called fresh on every auth handshake. */
  getAccessToken: () => string | null;
  /** Refresh the access_token via REST (委托 doRefreshSingleton). Called on 40103 token expired. */
  onAuthFailed: () => Promise<void>;
  /** Dispatch server-initiated push events (e.g. tx_status). */
  onEvent: (event: string, data: unknown) => void;
  /** Default per-request timeout in ms (default 10_000). */
  requestTimeoutMs?: number;
  /** Reconnect backoff base / cap in ms (defaults 1_000 / 30_000). */
  reconnectBaseMs?: number;
  reconnectMaxMs?: number;
  /** Soft liveness probe — close socket if no message received within this window (default 60_000). */
  livenessTimeoutMs?: number;
  /** Test seam: override WebSocket constructor. */
  webSocketCtor?: typeof WebSocket;
  logger?: WsClientLogger;
}

export class WsError extends Error {
  constructor(
    public readonly code: number,
    msg: string
  ) {
    super(`[WS] ${msg} (code: ${code})`);
    this.name = "WsError";
  }
}

export class WsTimeoutError extends Error {
  constructor(public readonly method: string) {
    super(`[WS] Request timeout: ${method}`);
    this.name = "WsTimeoutError";
  }
}

/** Thrown by tx-ws (Batch 2) when NEXT_PUBLIC_WS_TX_URL is empty — consumer must downgrade. */
export class WsDisabledError extends Error {
  constructor(service: string) {
    super(`[WS] Service disabled: ${service}`);
    this.name = "WsDisabledError";
  }
}
