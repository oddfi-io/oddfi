import { silentLogger, type Logger } from "../../foundation/logger/logger-component.js";
import type { TweetCatcherConfig } from "../../models/config/odd-agent-config-model.js";
import type { SecretProvider } from "../secrets/env-secret-provider.js";

export type TweetCatcherListenerOptions = {
  readonly config: TweetCatcherConfig;
  readonly secretProvider: SecretProvider;
  readonly onTweet: (tweet: unknown) => Promise<void>;
  readonly logger?: Logger;
  readonly websocketFactory?: (endpoint: URL) => WebSocketLike;
};

type WebSocketLike = {
  readonly readyState: number;
  readonly send: (data: string) => void;
  readonly close: () => void;
  readonly addEventListener: (
    type: "open" | "message" | "close" | "error",
    listener: (event: { readonly data?: unknown }) => void
  ) => void;
};

export class TweetCatcherListener {
  readonly #config: TweetCatcherConfig;
  readonly #secretProvider: SecretProvider;
  readonly #onTweet: (tweet: unknown) => Promise<void>;
  readonly #logger: Logger;
  readonly #websocketFactory: (endpoint: URL) => WebSocketLike;
  #socket: WebSocketLike | undefined;
  #heartbeatTimer: NodeJS.Timeout | undefined;
  #reconnectTimer: NodeJS.Timeout | undefined;
  #stopped = true;
  #authFailed = false;
  #reconnectDelayMs: number;
  #lastMessageAt = 0;

  constructor(options: TweetCatcherListenerOptions) {
    this.#config = options.config;
    this.#secretProvider = options.secretProvider;
    this.#onTweet = options.onTweet;
    this.#logger = options.logger ?? silentLogger;
    this.#websocketFactory = options.websocketFactory ?? ((endpoint) => new WebSocket(endpoint));
    this.#reconnectDelayMs = options.config.reconnectInitialDelayMs;
  }

  start(): void {
    if (!this.#stopped) {
      return;
    }
    this.#stopped = false;
    this.#authFailed = false;
    this.#logger.info("tweet_catcher.listener_started", { bounded_context: "user_tag_push" });
    this.#connect();
  }

  stop(): void {
    this.#stopped = true;
    this.#clearTimers();
    this.#socket?.close();
    this.#socket = undefined;
  }

  #connect(): void {
    if (this.#stopped) {
      return;
    }

    const endpoint = new URL(this.#config.websocketEndpoint);
    this.#lastMessageAt = Date.now();
    const socket = this.#websocketFactory(endpoint);
    this.#socket = socket;

    socket.addEventListener("open", () => {
      this.#reconnectDelayMs = this.#config.reconnectInitialDelayMs;
      this.#lastMessageAt = Date.now();
      this.#logger.info("tweet_catcher.connected", {
        endpoint: this.#config.websocketEndpoint,
        bounded_context: "user_tag_push"
      });
      this.#startHeartbeat();
    });

    socket.addEventListener("message", (event) => {
      this.#lastMessageAt = Date.now();
      void this.#handleMessage(event.data);
    });

    socket.addEventListener("close", () => {
      if (!this.#authFailed) {
        this.#logger.warn("tweet_catcher.disconnected", { bounded_context: "user_tag_push" });
      }
      this.#scheduleReconnect();
    });

    socket.addEventListener("error", () => {
      if (this.#authFailed) {
        return;
      }
      this.#logger.error("tweet_catcher.connection_error", {
        endpoint: this.#config.websocketEndpoint,
        bounded_context: "user_tag_push"
      });
      socket.close();
    });
  }

  #startHeartbeat(): void {
    if (this.#heartbeatTimer !== undefined) {
      clearInterval(this.#heartbeatTimer);
    }
    this.#heartbeatTimer = setInterval(() => {
      const elapsedMs = Date.now() - this.#lastMessageAt;
      if (elapsedMs > this.#config.heartbeatIntervalMs * 2) {
        this.#logger.warn("tweet_catcher.heartbeat_timeout", {
          elapsed_ms: elapsedMs,
          bounded_context: "user_tag_push"
        });
        this.#socket?.close();
        return;
      }
      this.#sendHeartbeat();
    }, this.#config.heartbeatIntervalMs);
  }

  #sendHeartbeat(): void {
    if (this.#socket?.readyState !== WebSocket.OPEN) {
      return;
    }
    this.#socket.send(JSON.stringify({ op: 1 }));
  }

  #scheduleReconnect(): void {
    if (this.#stopped) {
      return;
    }
    this.#clearHeartbeat();
    if (this.#reconnectTimer !== undefined) {
      return;
    }
    const delayMs = this.#reconnectDelayMs;
    this.#logger.warn("tweet_catcher.reconnecting", {
      delay_ms: delayMs,
      bounded_context: "user_tag_push"
    });
    this.#reconnectTimer = setTimeout(() => {
      this.#reconnectTimer = undefined;
      this.#reconnectDelayMs = Math.min(
        this.#reconnectDelayMs * 2,
        this.#config.reconnectMaxDelayMs
      );
      this.#connect();
    }, delayMs);
  }

  async #handleMessage(data: unknown): Promise<void> {
    const parsed = parseMessage(data);
    if (isHello(parsed)) {
      this.#logger.info("tweet_catcher.hello_received", {
        heartbeat_interval_ms: readHeartbeatIntervalMs(parsed),
        bounded_context: "user_tag_push"
      });
      this.#socket?.send(
        JSON.stringify({
          op: 2,
          token: await this.#secretProvider.getSecret(this.#config.apiKeySecretRef)
        })
      );
      this.#logger.info("tweet_catcher.identify_sent", { bounded_context: "user_tag_push" });
      return;
    }
    if (isAuthFailure(parsed)) {
      this.#logger.error("tweet_catcher.auth_failed", {
        message: readMessageText(parsed),
        bounded_context: "user_tag_push"
      });
      this.#authFailed = true;
      this.#stopped = true;
      this.#clearTimers();
      this.#socket?.close();
      this.#socket = undefined;
      return;
    }
    if (isReady(parsed)) {
      this.#logger.info("tweet_catcher.ready", { bounded_context: "user_tag_push" });
      return;
    }
    if (isHeartbeat(parsed)) {
      this.#logger.debug("tweet_catcher.heartbeat_received", { bounded_context: "user_tag_push" });
      return;
    }
    if (!isMonitorEvent(parsed)) {
      this.#logger.warn("tweet_catcher.message_skipped", {
        message: sanitizeControlMessage(parsed),
        bounded_context: "user_tag_push"
      });
      return;
    }
    this.#logger.info("tweet_catcher.message_received", {
      message: sanitizeControlMessage(parsed),
      bounded_context: "user_tag_push"
    });
    try {
      await this.#onTweet(parsed);
    } catch (error) {
      this.#logger.error("tweet_catcher.message_handle_failed", {
        error: normalizeError(error),
        bounded_context: "user_tag_push"
      });
    }
  }

  #clearTimers(): void {
    this.#clearHeartbeat();
    if (this.#reconnectTimer !== undefined) {
      clearTimeout(this.#reconnectTimer);
      this.#reconnectTimer = undefined;
    }
  }

  #clearHeartbeat(): void {
    if (this.#heartbeatTimer !== undefined) {
      clearInterval(this.#heartbeatTimer);
      this.#heartbeatTimer = undefined;
    }
  }
}

