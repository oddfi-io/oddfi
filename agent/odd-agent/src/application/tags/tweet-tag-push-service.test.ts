import { describe, expect, it } from "vitest";
import { TweetTagPushService } from "./tweet-tag-push-service.js";
import { TweetCatcherListener } from "../../infrastructure/tweet-catcher/tweet-catcher-listener.js";
import type { TagRecord, TweetTagMatchRecord } from "../../models/db/persistence-model.js";

describe("TweetTagPushService", () => {
  it("stores each matched tweet by tag id, fans out to subscribers, then marks push", async () => {
    const tag = buildTag({ id: 10, category: "player", name: "Ronaldo" });
    const stored: unknown[] = [];
    const pushedIds: number[] = [];
    const published: PublishUserTweetCall[] = [];
    const service = new TweetTagPushService({
      tagSnapshotCache: {
        tags: [tag]
      } as never,
      tagMatchService: {
        matchText: () =>
          Promise.resolve({
            matched: true,
            matched_tags: [
              {
                id: 10,
                category: "player",
                lang_metadata: { en: "Ronaldo" }
              }
            ],
            llm_result: {
              code: 0,
              msg: "player=Ronaldo 匹配成功",
              data: ["Ronaldo"]
            }
          })
      } as never,
      tagRepository: {
        storeTweetTagMatch: (input: unknown) => {
          stored.push(input);
          return Promise.resolve(buildMatchRecord(99));
        },
        listUserIdsByTagIds: () => Promise.resolve(["42"]),
        markTweetTagMatchPushed: (id: number) => {
          pushedIds.push(id);
          return Promise.resolve();
        }
      } as never,
      publisher: {
        publishUserTweet: (input: PublishUserTweetCall) => {
          published.push(input);
          return Promise.resolve();
        }
      } as never
    });

    await service.handleTweet({
      id: "tweet_1",
      text: "Ronaldo scored again"
    });

    expect(stored).toHaveLength(1);
    const storedInput = stored[0] as {
      readonly traceId: string;
      readonly tweetId: string;
      readonly tag: TagRecord;
      readonly tweetPayload: Record<string, unknown>;
      readonly llmResult: Record<string, unknown>;
    };
    expect(storedInput.traceId).toHaveLength(36);
    expect(storedInput).toMatchObject({
      tweetId: "tweet_1",
      tag,
      tweetPayload: {
        id: "tweet_1",
        text: "Ronaldo scored again"
      },
      llmResult: {
        code: 0,
        msg: "player=Ronaldo 匹配成功",
        data: ["Ronaldo"]
      }
    });
    expect(published).toHaveLength(1);
    expect(published[0]?.userId).toBe("42");
    expect(published[0]?.tag).toBe(tag);
    expect(pushedIds).toEqual([99]);
  });

  it("fans out one matched tweet to every subscriber on their own user channel", async () => {
    const tag = buildTag({ id: 10, category: "player", name: "Ronaldo" });
    const published: PublishUserTweetCall[] = [];
    const pushedIds: number[] = [];
    const lookedUpTagIds: readonly number[][] = [];
    const service = new TweetTagPushService({
      tagSnapshotCache: { tags: [tag] } as never,
      tagMatchService: {
        matchText: () =>
          Promise.resolve({
            matched: true,
            matched_tags: [{ id: 10, category: "player", lang_metadata: { en: "Ronaldo" } }],
            llm_result: { code: 0, msg: "matched", data: ["Ronaldo"] }
          })
      } as never,
      tagRepository: {
        storeTweetTagMatch: () => Promise.resolve(buildMatchRecord(200)),
        listUserIdsByTagIds: (tagIds: readonly number[]) => {
          (lookedUpTagIds as number[][]).push([...tagIds]);
          return Promise.resolve(["1", "2", "3"]);
        },
        markTweetTagMatchPushed: (id: number) => {
          pushedIds.push(id);
          return Promise.resolve();
        }
      } as never,
      publisher: {
        publishUserTweet: (input: PublishUserTweetCall) => {
          published.push(input);
          return Promise.resolve();
        }
      } as never
    });

    await service.handleTweet({ id: "tweet_multi", text: "Ronaldo scored again" });

    expect(lookedUpTagIds).toEqual([[10]]);
    expect(published.map((call) => call.userId)).toEqual(["1", "2", "3"]);
    expect(published.every((call) => call.tag === tag)).toBe(true);
    // 3 个订阅者命中同一 tag，markPushed 只对该 tag 的 match 调一次。
    expect(pushedIds).toEqual([200]);
  });

  it("stores the match but skips publish and mark when no one subscribes the tag", async () => {
    const tag = buildTag({ id: 10, category: "player", name: "Ronaldo" });
    const stored: unknown[] = [];
    const published: PublishUserTweetCall[] = [];
    const pushedIds: number[] = [];
    const service = new TweetTagPushService({
      tagSnapshotCache: { tags: [tag] } as never,
      tagMatchService: {
        matchText: () =>
          Promise.resolve({
            matched: true,
            matched_tags: [{ id: 10, category: "player", lang_metadata: { en: "Ronaldo" } }],
            llm_result: { code: 0, msg: "matched", data: ["Ronaldo"] }
          })
      } as never,
      tagRepository: {
        storeTweetTagMatch: (input: unknown) => {
          stored.push(input);
          return Promise.resolve(buildMatchRecord(300));
        },
        listUserIdsByTagIds: () => Promise.resolve([]),
        markTweetTagMatchPushed: (id: number) => {
          pushedIds.push(id);
          return Promise.resolve();
        }
      } as never,
      publisher: {
        publishUserTweet: (input: PublishUserTweetCall) => {
          published.push(input);
          return Promise.resolve();
        }
      } as never
    });

    await service.handleTweet({ id: "tweet_orphan", text: "Ronaldo scored again" });

    // match 记录必须落库；无订阅者时不 publish、不 markPushed。
    expect(stored).toHaveLength(1);
    expect(published).toHaveLength(0);
    expect(pushedIds).toEqual([]);
  });

  it("dedups a subscriber to one push per tweet when they subscribe multiple matched tags", async () => {
    const ronaldo = buildTag({ id: 10, category: "player", name: "Ronaldo" });
    const portugal = buildTag({ id: 20, category: "country", name: "Portugal" });
    const published: PublishUserTweetCall[] = [];
    const pushedIds: number[] = [];
    const service = new TweetTagPushService({
      tagSnapshotCache: { tags: [ronaldo, portugal] } as never,
      tagMatchService: {
        matchText: () =>
          Promise.resolve({
            matched: true,
            matched_tags: [
              { id: 10, category: "player", lang_metadata: { en: "Ronaldo" } },
              { id: 20, category: "country", lang_metadata: { en: "Portugal" } }
            ],
            llm_result: { code: 0, msg: "matched", data: ["Ronaldo", "Portugal"] }
          })
      } as never,
      tagRepository: {
        storeTweetTagMatch: (input: { readonly tag: TagRecord }) =>
          Promise.resolve(buildMatchRecord(input.tag.id === 10 ? 410 : 420)),
        // user "7" 同时订阅了两个命中 tag；user "8" 只订阅 Portugal。
        listUserIdsByTagIds: (tagIds: readonly number[]) =>
          Promise.resolve(tagIds[0] === 10 ? ["7"] : ["7", "8"]),
        markTweetTagMatchPushed: (id: number) => {
          pushedIds.push(id);
          return Promise.resolve();
        }
      } as never,
      publisher: {
        publishUserTweet: (input: PublishUserTweetCall) => {
          published.push(input);
          return Promise.resolve();
        }
      } as never
    });

    await service.handleTweet({ id: "tweet_dedup", text: "Ronaldo and Portugal won" });

    // user 7 命中两个 tag，但单条推文只收一次，附首个命中 tag（Ronaldo, id=10）。
    const sevenPushes = published.filter((call) => call.userId === "7");
    expect(sevenPushes).toHaveLength(1);
    expect(sevenPushes[0]?.tag.id).toBe(10);
    // user 8 只订阅 Portugal，收一次附 Portugal。
    const eightPushes = published.filter((call) => call.userId === "8");
    expect(eightPushes).toHaveLength(1);
    expect(eightPushes[0]?.tag.id).toBe(20);
    expect(published).toHaveLength(2);
    // 两个 tag 各至少推给一个订阅者，两个 match 都 markPushed。
    expect([...pushedIds].sort((a, b) => a - b)).toEqual([410, 420]);
  });

  it("accepts a Tweet Catcher monitor event, matches tags, stores it, and fans out", async () => {
    const socket = new FakeWebSocket();
    const tag = buildTag({ id: 10, category: "player", name: "Ronaldo" });
    const matchedTexts: string[] = [];
    const stored: unknown[] = [];
    const published: PublishUserTweetCall[] = [];
    const pushedIds: number[] = [];
    const service = new TweetTagPushService({
      tagSnapshotCache: {
        tags: [tag]
      } as never,
      tagMatchService: {
        matchText: (input: { readonly text: string }) => {
          matchedTexts.push(input.text);
          return Promise.resolve({
            matched: true,
            matched_tags: [
              {
                id: 10,
                category: "player",
                lang_metadata: { en: "Ronaldo" }
              }
            ],
            llm_result: {
              code: 0,
              msg: "player=Ronaldo matched",
              data: ["Ronaldo"]
            }
          });
        }
      } as never,
      tagRepository: {
        storeTweetTagMatch: (input: unknown) => {
          stored.push(input);
          return Promise.resolve(buildMatchRecord(101));
        },
        listUserIdsByTagIds: () => Promise.resolve(["55"]),
        markTweetTagMatchPushed: (id: number) => {
          pushedIds.push(id);
          return Promise.resolve();
        }
      } as never,
      publisher: {
        publishUserTweet: (input: PublishUserTweetCall) => {
          published.push(input);
          return Promise.resolve();
        }
      } as never
    });
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
      onTweet: (tweet) => service.handleTweet(tweet),
      websocketFactory: () => socket
    });

    listener.start();
    socket.emit("open", {});
    socket.emit("message", { data: JSON.stringify({ op: 10, d: { heartbeat_interval: 30_000 } }) });
    socket.emit("message", { data: JSON.stringify({ op: 4 }) });
    socket.emit("message", {
      data: JSON.stringify({
        op: 0,
        d: {
          event_id: "event_1",
          data: {
            id: "tweet_2",
            text: "Ronaldo scored again in stoppage time"
          }
        }
      })
    });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(socket.sent).toContain(JSON.stringify({ op: 2, token: "secret-token" }));
    expect(matchedTexts).toEqual(["Ronaldo scored again in stoppage time"]);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      tweetId: "tweet_2",
      tag,
      llmResult: {
        code: 0,
        data: ["Ronaldo"]
      }
    });
    expect(published).toHaveLength(1);
    expect(published[0]?.userId).toBe("55");
    expect(pushedIds).toEqual([101]);
    listener.stop();
  });
});

type PublishUserTweetCall = {
  readonly traceId: string;
  readonly userId: string;
  readonly tag: TagRecord;
  readonly tweet: unknown;
};

const buildTag = (input: {
  readonly id: number;
  readonly category: string;
  readonly name: string;
}): TagRecord => ({
  id: input.id,
  category: input.category,
  langMetadata: {
    en: input.name
  },
  sortOrder: 0,
  createdAt: "2026-05-19T00:00:00.000Z",
  updatedAt: "2026-05-19T00:00:00.000Z"
});

const buildMatchRecord = (id: number): TweetTagMatchRecord => ({
  id,
  traceId: "trace_test",
  tweetId: "tweet_1",
  tagId: 10,
  tagCategory: "player",
  tagLangMetadata: { en: "Ronaldo" },
  tweetPayload: { id: "tweet_1" },
  llmResult: {
    code: 0
  },
  createdAt: "2026-05-19T00:00:00.000Z",
  updatedAt: "2026-05-19T00:00:00.000Z"
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
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  emit(type: "open" | "message" | "close" | "error", event: { readonly data?: unknown }): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}
