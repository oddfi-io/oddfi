import { randomUUID } from "node:crypto";
import { silentLogger, type Logger } from "../../foundation/logger/logger-component.js";
import type { MatchTextRequest } from "../../models/http/user-tag-dto-model.js";
import type { TagRecord } from "../../models/db/persistence-model.js";
import type { TagMatchService } from "./tag-match-service.js";
import type { TagSnapshotCache } from "./tag-snapshot-cache.js";
import type { CentrifugoPublisher } from "../../infrastructure/push/centrifugo-publisher.js";
import type { PostgresTagRepository } from "../../infrastructure/tags/postgres-tag-repository.js";

export type TweetTagPushServiceOptions = {
  readonly tagSnapshotCache: TagSnapshotCache;
  readonly tagMatchService: TagMatchService;
  readonly publisher: CentrifugoPublisher;
  readonly tagRepository: PostgresTagRepository;
  readonly logger?: Logger;
};

export class TweetTagPushService {
  readonly #tagSnapshotCache: TagSnapshotCache;
  readonly #tagMatchService: TagMatchService;
  readonly #publisher: CentrifugoPublisher;
  readonly #tagRepository: PostgresTagRepository;
  readonly #logger: Logger;

  constructor(options: TweetTagPushServiceOptions) {
    this.#tagSnapshotCache = options.tagSnapshotCache;
    this.#tagMatchService = options.tagMatchService;
    this.#publisher = options.publisher;
    this.#tagRepository = options.tagRepository;
    this.#logger = options.logger ?? silentLogger;
  }

  async handleTweet(tweet: unknown): Promise<void> {
    const traceId = readTweetTraceId(tweet) ?? randomUUID();
    const tweetPayload = toTweetPayload(tweet);
    const tweetId = readTweetId(tweet) ?? "";
    const text = extractTweetText(tweet);
    this.#logger.info("tweet_catcher.tweet_received", {
      tweet_id: tweetId,
      tweet_text: text,
      tweet: {
        raw: tweetPayload
      },
      bounded_context: "user_tag_push",
      request_trace_id: traceId
    });
    const tags = this.#tagSnapshotCache.tags;
    if (tags.length === 0 || text.trim().length === 0) {
      this.#logger.debug("tag_match.skipped", {
        reason: tags.length === 0 ? "empty_tag_snapshot" : "empty_tweet_text",
        tag_count: tags.length,
        bounded_context: "user_tag_push",
        request_trace_id: traceId
      });
      return;
    }

    const countryTagIds = tags.filter((tag) => tag.category === "country").map((tag) => tag.id);
    const playerTagIds = tags.filter((tag) => tag.category === "player").map((tag) => tag.id);
    const groups: MatchTextRequest["rules"]["groups"] = [];
    if (countryTagIds.length > 0) {
      groups.push({ operator: "or", tag_ids: countryTagIds });
    }
    if (playerTagIds.length > 0) {
      groups.push({ operator: "or", tag_ids: playerTagIds });
    }
    if (groups.length === 0) {
      return;
    }

    const match = await this.#tagMatchService.matchText({
      text,
      locale: "en",
      rules: {
        operator: "or",
        groups
      },
      traceId
    });
    if (!match.matched) {
      this.#logger.info("tag_match.no_match", {
        tweet_id: tweetId,
        bounded_context: "user_tag_push",
        request_trace_id: traceId
      });
      return;
    }

    // 先把命中 tag 全部落库（match 记录与是否有订阅者无关），
    // 同时收集「该 tag → 落库 match id」，供 fan-out 后按需 markPushed。
    const tagById = new Map(tags.map((tag) => [tag.id, tag]));
    const matchedTags: TagRecord[] = [];
    const matchIdByTagId = new Map<number, number>();
    for (const matchedTag of match.matched_tags) {
      const tag = tagById.get(matchedTag.id);
      if (tag === undefined) {
        continue;
      }
      try {
        const matchRecord = await this.#tagRepository.storeTweetTagMatch({
          traceId,
          tweetId,
          tag,
          tweetPayload,
          llmResult: match.llm_result
        });
        this.#logger.info("tweet_tag_match.stored", {
          tweet_tag_match_id: matchRecord.id,
          tweet_id: tweetId,
          tag_id: tag.id,
          llm_result: match.llm_result,
          bounded_context: "user_tag_push",
          request_trace_id: traceId
        });
        matchedTags.push(tag);
        matchIdByTagId.set(tag.id, matchRecord.id);
      } catch (error) {
        // 落库失败只影响该 tag，其他命中 tag 继续。
        this.#logger.error("tweet_tag_match.store_failed", {
          tweet_id: tweetId,
          tag_id: tag.id,
          error: normalizeError(error),
          bounded_context: "user_tag_push",
          request_trace_id: traceId
        });
      }
    }
    if (matchedTags.length === 0) {
      return;
    }

    // 单条推文范围内对 user 去重：同一 user 订阅了多个命中 tag 也只推一次，
    // 附其首个命中 tag（matchedTags 顺序即 LLM 命中顺序）。前端再按 tweet_id 去重兜底。
    const userToTag = new Map<string, TagRecord>();
    for (const tag of matchedTags) {
      let userIds: readonly string[];
      try {
        userIds = await this.#tagRepository.listUserIdsByTagIds([tag.id]);
      } catch (error) {
        // 反查失败只影响该 tag 的 fan-out，其他 tag 继续。
        this.#logger.error("tag_push.subscriber_lookup_failed", {
          tweet_id: tweetId,
          tag_id: tag.id,
          error: normalizeError(error),
          bounded_context: "user_tag_push",
          request_trace_id: traceId
        });
        continue;
      }
      for (const userId of userIds) {
        if (!userToTag.has(userId)) {
          userToTag.set(userId, tag);
        }
      }
    }

    // 无任何订阅者：match 已落库，但没有真实推送，不 markPushed（pushed_at 语义=确有推送）。
    if (userToTag.size === 0) {
      this.#logger.info("tag_push.no_subscribers", {
        tweet_id: tweetId,
        matched_tag_ids: matchedTags.map((tag) => tag.id),
        bounded_context: "user_tag_push",
        request_trace_id: traceId
      });
      return;
    }

    // 逐个 user fan-out 到其个人频道 user#<id>；某 user 失败只影响该 user，不阻断其余。
    // O(N) fan-out：热门 tag 多订阅者会产生多次 publish，见交付说明的可选 batch 优化。
    const pushedTagIds = new Set<number>();
    for (const [userId, tag] of userToTag) {
      try {
        await this.#publisher.publishUserTweet({ traceId, userId, tag, tweet });
        pushedTagIds.add(tag.id);
      } catch (error) {
        this.#logger.error("tag_push.publish_failed", {
          tweet_id: tweetId,
          tag_id: tag.id,
          error: normalizeError(error),
          bounded_context: "user_tag_push",
          request_trace_id: traceId
        });
      }
    }

    // 至少有 1 个订阅者成功收到该 tag 的推文时才 markPushed。
    for (const tagId of pushedTagIds) {
      const matchId = matchIdByTagId.get(tagId);
      if (matchId === undefined) {
        continue;
      }
      try {
        await this.#tagRepository.markTweetTagMatchPushed(matchId);
      } catch (error) {
        this.#logger.error("tweet_tag_match.mark_pushed_failed", {
          tweet_id: tweetId,
          tag_id: tagId,
          error: normalizeError(error),
          bounded_context: "user_tag_push",
          request_trace_id: traceId
        });
      }
    }
  }
}

