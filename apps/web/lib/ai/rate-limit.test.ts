import { describe, it, expect } from "vitest";
import { createMemoryLimiter } from "./rate-limit";

describe("MemoryTokenBucket", () => {
  it("allows up to max within window", async () => {
    let t = 0;
    const limiter = createMemoryLimiter({ now: () => t });
    expect(await limiter.check("a", 3, 1000)).toBe(true);
    t = 100;
    expect(await limiter.check("a", 3, 1000)).toBe(true);
    t = 200;
    expect(await limiter.check("a", 3, 1000)).toBe(true);
    t = 300;
    expect(await limiter.check("a", 3, 1000)).toBe(false);
  });

  it("releases slots after window expires", async () => {
    let t = 0;
    const limiter = createMemoryLimiter({ now: () => t });
    await limiter.check("k", 2, 1000);
    t = 500;
    await limiter.check("k", 2, 1000);
    expect(await limiter.check("k", 2, 1000)).toBe(false);
    t = 1600;
    expect(await limiter.check("k", 2, 1000)).toBe(true);
  });

  it("isolates buckets per key", async () => {
    const t = 0;
    const limiter = createMemoryLimiter({ now: () => t });
    expect(await limiter.check("a", 1, 1000)).toBe(true);
    expect(await limiter.check("a", 1, 1000)).toBe(false);
    expect(await limiter.check("b", 1, 1000)).toBe(true);
  });

  it("reset(key) clears a single bucket", async () => {
    const t = 0;
    const limiter = createMemoryLimiter({ now: () => t });
    await limiter.check("k", 1, 1000);
    expect(await limiter.check("k", 1, 1000)).toBe(false);
    limiter.reset?.("k");
    expect(await limiter.check("k", 1, 1000)).toBe(true);
  });
});