const parseMessage = (data: unknown): unknown => {
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }
  return data;
};

const isHeartbeat = (message: unknown): boolean => {
  if (message === null || typeof message !== "object") {
    return false;
  }
  const record = message as Readonly<Record<string, unknown>>;
  const type = record.type;
  return (
    record.op === 1 ||
    record.op === 11 ||
    type === "ping" ||
    type === "pong" ||
    type === "heartbeat"
  );
};

const isHello = (message: unknown): boolean =>
  message !== null &&
  typeof message === "object" &&
  (message as Readonly<Record<string, unknown>>).op === 10;

const isReady = (message: unknown): boolean =>
  message !== null &&
  typeof message === "object" &&
  ((message as Readonly<Record<string, unknown>>).op === 4 ||
    (message as Readonly<Record<string, unknown>>).type === "ready");

const isAuthFailure = (message: unknown): boolean =>
  message !== null &&
  typeof message === "object" &&
  (message as Readonly<Record<string, unknown>>).op === 3;

const isMonitorEvent = (message: unknown): boolean =>
  message !== null &&
  typeof message === "object" &&
  (message as Readonly<Record<string, unknown>>).op === 0;

const readHeartbeatIntervalMs = (message: unknown): number | undefined => {
  if (message === null || typeof message !== "object") {
    return undefined;
  }
  const record = message as Readonly<Record<string, unknown>>;
  const nested = record.d;
  if (nested !== null && typeof nested === "object") {
    const heartbeatInterval = (nested as Readonly<Record<string, unknown>>).heartbeat_interval;
    return typeof heartbeatInterval === "number" ? heartbeatInterval : undefined;
  }
  return undefined;
};

const readMessageText = (message: unknown): string | undefined => {
  if (message === null || typeof message !== "object") {
    return undefined;
  }
  const text = (message as Readonly<Record<string, unknown>>).text;
  return typeof text === "string" ? text : undefined;
};

const sanitizeControlMessage = (message: unknown): unknown => {
  if (message === null || typeof message !== "object" || Array.isArray(message)) {
    return message;
  }
  const copy: Record<string, unknown> = { ...(message as Record<string, unknown>) };
  delete copy["token"];
  return copy;
};

const normalizeError = (
  error: unknown
): {
  readonly name: string;
  readonly message: string;
} =>
  error instanceof Error
    ? { name: error.name, message: error.message }
    : { name: "UnknownError", message: String(error) };
