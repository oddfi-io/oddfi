import { z } from "zod";
import { silentLogger, type Logger } from "../../foundation/logger/logger-component.js";
import type { PushConfig } from "../../models/config/odd-agent-config-model.js";
import type { TagRecord } from "../../models/db/persistence-model.js";
import { AppError } from "../../shared/app-error.js";
import type { SecretProvider } from "../secrets/env-secret-provider.js";

const centrifugoPublishResponseSchema = z.object({
  error: z
    .object({
      code: z.number().optional(),
      message: z.string().optional()
    })
    .optional()
});

export type PublishTagTweetInput = {
  readonly traceId: string;
  readonly tag: TagRecord;
  readonly tweet: unknown;
};

export type PublishUserTweetInput = {
  readonly traceId: string;
  readonly userId: string;
  readonly tag: TagRecord;
  readonly tweet: unknown;
};

export class CentrifugoPublisher {
  readonly #config: PushConfig;
  readonly #secretProvider: SecretProvider;
  readonly #logger: Logger;

  constructor(options: {
    readonly config: PushConfig;
    readonly secretProvider: SecretProvider;
    readonly logger?: Logger;
  }) {
    this.#config = options.config;
    this.#secretProvider = options.secretProvider;
    this.#logger = options.logger ?? silentLogger;
  }

  /**
   * 调用流程：把命中推文发布到 tag 频道（历史/调试维度，保留）。
   * 入参：traceId / 命中 tag / 原始推文。
   * 出参：无；publish 失败抛 AppError 由调用方按 tag 维度兜底。
   */
  async publishTagTweet(input: PublishTagTweetInput): Promise<void> {
    const tagName = input.tag.langMetadata.en ?? String(input.tag.id);
    const channel = this.#config.channelTemplateTag.replace(
      "{tag_name}",
      normalizeTagName(tagName)
    );
    await this.#publish({
      channel,
      traceId: input.traceId,
      tag: input.tag,
      tweet: input.tweet
    });
  }

  /**
   * 调用流程：把命中推文 fan-out 到订阅者的个人频道 user#<user_id>。
   * 入参：traceId / 目标 userId（十进制字符串）/ 命中 tag / 原始推文。
   * 出参：无；publish 失败抛 AppError 由调用方按 user 维度兜底。
   * 频道：channelTemplateUser 替换 {user_id}，与主后端 token 授权频道逐字一致。
   * message body 与 publishTagTweet 完全一致，仅频道不同。
   */
  async publishUserTweet(input: PublishUserTweetInput): Promise<void> {
    const channel = buildUserChannel(this.#config.channelTemplateUser, input.userId);
    await this.#publish({
      channel,
      traceId: input.traceId,
      tag: input.tag,
      tweet: input.tweet
    });
  }

  /**
   * 调用流程：向指定 Centrifugo 频道发布 tag.tweet.matched 消息（tag / user 维度共用）。
   * 入参：目标 channel / traceId / 命中 tag / 原始推文。
   * 出参：无；HTTP 非 2xx 或返回体携带 error 时抛 AppError（5xx/429 标记 retryable）。
   */
  async #publish(args: {
    readonly channel: string;
    readonly traceId: string;
    readonly tag: TagRecord;
    readonly tweet: unknown;
  }): Promise<void> {
    const { channel } = args;
    const payload = {
      channel,
      data: {
        event: "tag.tweet.matched",
        trace_id: args.traceId,
        tag: {
          id: args.tag.id,
          category: args.tag.category,
          lang_metadata: args.tag.langMetadata
        },
        tweet: {
          raw: args.tweet
        },
        matched_at: new Date().toISOString()
      }
    };
    // tag_name 仅用于日志可读性，两个维度都取 tag 英文名兜底 tag id。
    const tagName = args.tag.langMetadata.en ?? String(args.tag.id);
    const startedAt = Date.now();
    this.#logger.info("tag_push.publish_started", {
      channel,
      tag_id: args.tag.id,
      tag_name: tagName,
      payload,
      bounded_context: "user_tag_push",
      request_trace_id: args.traceId
    });

    const apiKey = await this.#secretProvider.getSecret(this.#config.apiKeySecretRef);
    const response = await fetch(this.#config.endpoint, {
      method: "POST",
      headers: {
        authorization: `apikey ${apiKey}`,
        "x-api-key": apiKey,
        "content-type": "application/json",
        "x-trace-id": args.traceId
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      this.#logger.error("tag_push.publish_failed", {
        channel,
        tag_id: args.tag.id,
        status: response.status,
        response: {
          status_text: response.statusText
        },
        duration_ms: Date.now() - startedAt,
        bounded_context: "user_tag_push",
        request_trace_id: args.traceId
      });
      throw new AppError({
        code: "CENTRIFUGO_PUBLISH_FAILED",
        message: `centrifugo publish failed with status ${response.status}`,
        retryable: response.status >= 500 || response.status === 429,
        traceId: args.traceId
      });
    }

    const parsed = centrifugoPublishResponseSchema.parse(await response.json());
    if (parsed.error !== undefined) {
      this.#logger.error("tag_push.publish_failed", {
        channel,
        tag_id: args.tag.id,
        error: parsed.error,
        duration_ms: Date.now() - startedAt,
        bounded_context: "user_tag_push",
        request_trace_id: args.traceId
      });
      throw new AppError({
        code: "CENTRIFUGO_PUBLISH_FAILED",
        message: parsed.error.message ?? "centrifugo publish failed",
        retryable: true,
        traceId: args.traceId
      });
    }

    this.#logger.info("tag_push.publish_completed", {
      channel,
      tag_id: args.tag.id,
      response: parsed,
      duration_ms: Date.now() - startedAt,
      bounded_context: "user_tag_push",
      request_trace_id: args.traceId
    });
  }
}

export const normalizeTagName = (value: string): string => {
  const compact = value.trim().replace(/\s+/gu, "_");
  return compact.replace(/[^A-Za-z0-9_-]/gu, "_");
};

/**
 * 调用流程：用 user 频道模板拼出订阅者个人频道名。
 * 入参：channelTemplateUser 模板（含 {user_id} 占位）和十进制 user_id 字符串。
 * 出参：替换占位后的频道名，如 "user#42"，与主后端 token 授权频道逐字一致。
 */
export const buildUserChannel = (template: string, userId: string): string =>
  template.replace("{user_id}", userId);
