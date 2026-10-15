import { describe, expect, it } from "vitest";
import { InMemoryLogger } from "../logger/logger-component.js";
import { FoundationRedis } from "./redis-component.js";

const redisUrl = process.env["ODD_AGENT_TEST_REDIS_URL"] ?? "redis://127.0.0.1:56379";

describe("FoundationRedis", () => {
  it("requires logger for init", async () => {
    const redis = new FoundationRedis();
    await expect(
      redis.init({
        urlSecretRef: "REDIS_URL",
        keyPrefix: "odd_agent_test",
        commandTimeoutMs: 500,
        maxRetries: 0
      })
    ).rejects.toThrow(/requires logger/);
  });

  it.runIf(process.env["ODD_AGENT_REDIS_E2E"] === "1")(
    "stores JSON values and lists against Redis",
    async () => {
      const redis = new FoundationRedis();
      await redis.init(
        {
          urlSecretRef: "REDIS_URL",
          keyPrefix: `odd_agent_test:${Date.now()}`,
          commandTimeoutMs: 2_000,
          maxRetries: 1,
          defaultTtlSeconds: 60
        },
        {
          logger: new InMemoryLogger(),
          secretProvider: { getSecret: () => Promise.resolve(redisUrl) }
        }
      );
      try {
        expect(await redis.ping()).toBe("PONG");
        expect(await redis.set("item", { ok: true }, { nx: true })).toBe(true);
        expect(await redis.set("item", { ok: false }, { nx: true })).toBe(false);
        expect(await redis.get("item")).toEqual({ ok: true });
        expect(await redis.lpush("list", [{ id: 1 }, { id: 2 }])).toBe(2);
        expect(await redis.lrange("list", 0, 1)).toEqual([{ id: 2 }, { id: 1 }]);
        expect(await redis.del("item")).toBe(1);
      } finally {
        await redis.close();
      }
    }
  );
});
