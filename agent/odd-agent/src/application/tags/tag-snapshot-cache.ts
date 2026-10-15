import { silentLogger, type Logger } from "../../foundation/logger/logger-component.js";
import type { TagRecord } from "../../models/db/persistence-model.js";
import type { PostgresTagRepository } from "../../infrastructure/tags/postgres-tag-repository.js";

export type TagSnapshotCacheOptions = {
  readonly tagRepository: PostgresTagRepository;
  readonly refreshIntervalMs: number;
  readonly logger?: Logger;
};

export class TagSnapshotCache {
  readonly #tagRepository: PostgresTagRepository;
  readonly #refreshIntervalMs: number;
  readonly #logger: Logger;
  #tags: readonly TagRecord[] = [];
  #timer: NodeJS.Timeout | undefined;
  #isRefreshing = false;

  constructor(options: TagSnapshotCacheOptions) {
    this.#tagRepository = options.tagRepository;
    this.#refreshIntervalMs = options.refreshIntervalMs;
    this.#logger = options.logger ?? silentLogger;
  }

  get tags(): readonly TagRecord[] {
    return this.#tags;
  }

  async start(): Promise<void> {
    await this.refresh();
    this.#timer = setInterval(() => {
      void this.refresh();
    }, this.#refreshIntervalMs);
  }

  stop(): void {
    if (this.#timer !== undefined) {
      clearInterval(this.#timer);
      this.#timer = undefined;
    }
  }

  async refresh(): Promise<void> {
    if (this.#isRefreshing) {
      this.#logger.debug("tag_snapshot.refresh_skipped", {
        reason: "already_refreshing",
        bounded_context: "user_tag_push"
      });
      return;
    }
    this.#isRefreshing = true;
    const startedAt = Date.now();
    this.#logger.info("tag_snapshot.refresh_started", { bounded_context: "user_tag_push" });
    try {
      const tags = await this.#tagRepository.listActiveByCategories(["country", "player"]);
      this.#tags = tags;
      this.#logger.info("tag_snapshot.refresh_completed", {
        tag_count: tags.length,
        duration_ms: Date.now() - startedAt,
        bounded_context: "user_tag_push"
      });
    } catch (error) {
      this.#logger.error("tag_snapshot.refresh_failed", {
        duration_ms: Date.now() - startedAt,
        error: normalizeError(error),
        bounded_context: "user_tag_push"
      });
    } finally {
      this.#isRefreshing = false;
    }
  }
}

const normalizeError = (
  error: unknown
): {
  readonly name: string;
  readonly message: string;
} =>
  error instanceof Error
    ? { name: error.name, message: error.message }
    : { name: "UnknownError", message: String(error) };
