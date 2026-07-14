import { randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { RedisConfig } from "./config";
import { type CacheTtlOverride, createCache } from "./index";
import {
  getTestRedisCredentials,
  hasUpstashCredentials,
} from "./integration-env";
import { hasRedisUrl } from "./integration-redis-env";
import type { IoRedisLike, NodeRedisLike } from "./store/redis";
import { redisStore } from "./store/redis";
import { describeStore } from "./store/store-contract";
import { upstashStore } from "./store/upstash";

function createIsolatedCache(
  ttl?: CacheTtlOverride,
  redis: RedisConfig = getTestRedisCredentials()
) {
  const runId = randomUUID();
  const prefix = `g14o-it-cache-${runId}`;
  const cache = createCache({
    env: "production",
    redis,
    ttl,
  });
  cache.reset();
  return { cache, prefix };
}

function createIsolatedStoreCache(
  ttl?: CacheTtlOverride,
  redis: RedisConfig = getTestRedisCredentials()
) {
  const runId = randomUUID();
  const prefix = `g14o-it-cache-store-${runId}`;
  const cache = createCache({
    env: "production",
    store: upstashStore({ redis }),
    ttl,
  });
  cache.reset();
  return { cache, prefix };
}

function createIsolatedRedisStoreCache(
  client: NodeRedisLike | IoRedisLike,
  ttl?: CacheTtlOverride
) {
  const runId = randomUUID();
  const prefix = `g14o-it-cache-redis-${runId}`;
  const cache = createCache({
    env: "production",
    store: redisStore(client),
    ttl,
  });
  cache.reset();
  return { cache, prefix };
}

describe.skipIf(!hasUpstashCredentials())("Upstash Redis integration", () => {
  describe("legacy redis option", () => {
    let cache: ReturnType<typeof createCache>;
    let testPrefix: string;

    beforeEach(() => {
      ({ cache, prefix: testPrefix } = createIsolatedCache());
    });

    afterEach(async () => {
      await cache.invalidateCache("*", { prefix: testPrefix });
      cache.reset();
    });

    it("uses Redis store in production mode", async () => {
      expect(cache.inMemoryCache()).toBeNull();

      const store = cache.getCache();
      const key = `${testPrefix}:roundtrip`;
      const payload = { ok: true as const, data: { id: "test" } };

      await store.set(key, payload, 60);
      const cached = await store.get(key);

      expect(cached).toEqual(payload);
    });

    it("resolves production TTL presets", () => {
      expect(cache.getTTL("medium")).toBe(1800);
      expect(cache.getTTL("short")).toBe(300);
    });

    it("applies custom ttl overrides via getTTL in production", () => {
      const { cache: custom } = createIsolatedCache({
        production: { short: 45, medium: 90, long: 120 },
      });
      expect(custom.getTTL("short")).toBe(45);
      expect(custom.getTTL("medium")).toBe(90);
      expect(custom.getTTL("long")).toBe(120);
    });

    it("caches successful results via withCache on Redis", async () => {
      const fn = vi.fn(() =>
        Promise.resolve({ ok: true as const, data: { value: 42 } })
      );

      const cached = cache.withCache(fn, {
        prefix: testPrefix,
        keyGenerator: () => "with-cache",
        ttl: "short",
      });

      const first = await cached();
      const second = await cached();

      expect(first).toEqual({ ok: true, data: { value: 42 } });
      expect(second).toEqual({ ok: true, data: { value: 42 } });
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("invalidates a single cache key on Redis", async () => {
      const store = cache.getCache();
      const key = `${testPrefix}:invalidate-one`;
      await store.set(key, { ok: true, data: 1 }, 60);

      const deleted = await cache.invalidateCacheKey(key);
      expect(deleted).toEqual({ ok: true, data: true });
    });
  });

  describe("store: upstashStore option", () => {
    let cache: ReturnType<typeof createCache>;
    let testPrefix: string;

    beforeEach(() => {
      ({ cache, prefix: testPrefix } = createIsolatedStoreCache());
    });

    afterEach(async () => {
      await cache.invalidateCache("*", { prefix: testPrefix });
      cache.reset();
    });

    describeStore("upstashStore", () =>
      upstashStore({ redis: getTestRedisCredentials() })
    );

    it("uses explicit upstashStore in production mode", async () => {
      expect(cache.inMemoryCache()).toBeNull();

      const store = cache.getCache();
      const key = `${testPrefix}:store-roundtrip`;
      const payload = { ok: true as const, data: { id: "store" } };

      await store.set(key, payload, 60);
      expect(await store.get(key)).toEqual(payload);
    });

    it("caches successful results via withCache on upstashStore", async () => {
      const fn = vi.fn(() =>
        Promise.resolve({ ok: true as const, data: { value: 99 } })
      );

      const cached = cache.withCache(fn, {
        prefix: testPrefix,
        keyGenerator: () => "with-cache-store",
        ttl: "short",
      });

      await cached();
      await cached();
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe("Redis.fromEnv() path", () => {
    it("accepts a pre-built Redis client via legacy redis option", async () => {
      const { cache, prefix } = createIsolatedCache(undefined, Redis.fromEnv());

      const store = cache.getCache();
      const key = `${prefix}:from-env`;
      await store.set(key, { ok: true, data: "env" }, 60);
      expect(await store.get(key)).toEqual({ ok: true, data: "env" });

      await cache.invalidateCacheKey(key);
      cache.reset();
    });

    it("accepts a pre-built Redis client via upstashStore", async () => {
      const { cache, prefix } = createIsolatedStoreCache(
        undefined,
        Redis.fromEnv()
      );

      const store = cache.getCache();
      const key = `${prefix}:from-env-store`;
      await store.set(key, { ok: true, data: "env-store" }, 60);
      expect(await store.get(key)).toEqual({ ok: true, data: "env-store" });

      await cache.invalidateCacheKey(key);
      cache.reset();
    });
  });
});

describe.skipIf(!hasRedisUrl())("Generic Redis integration", () => {
  let createNodeRedisClient: typeof import("./integration-redis-clients")["createNodeRedisClient"];
  let createIoRedisClient: typeof import("./integration-redis-clients")["createIoRedisClient"];

  beforeAll(async () => {
    const clients = await import("./integration-redis-clients");
    createNodeRedisClient = clients.createNodeRedisClient;
    createIoRedisClient = clients.createIoRedisClient;
  });

  describe("node-redis", () => {
    let client: Awaited<ReturnType<typeof createNodeRedisClient>>;
    let cache: ReturnType<typeof createCache>;
    let testPrefix: string;

    beforeAll(async () => {
      client = await createNodeRedisClient();
    });

    afterAll(async () => {
      await client.quit();
    });

    beforeEach(() => {
      ({ cache, prefix: testPrefix } = createIsolatedRedisStoreCache(
        client as NodeRedisLike
      ));
    });

    afterEach(async () => {
      await cache.invalidateCache("*", { prefix: testPrefix });
      cache.reset();
    });

    it("uses redisStore in production mode", async () => {
      expect(cache.inMemoryCache()).toBeNull();

      const store = cache.getCache();
      const key = `${testPrefix}:roundtrip`;
      const payload = { ok: true as const, data: { id: "redis" } };

      await store.set(key, payload, 60);
      expect(await store.get(key)).toEqual(payload);
    });

    it("caches successful results via withCache on redisStore", async () => {
      const fn = vi.fn(() =>
        Promise.resolve({ ok: true as const, data: { value: 42 } })
      );

      const cached = cache.withCache(fn, {
        prefix: testPrefix,
        keyGenerator: () => "with-cache",
        ttl: "short",
      });

      await cached();
      await cached();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("invalidates a single cache key on redisStore", async () => {
      const store = cache.getCache();
      const key = `${testPrefix}:invalidate-one`;
      await store.set(key, { ok: true, data: 1 }, 60);

      const deleted = await cache.invalidateCacheKey(key);
      expect(deleted).toEqual({ ok: true, data: true });
    });
  });

  describe("ioredis", () => {
    let client: ReturnType<typeof createIoRedisClient>;
    let cache: ReturnType<typeof createCache>;
    let testPrefix: string;

    beforeAll(() => {
      client = createIoRedisClient();
    });

    afterAll(async () => {
      await client.quit();
    });

    beforeEach(() => {
      ({ cache, prefix: testPrefix } = createIsolatedRedisStoreCache(
        client as IoRedisLike
      ));
    });

    afterEach(async () => {
      await cache.invalidateCache("*", { prefix: testPrefix });
      cache.reset();
    });

    it("uses redisStore in production mode", async () => {
      expect(cache.inMemoryCache()).toBeNull();

      const store = cache.getCache();
      const key = `${testPrefix}:roundtrip`;
      const payload = { ok: true as const, data: { id: "ioredis" } };

      await store.set(key, payload, 60);
      expect(await store.get(key)).toEqual(payload);
    });

    it("caches successful results via withCache on redisStore", async () => {
      const fn = vi.fn(() =>
        Promise.resolve({ ok: true as const, data: { value: 7 } })
      );

      const cached = cache.withCache(fn, {
        prefix: testPrefix,
        keyGenerator: () => "with-cache-io",
        ttl: "short",
      });

      await cached();
      await cached();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("invalidates a single cache key on redisStore", async () => {
      const store = cache.getCache();
      const key = `${testPrefix}:invalidate-one`;
      await store.set(key, { ok: true, data: 1 }, 60);

      const deleted = await cache.invalidateCacheKey(key);
      expect(deleted).toEqual({ ok: true, data: true });
    });
  });
});
