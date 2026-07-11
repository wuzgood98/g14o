import { parseDurationToMs } from "../parse-duration";
import type {
  RateLimitResultData,
  RateLimitStore,
  RateLimitStoreConfig,
  RateLimitStoreLimiter,
} from "./interface";

const RATE_LIMIT_CLEANUP_INTERVAL = 60_000;

class InMemoryRateLimiter implements RateLimitStoreLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly hits = new Map<string, number[]>();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(config: RateLimitStoreConfig) {
    this.maxRequests = config.limit;
    this.windowMs = parseDurationToMs(config.window);
    this.cleanupInterval = setInterval(
      () => this.cleanup(),
      RATE_LIMIT_CLEANUP_INTERVAL
    );
  }

  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    for (const [key, timestamps] of this.hits.entries()) {
      const valid = timestamps.filter((t) => t > cutoff);
      if (valid.length === 0) {
        this.hits.delete(key);
      } else {
        this.hits.set(key, valid);
      }
    }
  }

  limit(identifier: string): Promise<RateLimitResultData> {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const existing = this.hits.get(identifier) ?? [];
    const valid = existing.filter((t) => t > cutoff);

    if (valid.length >= this.maxRequests) {
      const oldest = valid[0] ?? now;
      const reset = oldest + this.windowMs;
      return Promise.resolve({
        success: false,
        limit: this.maxRequests,
        remaining: 0,
        reset,
      });
    }

    valid.push(now);
    this.hits.set(identifier, valid);

    let oldest = valid[0] ?? now;
    for (const timestamp of valid) {
      if (timestamp < oldest) {
        oldest = timestamp;
      }
    }

    return Promise.resolve({
      success: true,
      limit: this.maxRequests,
      remaining: this.maxRequests - valid.length,
      reset: oldest + this.windowMs,
    });
  }

  reset(): void {
    clearInterval(this.cleanupInterval);
    this.hits.clear();
  }
}

/**
 * Creates an in-memory rate limit store.
 *
 * Suitable for development, tests, and single-instance production deployments.
 * Counters are per-process and not shared across replicas.
 *
 * @returns A {@link RateLimitStore} backed by an in-process sliding window.
 */
export function memoryStore(): RateLimitStore {
  return {
    createLimiter(config: RateLimitStoreConfig): RateLimitStoreLimiter {
      return new InMemoryRateLimiter(config);
    },
  };
}
