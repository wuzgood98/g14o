import { type Duration, Ratelimit } from "@upstash/ratelimit";
import type { NextRequest } from "next/server";
import { parseDurationToMs } from "./parse-duration";

type TokenTier = "strict" | "moderate" | "lenient" | "auth" | "write";

export interface TokenConfig {
  limit: number;
  prefix: string;
  window: Duration;
}

export const tokenConfig: Record<TokenTier, TokenConfig> = {
  strict: {
    limit: 5,
    window: "60 s",
    prefix: "@ratelimit:strict",
  },
  moderate: {
    limit: 10,
    window: "60 s",
    prefix: "@ratelimit:moderate",
  },
  lenient: {
    limit: 20,
    window: "60 s",
    prefix: "@ratelimit:lenient",
  },
  auth: {
    limit: 5,
    window: "15 m",
    prefix: "@ratelimit:auth",
  },
  write: {
    limit: 30,
    window: "1 h",
    prefix: "@ratelimit:write",
  },
};

export type RateLimitTier = TokenTier;

export interface RateLimitResultData {
  limit: number;
  remaining: number;
  reset: number;
  success: boolean;
}

export interface RateLimiterAdapter {
  limit(identifier: string): Promise<RateLimitResultData>;
}

export interface RateLimitOptions {
  identifierFn?: (req: NextRequest) => string | Promise<string>;
  skipRateLimit?: (req: NextRequest) => boolean | Promise<boolean>;
  tier?: RateLimitTier;
}

export type RateLimitCheckResult =
  | { ok: true; remaining: number; limit: number; reset: number }
  | {
      ok: false;
      error: Error;
      status: 429;
      remaining: number;
      limit: number;
      reset: number;
    };

const RATE_LIMIT_CLEANUP_INTERVAL = 60_000;

export class InMemoryRateLimiter implements RateLimiterAdapter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly hits = new Map<string, number[]>();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(config: TokenConfig) {
    this.maxRequests = config.limit;
    this.windowMs = parseDurationToMs(config.window);
    this.cleanupInterval = setInterval(
      () => this.cleanup(),
      RATE_LIMIT_CLEANUP_INTERVAL
    );
  }

  private cleanup() {
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

    return Promise.resolve({
      success: true,
      limit: this.maxRequests,
      remaining: this.maxRequests - valid.length,
      reset: now + this.windowMs,
    });
  }

  destroy() {
    clearInterval(this.cleanupInterval);
    this.hits.clear();
  }
}

export function getDefaultIdentifier(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const cfConnectingIp = req.headers.get("cf-connecting-ip");

  const ip =
    forwarded?.split(",")[0] || realIp || cfConnectingIp || "anonymous";
  return ip.trim();
}

/** @internal Legacy Upstash limiter using global getRedis — used by deprecated exports only. */
export class LegacyUpstashRateLimiter implements RateLimiterAdapter {
  private readonly ratelimit: Ratelimit;

  constructor(config: TokenConfig, redis: import("@upstash/redis").Redis) {
    this.ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.limit, config.window),
      analytics: true,
      prefix: config.prefix,
    });
  }

  async limit(identifier: string): Promise<RateLimitResultData> {
    const { success, limit, remaining, reset } =
      await this.ratelimit.limit(identifier);
    return { success, limit, remaining, reset };
  }
}
