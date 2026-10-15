import { describe, expect, it } from "vitest";
import { TweetCatcherListener } from "./tweet-catcher-listener.js";

describe("TweetCatcherListener", () => {
  it("identifies after hello and forwards monitor events", async () => {
    const socket = new FakeWebSocket();
    const tweets: unknown[] = [];
    const listener = new TweetCatcherListener({
      config: {
        websocketEndpoint: "wss://example.test/websocket",
        apiKeySecretRef: "TWEET_KEY",
        readyTimeoutMs: 1000,
        eventWaitMs: 0,
        heartbeatIntervalMs: 10_000,
        reconnectInitialDelayMs: 100,
        reconnectMaxDelayMs: 1000
      },
      secretProvider: {
        getSecret: () => Promise.resolve("secret-token")
      },
      onTweet: (tweet) => {
        tweets.push(tweet);
        return Promise.resolve();
      },
      websocketFactory: () => socket
    });

    listener.start();
    socket.emit("open", {});
    socket.emit("message", { data: JSON.stringify({ op: 10, d: { heartbeat_interval: 30000 } }) });
    socket.emit("message", { data: JSON.stringify({ op: 4 }) });
    socket.emit("message", { data: JSON.stringify({ op: 0, text: "Ronaldo scored" }) });
    await Promise.resolve();

    expect(socket.sent).toContain(JSON.stringify({ op: 2, token: "secret-token" }));
    expect(tweets).toEqual([{ op: 0, text: "Ronaldo scored" }]);
    listener.stop();
  });

  it("does not forward authentication failures as tweets", async () => {
    const socket = new FakeWebSocket();
    const tweets: unknown[] = [];
    const listener = new TweetCatcherListener({
      config: {
        websocketEndpoint: "wss://example.test/websocket",
        apiKeySecretRef: "TWEET_KEY",
        readyTimeoutMs: 1000,
        eventWaitMs: 0,
        heartbeatIntervalMs: 10_000,
        reconnectInitialDelayMs: 100,
        reconnectMaxDelayMs: 1000
      },
      secretProvider: {
        getSecret: () => Promise.resolve("bad-token")
      },
      onTweet: (tweet) => {
        tweets.push(tweet);
        return Promise.resolve();
      },
      websocketFactory: () => socket
    });

    listener.start();
    socket.emit("open", {});
    socket.emit("message", { data: JSON.stringify({ op: 10, d: { heartbeat_interval: 30000 } }) });
    socket.emit("message", { data: JSON.stringify({ op: 3, text: "Failed to login" }) });
    socket.emit("close", {});
    await Promise.resolve();

    expect(tweets).toEqual([]);
    expect(socket.readyState).toBe(3);
    listener.stop();
  });
});

class FakeWebSocket {
  static readonly OPEN = 1;
  readyState = 1;
  readonly sent: string[] = [];
  readonly listeners = new Map<string, ((event: { readonly data?: unknown }) => void)[]>();

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = 3;
  }

  addEventListener(
    type: "open" | "message" | "close" | "error",
    listener: (event: { readonly data?: unknown }) => void
  ): void {
    const existing = this.listeners.get(type) ?? [];
    existing.push(listener);
    this.listeners.set(type, existing);
  }

  emit(type: "open" | "message" | "close" | "error", event: { readonly data?: unknown }): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}
