import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRateLimit, type RateLimitClient } from "./index";
import {
  createTestRedis,
  getTestRedisCredentials,
  hasUpstashCredentials,
} from "./integration-env";
import { upstashStore } from "./store/upstash";

const STRICT_TIER_LIMIT = 5;

function mockRequest(): Request {
  return new Request("http://localhost/api");
}

function createIsolatedRateLimit() {
  const runId = randomUUID();
  const rateLimit = createRateLimit({
    env: "production",
    redis: getTestRedisCredentials(),
    tiers: {
      strict: { prefix: `@ratelimit:it-${runId}` },
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
    let rateLimit: RateLimitClient;

    beforeEach(() => {
      rateLimit = createIsolatedRateLimit();
    });

    it("enforces strict tier limits via getRateLimiter", async () => {
      const identifier = `g14o-it-rl-${randomUUID()}`;
      const limiter = rateLimit.getRateLimiter("strict");

      for (const _ of Array.from({ length: STRICT_TIER_LIMIT })) {
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
      const identifier = `g14o-it-rl-${randomUUID()}`;
      const req = mockRequest();
      const options = {
        tier: "strict" as const,
        identifierFn: async () => identifier,
      };

      for (let i = 0; i < STRICT_TIER_LIMIT; i++) {
        const result = await rateLimit.checkRateLimit(req, options);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.remaining).toBe(STRICT_TIER_LIMIT - i - 1);
        }
      }

      await expectEventuallyBlocked(() =>
        rateLimit.checkRateLimit(req, options)
      );
    });

    it("returns 429 from withRateLimit when strict tier is exceeded", async () => {
      const identifier = `g14o-it-rl-${randomUUID()}`;
      const handler = vi.fn(async (_req: Request) =>
        Response.json({ ok: true })
      );
      const limited = rateLimit.withRateLimit(handler, {
        tier: "strict",
        identifierFn: async () => identifier,
      });

      const req = mockRequest();

      for (const _ of Array.from({ length: STRICT_TIER_LIMIT })) {
        const res = await limited(req);
        expect(res.status).toBe(200);
      }

      await vi.waitFor(
        async () => {
          const blocked = await limited(req);
          expect(blocked.status).toBe(429);
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

      const identifier = `g14o-it-rl-env-${randomUUID()}`;
      const result = await rateLimit.checkRateLimit(mockRequest(), {
        tier: "moderate",
        identifierFn: async () => identifier,
      });
      expect(result.ok).toBe(true);
    });
  });

  describe("upstashStore path", () => {
    it("enforces strict tier via store option", async () => {
      const runId = randomUUID();
      const rateLimit = createRateLimit({
        env: "production",
        store: upstashStore({ redis: getTestRedisCredentials() }),
        tiers: {
          strict: { prefix: `@ratelimit:it-store-${runId}` },
        },
      });
      rateLimit.reset();

      const identifier = `g14o-it-rl-store-${randomUUID()}`;
      const req = mockRequest();
      const options = {
        tier: "strict" as const,
        identifierFn: async () => identifier,
      };

      for (let i = 0; i < STRICT_TIER_LIMIT; i++) {
        const result = await rateLimit.checkRateLimit(req, options);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.remaining).toBe(STRICT_TIER_LIMIT - i - 1);
        }
      }

      await expectEventuallyBlocked(() =>
        rateLimit.checkRateLimit(req, options)
      );
    });
  });
});
