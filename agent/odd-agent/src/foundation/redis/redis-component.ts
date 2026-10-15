import { Redis } from "ioredis";
import type {
  FoundationComponent,
  FoundationHealth,
  FoundationInitDeps
} from "../foundation-types.js";
import {
  createFoundationError,
  normalizeError,
  nowIso,
  requireFoundationLogger,
  resolveSecret
} from "../foundation-types.js";
import type { LoggerComponent } from "../logger/logger-component.js";

export type RedisConfig = {
  readonly urlSecretRef: string;
  readonly keyPrefix: string;
  readonly commandTimeoutMs: number;
  readonly maxRetries: number;
  readonly defaultTtlSeconds?: number;
};

export type RedisSetOptions = {
  readonly ttlSeconds?: number;
  readonly nx?: boolean;
};

export class FoundationRedis implements FoundationComponent<RedisConfig> {
  #config: RedisConfig | undefined;
  #client: Redis | undefined;
  #logger: LoggerComponent | undefined;

  async init(config: RedisConfig, deps?: FoundationInitDeps): Promise<void> {
    const logger = requireFoundationLogger("redis", deps);
    this.#logger = logger;
    const startedAt = Date.now();
    logger.info("foundation.redis.init_started", {
      key_prefix: config.keyPrefix,
      command_timeout_ms: config.commandTimeoutMs,
      component: "redis"
    });
    try {
      const redisUrl = await resolveSecret("redis", deps, config.urlSecretRef);
      this.#config = config;
      const client = new Redis(redisUrl, {
        commandTimeout: config.commandTimeoutMs,
        maxRetriesPerRequest: config.maxRetries,
        lazyConnect: true,
        retryStrategy: (attempt: number) =>
          attempt > config.maxRetries ? null : Math.min(attempt * 100, config.commandTimeoutMs)
      });
      client.on("error", (error) => {
        this.#logger?.error("foundation.redis.client_error", {
          error: normalizeError(error),
          component: "redis"
        });
      });
      this.#client = client;
      await client.connect();
      await this.ping();
      logger.info("foundation.redis.init_succeeded", {
        duration_ms: Date.now() - startedAt,
        component: "redis"
      });
    } catch (cause) {
      logger.error("foundation.redis.init_failed", {
        duration_ms: Date.now() - startedAt,
        error: normalizeError(cause),
        component: "redis"
      });
      await this.close();
      throw createFoundationError({
        component: "redis",
        code: "FOUNDATION_REDIS_INIT_FAILED",
        message: "redis init failed",
        retryable: true,
        cause
      });
    }
  }

  async get<T>(key: string): Promise<T | undefined> {
    const result = await this.#command<string | null>("GET", key, () =>
      this.#requireClient().get(this.#buildKey(key))
    );
    if (result === null) {
      return undefined;
    }
    try {
      return JSON.parse(result) as T;
    } catch (cause) {
      throw createFoundationError({
        component: "redis",
        code: "FOUNDATION_REDIS_JSON_PARSE_FAILED",
        message: `redis value is not valid JSON for key ${key}`,
        retryable: false,
        cause
      });
    }
  }

  async set<T>(key: string, value: T, options: RedisSetOptions = {}): Promise<boolean> {
    const config = this.#requireConfig();
    const ttl = options.ttlSeconds ?? config.defaultTtlSeconds;
    const result = await this.#command<"OK" | null>(
      "SET",
      key,
      () => {
        if (ttl !== undefined && options.nx === true) {
          return this.#requireClient().set(
            this.#buildKey(key),
            JSON.stringify(value),
            "EX",
            ttl,
            "NX"
          );
        }
        if (ttl !== undefined) {
          return this.#requireClient().set(this.#buildKey(key), JSON.stringify(value), "EX", ttl);
        }
        if (options.nx === true) {
          return this.#requireClient().set(this.#buildKey(key), JSON.stringify(value), "NX");
        }
        return this.#requireClient().set(this.#buildKey(key), JSON.stringify(value));
      },
      ttl
    );
    return result === "OK";
  }

  async del(key: string): Promise<number> {
    return await this.#command<number>("DEL", key, () =>
      this.#requireClient().del(this.#buildKey(key))
    );
  }

  async lpush<T>(key: string, values: readonly T[]): Promise<number> {
    if (values.length === 0) {
      return 0;
    }
    return await this.#command<number>("LPUSH", key, () =>
      this.#requireClient().lpush(
        this.#buildKey(key),
        ...values.map((value) => JSON.stringify(value))
      )
    );
  }

  async lrange<T>(key: string, start: number, stop: number): Promise<readonly T[]> {
    const result = await this.#command<string[]>("LRANGE", key, () =>
      this.#requireClient().lrange(this.#buildKey(key), start, stop)
    );
    return result.map((item) => JSON.parse(item) as T);
  }

  async ltrim(key: string, start: number, stop: number): Promise<void> {
    await this.#command<"OK">("LTRIM", key, () =>
      this.#requireClient().ltrim(this.#buildKey(key), start, stop)
    );
  }

  async ping(): Promise<"PONG"> {
    const result = await this.#command<string>("PING", "system:ping", () =>
      this.#requireClient().ping()
    );
    if (result !== "PONG") {
      throw new Error("redis ping did not return PONG");
    }
    return "PONG";
  }

  async healthCheck(): Promise<FoundationHealth> {
    try {
      await this.ping();
      return { status: "healthy", message: "redis ping ok", checkedAt: nowIso() };
    } catch (cause) {
      return {
        status: "unhealthy",
        message: cause instanceof Error ? cause.message : "redis health check failed",
        checkedAt: nowIso()
      };
    }
  }

  async close(): Promise<void> {
    const client = this.#client;
    this.#client = undefined;
    this.#config = undefined;
    if (client !== undefined) {
      client.disconnect();
    }
    await Promise.resolve();
  }

  #buildKey(key: string): string {
    return `${this.#requireConfig().keyPrefix}:${key}`;
  }

  async #command<T>(
    commandName: string,
    key: string,
    command: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    const startedAt = Date.now();
    this.#logger?.debug("foundation.redis.command_started", {
      command: commandName,
      key,
      ttl_seconds: ttlSeconds,
      component: "redis"
    });
    try {
      const value = await command();
      this.#logger?.debug("foundation.redis.command_succeeded", {
        command: commandName,
        key,
        duration_ms: Date.now() - startedAt,
        component: "redis"
      });
      return value;
    } catch (cause) {
      this.#logger?.error("foundation.redis.command_failed", {
        command: commandName,
        key,
        duration_ms: Date.now() - startedAt,
        error: normalizeError(cause),
        component: "redis"
      });
      throw createFoundationError({
        component: "redis",
        code: "FOUNDATION_REDIS_COMMAND_FAILED",
        message: `redis command failed: ${commandName}`,
        retryable: true,
        cause
      });
    }
  }

  #requireConfig(): RedisConfig {
    if (this.#config === undefined) {
      throw createFoundationError({
        component: "redis",
        code: "FOUNDATION_NOT_INITIALIZED",
        message: "redis is not initialized",
        retryable: false
      });
    }
    return this.#config;
  }

  #requireClient(): Redis {
    if (this.#client === undefined) {
      throw createFoundationError({
        component: "redis",
        code: "FOUNDATION_NOT_INITIALIZED",
        message: "redis is not initialized",
        retryable: false
      });
    }
    return this.#client;
  }
}
