import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRateLimit } from "../index";
import { hasRedisUrl } from "../integration-redis-env";
import { redisStore } from "./redis";
import { describeStore } from "./store-contract";

const STRICT_TIER_LIMIT = 5;
const REDIS_CONNECTION_ERROR_REGEX = /Redis/;

describe.skipIf(!hasRedisUrl())("Redis integration", () => {
  let createNodeRedisClient: typeof import("../integration-redis-clients")["createNodeRedisClient"];
  let createIoRedisClient: typeof import("../integration-redis-clients")["createIoRedisClient"];

  beforeAll(async () => {
    const clients = await import("../integration-redis-clients");
    createNodeRedisClient = clients.createNodeRedisClient;
    createIoRedisClient = clients.createIoRedisClient;
  });

  describe("node-redis", () => {
    let client: Awaited<ReturnType<typeof createNodeRedisClient>>;

    beforeAll(async () => {
      client = await createNodeRedisClient();
    });

    afterAll(async () => {
      await client.quit();
    });

    describeStore("Redis Store (node-redis)", () => redisStore(client));

    it("enforces strict tier via createRateLimit", async () => {
      const runId = randomUUID();
      const rateLimit = createRateLimit({
        env: "production",
        store: redisStore(client),
        tiers: {
          strict: { prefix: `@ratelimit:redis-it-${runId}` },
        },
      });
      rateLimit.reset();

      const identifier = `g14o-redis-it-${randomUUID()}`;
      const req = new Request("http://localhost/api");
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

      const blocked = await rateLimit.checkRateLimit(req, options);
      expect(blocked.ok).toBe(false);
      if (!blocked.ok) {
        expect(blocked.status).toBe(429);
      }
    });
  });

  describe("ioredis", () => {
    let client: ReturnType<typeof createIoRedisClient>;

    beforeAll(() => {
      client = createIoRedisClient();
    });

    afterAll(async () => {
      await client.quit();
    });

    describeStore("Redis Store (ioredis)", () => redisStore(client));

    it("enforces strict tier via createRateLimit", async () => {
      const runId = randomUUID();
      const rateLimit = createRateLimit({
        env: "production",
        store: redisStore(client),
        tiers: {
          strict: { prefix: `@ratelimit:redis-io-it-${runId}` },
        },
      });
      rateLimit.reset();

      const identifier = `g14o-redis-io-it-${randomUUID()}`;
      const req = new Request("http://localhost/api");
      const options = {
        tier: "strict" as const,
        identifierFn: async () => identifier,
      };

      for (let i = 0; i < STRICT_TIER_LIMIT; i++) {
        const result = await rateLimit.checkRateLimit(req, options);
        expect(result.ok).toBe(true);
      }

      const blocked = await rateLimit.checkRateLimit(req, options);
      expect(blocked.ok).toBe(false);
    });
  });

  describe("network failures", () => {
    it("propagates connection errors from limit()", async () => {
      const client = createIoRedisClient();
      await client.quit();

      const store = redisStore(client);
      const limiter = store.createLimiter({
        limit: 5,
        window: "60 s",
        prefix: `@ratelimit:dead-${randomUUID()}`,
      });

      await expect(limiter.limit("client-a")).rejects.toThrow(
        REDIS_CONNECTION_ERROR_REGEX
      );
    });
  });
});
