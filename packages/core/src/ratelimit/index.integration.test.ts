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

function mockRequest(): NextRequest {
  return {
    url: "http://localhost/api",
    headers: { get: () => null },
  } as unknown as NextRequest;
}

describe.skipIf(!hasUpstashCredentials())("Upstash Redis integration", () => {
  describe("credentials path", () => {
    let rateLimit: ReturnType<typeof createRateLimit>;

    beforeEach(() => {
      rateLimit = createRateLimit({
        env: "production",
        redis: getTestRedisCredentials(),
      });
      rateLimit.reset();
    });

    it("enforces strict tier limits via getRateLimiter", async () => {
      const identifier = `g14o-it-rl-${randomUUID()}`;
      const limiter = rateLimit.getRateLimiter("strict");

      for (let i = 0; i < 5; i++) {
        const result = await limiter.limit(identifier);
        expect(result.success).toBe(true);
      }

      const blocked = await limiter.limit(identifier);
      expect(blocked.success).toBe(false);
      expect(blocked.remaining).toBe(0);
    });

    it("enforces strict tier via checkRateLimit", async () => {
      const identifier = `g14o-it-rl-${randomUUID()}`;
      const req = mockRequest();
      const options = {
        tier: "strict" as const,
        identifierFn: async () => identifier,
      };

      for (let i = 0; i < 5; i++) {
        const result = await rateLimit.checkRateLimit(req, options);
        expect(result.ok).toBe(true);
      }

      const blocked = await rateLimit.checkRateLimit(req, options);
      expect(blocked.ok).toBe(false);
      if (!blocked.ok) {
        expect(blocked.status).toBe(429);
      }
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

      for (let i = 0; i < 5; i++) {
        const res = await limited(req);
        expect(res.status).toBe(200);
      }

      const blocked = await limited(req);
      expect(blocked.status).toBe(429);
      expect(handler).toHaveBeenCalledTimes(5);
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
