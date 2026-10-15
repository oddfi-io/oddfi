import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { loadOddAgentConfig } from "../src/infrastructure/config/load-odd-agent-config.js";
import { EnvSecretProvider } from "../src/infrastructure/secrets/env-secret-provider.js";

type TweetCatcherMessage = {
  readonly op?: number;
  readonly d?: unknown;
  readonly t?: string;
  readonly s?: number;
  readonly heartbeat_interval?: number;
  readonly [key: string]: unknown;
};

const workspaceRoot = resolve(new URL("..", import.meta.url).pathname);

const parseMessage = (raw: string): TweetCatcherMessage => {
  const parsed = JSON.parse(raw) as unknown;
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`unexpected Tweet Catcher payload: ${raw}`);
  }
  return parsed as TweetCatcherMessage;
};

const readHeartbeatIntervalMs = (message: TweetCatcherMessage): number => {
  const nestedInterval =
    message.d !== null &&
    typeof message.d === "object" &&
    !Array.isArray(message.d) &&
    "heartbeat_interval" in message.d
      ? (message.d as { readonly heartbeat_interval?: unknown }).heartbeat_interval
      : undefined;
  const interval = message.heartbeat_interval ?? nestedInterval;
  return typeof interval === "number" && Number.isFinite(interval) && interval > 0
    ? interval
    : 30_000;
};

const sanitizeForOutput = (message: TweetCatcherMessage): TweetCatcherMessage => {
  const clone: Record<string, unknown> = { ...message };
  delete clone["token"];
  return clone;
};

const main = async (): Promise<void> => {
  const config = await loadOddAgentConfig(workspaceRoot);
  const secretProvider = new EnvSecretProvider(config.localSecrets);
  const tweetCatcherConfig = config.tweetCatcher;
  const token = await secretProvider.getSecret(tweetCatcherConfig.apiKeySecretRef);
  const socket = new WebSocket(tweetCatcherConfig.websocketEndpoint);
  const startedAt = Date.now();
  const seenOps: number[] = [];
  let heartbeatTimer: NodeJS.Timeout | undefined;
  let readyMessage: TweetCatcherMessage | undefined;
  let firstMonitorEvent: TweetCatcherMessage | undefined;

  const cleanup = (): void => {
    if (heartbeatTimer !== undefined) {
      clearInterval(heartbeatTimer);
    }
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close(1000, "smoke complete");
    }
  };

  const readyPromise = new Promise<void>((resolveReady, rejectReady) => {
    const timeout = setTimeout(() => {
      rejectReady(
        new Error(
          `Tweet Catcher WebSocket did not become ready within ${tweetCatcherConfig.readyTimeoutMs}ms`
        )
      );
    }, tweetCatcherConfig.readyTimeoutMs);

    socket.addEventListener("error", () => {
      clearTimeout(timeout);
      rejectReady(new Error("Tweet Catcher WebSocket emitted an error"));
    });

    socket.addEventListener("close", (event) => {
      if (readyMessage === undefined) {
        clearTimeout(timeout);
        rejectReady(
          new Error(
            `Tweet Catcher WebSocket closed before ready: code=${event.code} reason=${event.reason}`
          )
        );
      }
    });

    socket.addEventListener("message", (event) => {
      const raw = typeof event.data === "string" ? event.data : String(event.data);
      const message = parseMessage(raw);
      if (typeof message.op === "number") {
        seenOps.push(message.op);
      }

      if (message.op === 10) {
        const heartbeatIntervalMs = readHeartbeatIntervalMs(message);
        socket.send(JSON.stringify({ op: 2, token }));
        heartbeatTimer = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ op: 1 }));
          }
        }, heartbeatIntervalMs);
        return;
      }

      if (message.op === 4) {
        readyMessage = message;
        clearTimeout(timeout);
        resolveReady();
        return;
      }

      if (message.op === 0 && firstMonitorEvent === undefined) {
        firstMonitorEvent = message;
      }
    });
  });

  try {
    await readyPromise;
    if (tweetCatcherConfig.eventWaitMs > 0) {
      await delay(tweetCatcherConfig.eventWaitMs);
    }
    const durationMs = Date.now() - startedAt;
    process.stdout.write(
      JSON.stringify(
        {
          ok: true,
          endpoint: tweetCatcherConfig.websocketEndpoint,
          duration_ms: durationMs,
          seen_ops: seenOps,
          ready: readyMessage === undefined ? undefined : sanitizeForOutput(readyMessage),
          first_monitor_event:
            firstMonitorEvent === undefined ? undefined : sanitizeForOutput(firstMonitorEvent)
        },
        null,
        2
      ) + "\n"
    );
  } finally {
    cleanup();
  }
};

await main();
