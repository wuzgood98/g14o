import { randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCache } from "./index";
import {
  getTestRedisCredentials,
  hasUpstashCredentials,
} from "./integration-env";

const TEST_PREFIX = `g14o-it-cache-${randomUUID()}`;

describe.skipIf(!hasUpstashCredentials())("Upstash Redis integration", () => {
  describe("credentials path", () => {
    let cache: ReturnType<typeof createCache>;

    beforeEach(() => {
      cache = createCache({
        env: "production",
        redis: getTestRedisCredentials(),
      });
      cache.reset();
    });

    afterEach(async () => {
      await cache.invalidateCache("*", { prefix: TEST_PREFIX });
      cache.reset();
    });

    it("uses Redis adapter in production mode", async () => {
      expect(cache.inMemoryCache()).toBeNull();

      const store = cache.getCache();
      const key = `${TEST_PREFIX}:roundtrip`;
      const payload = { ok: true as const, data: { id: "test" } };

      await store.set(key, payload, 60);
      const cached = await store.get(key);

      expect(cached).toEqual(payload);
    });

    it("resolves production TTL presets", () => {
      expect(cache.getTTL("medium")).toBe(1800);
      expect(cache.getTTL("short")).toBe(300);
    });

    it("caches successful results via withCache on Redis", async () => {
      const fn = vi.fn(() =>
        Promise.resolve({ ok: true as const, data: { value: 42 } })
      );

      const cached = cache.withCache(fn, {
        prefix: TEST_PREFIX,
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
      const key = `${TEST_PREFIX}:invalidate-one`;
      await store.set(key, { ok: true, data: 1 }, 60);

      const deleted = await cache.invalidateCacheKey(key);
      expect(deleted).toEqual({ ok: true, data: true });
    });
  });

  describe("Redis.fromEnv() path", () => {
    it("accepts a pre-built Redis client", async () => {
      const cache = createCache({
        env: "production",
        redis: Redis.fromEnv(),
      });
      cache.reset();

      const store = cache.getCache();
      const key = `${TEST_PREFIX}:from-env`;
      await store.set(key, { ok: true, data: "env" }, 60);
      expect(await store.get(key)).toEqual({ ok: true, data: "env" });

      await cache.invalidateCacheKey(key);
      cache.reset();
    });
  });
});
