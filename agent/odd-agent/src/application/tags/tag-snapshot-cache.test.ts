import { describe, expect, it } from "vitest";
import { TagSnapshotCache } from "./tag-snapshot-cache.js";
import { InMemoryLogger } from "../../foundation/logger/logger-component.js";
import type { TagRecord } from "../../models/db/persistence-model.js";

describe("TagSnapshotCache", () => {
  it("skips overlapping refresh calls so stale work cannot overwrite newer snapshots", async () => {
    let releaseFirstRefresh: (() => void) | undefined;
    let listCalls = 0;
    const cache = new TagSnapshotCache({
      refreshIntervalMs: 1_000,
      logger: new InMemoryLogger(),
      tagRepository: {
        listActiveByCategories: () => {
          listCalls += 1;
          return new Promise<readonly TagRecord[]>((resolve) => {
            releaseFirstRefresh = () =>
              resolve([buildTag({ id: 1, category: "country", name: "England" })]);
          });
        }
      } as never
    });

    const first = cache.refresh();
    await cache.refresh();
    releaseFirstRefresh?.();
    await first;

    expect(listCalls).toBe(1);
    expect(cache.tags.map((tag) => tag.id)).toEqual([1]);
  });
});

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