const extractTweetText = (tweet: unknown): string => {
  if (typeof tweet === "string") {
    return tweet;
  }
  if (tweet !== null && typeof tweet === "object") {
    const record = tweet as Readonly<Record<string, unknown>>;
    const candidates = [
      readNestedString(record, ["d", "data", "text"]),
      record.text,
      record.full_text,
      record.content,
      record.body
    ];
    const text = candidates.find((candidate) => typeof candidate === "string");
    if (typeof text === "string") {
      return text;
    }
  }
  return JSON.stringify(tweet);
};

const toTweetPayload = (tweet: unknown): Record<string, unknown> => {
  if (tweet !== null && typeof tweet === "object" && !Array.isArray(tweet)) {
    return tweet as Record<string, unknown>;
  }
  return {
    value: tweet
  };
};

const readTweetTraceId = (tweet: unknown): string | undefined => readTweetString(tweet, "trace_id");

const readTweetId = (tweet: unknown): string | undefined =>
  readTweetString(tweet, "id") ??
  readTweetString(tweet, "tweet_id") ??
  readNestedString(tweet, ["d", "data", "id"]) ??
  readNestedString(tweet, ["d", "event_id"]);

const readTweetString = (tweet: unknown, key: string): string | undefined => {
  if (tweet === null || typeof tweet !== "object") {
    return undefined;
  }
  const value = (tweet as Readonly<Record<string, unknown>>)[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

const readNestedString = (value: unknown, path: readonly string[]): string | undefined => {
  let current: unknown = value;
  for (const key of path) {
    if (current === null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Readonly<Record<string, unknown>>)[key];
  }
  return typeof current === "string" && current.length > 0 ? current : undefined;
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
