export interface RateLimiter {
  check(key: string, max: number, windowMs: number): Promise<boolean>;
  reset?(key?: string): void;
}

interface BucketsClock {
  now: () => number;
}

class MemoryTokenBucket implements RateLimiter {
  private buckets = new Map<string, number[]>();
  private clock: BucketsClock;

  constructor(clock: BucketsClock = { now: () => Date.now() }) {
    this.clock = clock;
  }

  async check(key: string, max: number, windowMs: number): Promise<boolean> {
    const now = this.clock.now();
    const cutoff = now - windowMs;
    const prev = this.buckets.get(key) ?? [];
    const kept = prev.filter((t) => t > cutoff);
    if (kept.length >= max) {
      this.buckets.set(key, kept);
      return false;
    }
    kept.push(now);
    this.buckets.set(key, kept);
    return true;
  }

  reset(key?: string): void {
    if (key) {
      this.buckets.delete(key);
    } else {
      this.buckets.clear();
    }
  }
}

export const memoryLimiter: RateLimiter = new MemoryTokenBucket();

export function createMemoryLimiter(clock?: BucketsClock): RateLimiter {
  return new MemoryTokenBucket(clock);
}
