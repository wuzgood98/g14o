import { randomUUID } from "node:crypto";
import type { Context } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRateLimit } from "./index";
import {
  createTestRedis,
  getTestRedisCredentials,
  hasUpstashCredentials,
} from "./integration-env";

const STRICT_TIER_LIMIT = 5;

function mockContext(): Context {
  return {
    req: {
      raw: {
        url: "http://localhost/api",
        headers: {
          get: () => null,
        },
      } as unknown as Request,
      header: () => undefined,
    },
    res: new Response(null, { status: 200 }),
  } as unknown as Context;
}

function createIsolatedRateLimit() {
  const runId = randomUUID();
  const rateLimit = createRateLimit({
    env: "production",
    redis: getTestRedisCredentials(),
    tiers: {
      strict: { prefix: `@ratelimit:it-hono-${runId}` },
    },
  });
  rateLimit.reset();
  return rateLimit;
}

async function expectEventuallyBlocked(
  check: () => Promise<{ ok: boolean; status?: number }>
): Promise<void> {
  await vi.waitFor(
    async () => {
      const result = await check();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(429);
      }
    },
    { timeout: 10_000, interval: 100 }
  );
}

describe.skipIf(!hasUpstashCredentials())("Upstash Redis integration", () => {
  describe("credentials path", () => {
    let rateLimit: ReturnType<typeof createRateLimit>;

    beforeEach(() => {
      rateLimit = createIsolatedRateLimit();
    });

    it("enforces strict tier limits via getRateLimiter", async () => {
      const identifier = `g14o-it-hono-rl-${randomUUID()}`;
      const limiter = rateLimit.getRateLimiter("strict");

      for (let i = 0; i < STRICT_TIER_LIMIT; i++) {
        const result = await limiter.limit(identifier);
        expect(result.success).toBe(true);
      }

      await vi.waitFor(
        async () => {
          const blocked = await limiter.limit(identifier);
          expect(blocked.success).toBe(false);
          expect(blocked.remaining).toBe(0);
        },
        { timeout: 10_000, interval: 100 }
      );
    });

    it("enforces strict tier via checkRateLimit", async () => {
      const identifier = `g14o-it-hono-rl-${randomUUID()}`;
      const c = mockContext();
      const options = {
        tier: "strict" as const,
        identifierFn: async () => identifier,
      };

      for (let i = 0; i < STRICT_TIER_LIMIT; i++) {
        const result = await rateLimit.checkRateLimit(c, options);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.remaining).toBe(STRICT_TIER_LIMIT - i - 1);
        }
      }

      await expectEventuallyBlocked(() => rateLimit.checkRateLimit(c, options));
    });

    it("returns 429 from withRateLimit when strict tier is exceeded", async () => {
      const identifier = `g14o-it-hono-rl-${randomUUID()}`;
      const handler = vi.fn(() => Response.json({ ok: true }));
      const limited = rateLimit.withRateLimit(handler, {
        tier: "strict",
        identifierFn: async () => identifier,
      });

      const c = mockContext();

      for (let i = 0; i < STRICT_TIER_LIMIT; i++) {
        const response = await limited(c, vi.fn());
        expect(response?.status).toBe(200);
      }

      await vi.waitFor(
        async () => {
          const blockedResponse = await limited(c, vi.fn());
          expect(blockedResponse?.status).toBe(429);
        },
        { timeout: 10_000, interval: 100 }
      );
      expect(handler).toHaveBeenCalledTimes(STRICT_TIER_LIMIT);
    });
  });

  describe("Redis.fromEnv() path", () => {
    it("accepts a pre-built Redis client", async () => {
      const rateLimit = createRateLimit({
        env: "production",
        redis: createTestRedis(),
      });
      rateLimit.reset();

      const identifier = `g14o-it-hono-env-${randomUUID()}`;
      const result = await rateLimit.checkRateLimit(mockContext(), {
        tier: "moderate",
        identifierFn: async () => identifier,
      });
      expect(result.ok).toBe(true);
    });
  });
});
