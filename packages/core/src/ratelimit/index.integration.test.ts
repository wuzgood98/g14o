import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRateLimit } from "./index";
import {
  createTestRedis,
  getTestRedisCredentials,
  hasUpstashCredentials,
} from "./integration-env";

const STRICT_TIER_LIMIT = 5;

function mockRequest(): NextRequest {
  return {
    url: "http://localhost/api",
    headers: { get: () => null },
  } as unknown as NextRequest;
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
    let rateLimit: ReturnType<typeof createRateLimit>;

    beforeEach(() => {
      rateLimit = createIsolatedRateLimit();
    });

    it("enforces strict tier limits via getRateLimiter", async () => {
      const identifier = `g14o-it-rl-${randomUUID()}`;
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
      const handler = vi.fn(async (_req: NextRequest) =>
        NextResponse.json({ ok: true })
      );
      const limited = rateLimit.withRateLimit(handler, {
        tier: "strict",
        identifierFn: async () => identifier,
      });

      const req = mockRequest();

      for (let i = 0; i < STRICT_TIER_LIMIT; i++) {
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
});
