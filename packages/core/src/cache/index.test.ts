import { beforeEach, describe, expect, it, vi } from "vitest";
import { configureUtils } from "../config";
import {
  createCache,
  createCacheKey,
  createCachePattern,
  createEntityCacheKey,
  createListCacheKey,
  getTTL,
  invalidateCache,
  resetCacheAdapter,
  withCache,
} from "./index";

const HASHED_CACHE_KEY_PATTERN = /^users:[a-f0-9]{16}$/;
const REDIS_REQUIRED_PATTERN = /Redis is required/;

describe("createCache (factory API)", () => {
  let cache: ReturnType<typeof createCache>;

  beforeEach(() => {
    cache = createCache({ env: "test" });
    cache.reset();
  });

  describe("getTTL", () => {
    it("returns development TTL seconds in test env", () => {
      expect(cache.getTTL("medium")).toBe(300);
      expect(cache.getTTL("long")).toBe(600);
    });

    it("merges development TTL overrides in test env", () => {
      const custom = createCache({
        env: "test",
        ttl: { development: { medium: 42 } },
      });
      expect(custom.getTTL("medium")).toBe(42);
      expect(custom.getTTL("short")).toBe(60);
    });

    it("merges production TTL overrides", () => {
      const custom = createCache({
        env: "production",
        ttl: { production: { long: 99 } },
      });
      expect(custom.getTTL("long")).toBe(99);
      expect(custom.getTTL("short")).toBe(300);
    });
  });

  describe("withCache", () => {
    it("caches successful results and skips failures", async () => {
      const fn = vi.fn((id: string) => {
        if (id === "bad") {
          return Promise.resolve({
            ok: false as const,
            error: new Error("fail"),
            status: 400,
          });
        }
        return Promise.resolve({ ok: true as const, data: { id } });
      });

      const cached = cache.withCache(fn, {
        prefix: "test",
        keyGenerator: (id: string) => id,
        ttl: "short",
      });

      const first = await cached("good");
      const second = await cached("good");
      expect(first).toEqual({ ok: true, data: { id: "good" } });
      expect(second).toEqual({ ok: true, data: { id: "good" } });
      expect(fn).toHaveBeenCalledTimes(1);

      await cached("bad");
      await cached("bad");
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe("invalidateCache", () => {
    it("removes keys matching pattern", async () => {
      const fn = vi.fn(async () => ({ ok: true as const, data: 1 }));
      const cached = cache.withCache(fn, {
        prefix: "inv",
        keyGenerator: () => "item",
      });

      await cached();
      await cached();
      expect(fn).toHaveBeenCalledTimes(1);

      const result = await cache.invalidateCache("*", { prefix: "inv" });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBeGreaterThanOrEqual(1);
      }

      await cached();
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe("invalidateCacheKey", () => {
    it("deletes a single key", async () => {
      const store = cache.getCache();
      const key = "manual:key";
      await store.set(key, { ok: true, data: 1 }, 60);

      const result = await cache.invalidateCacheKey(key);
      expect(result).toEqual({ ok: true, data: true });

      const missing = await cache.invalidateCacheKey(key);
      expect(missing).toEqual({ ok: true, data: false });
    });
  });

  describe("production guard", () => {
    it("throws when production without redis", () => {
      delete process.env.NEXT_PHASE;
      const productionCache = createCache({ env: "production" });
      expect(() => productionCache.getCache()).toThrow(REDIS_REQUIRED_PATTERN);
    });

    it("uses in-memory cache during Next production build by default", () => {
      vi.stubEnv("NEXT_PHASE", "phase-production-build");
      const productionCache = createCache({ env: "production" });
      productionCache.getCache();
      expect(productionCache.inMemoryCache()).not.toBeNull();
      vi.unstubAllEnvs();
    });

    it("uses Redis during Next production build when inMemoryDuringNextBuild is false", () => {
      vi.stubEnv("NEXT_PHASE", "phase-production-build");
      const mockRedis = {
        get: vi.fn(),
        set: vi.fn(),
        setex: vi.fn(),
        del: vi.fn(),
        keys: vi.fn(async () => []),
      } as unknown as import("@upstash/redis").Redis;
      const productionCache = createCache({
        env: "production",
        inMemoryDuringNextBuild: false,
        redis: mockRedis,
      });
      productionCache.getCache();
      expect(productionCache.inMemoryCache()).toBeNull();
      vi.unstubAllEnvs();
    });

    it("accepts a duck-typed redis client in production", () => {
      const mockRedis = {
        get: vi.fn(),
        set: vi.fn(),
        setex: vi.fn(),
        del: vi.fn(),
        keys: vi.fn(async () => []),
      } as unknown as import("@upstash/redis").Redis;
      const productionCache = createCache({
        env: "production",
        redis: mockRedis,
      });
      expect(productionCache.getCache()).toBeTruthy();
    });
  });
});

describe("createCacheKey", () => {
  it("builds deterministic keys with pagination defaults", () => {
    expect(createCacheKey("users", { search: "john" })).toBe(
      "users:limit:10:page:1:search:john"
    );
  });

  it("hashes when key exceeds maxLength", () => {
    const longSearch = "x".repeat(200);
    const key = createCacheKey(
      "users",
      { search: longSearch },
      { maxLength: 50 }
    );
    expect(key).toMatch(HASHED_CACHE_KEY_PATTERN);
  });

  it("produces identical keys regardless of object key order", () => {
    const keyA = createCacheKey("users", { filter: { b: 2, a: 1 } });
    const keyB = createCacheKey("users", { filter: { a: 1, b: 2 } });
    expect(keyA).toBe(keyB);
    expect(keyA).toContain("filter:a:1:b:2");
  });

  it("serializes nested objects deterministically", () => {
    const key = createCacheKey("users", { meta: { z: 1, a: 2 } });
    expect(key).toContain("meta:a:2:z:1");
  });

  it("serializes arrays of objects without default toString", () => {
    const key = createCacheKey("users", { tags: [{ b: 2, a: 1 }] });
    expect(key).not.toContain("[object Object]");
    expect(key).toContain("tags:a:1:b:2");
  });
});

describe("createEntityCacheKey", () => {
  it("formats entity:id", () => {
    expect(createEntityCacheKey("user", "abc")).toBe("user:abc");
  });
});

describe("createListCacheKey", () => {
  it("includes pagination in list keys", () => {
    expect(createListCacheKey("products", { category: "books" })).toContain(
      "page:1"
    );
    expect(createListCacheKey("products", { category: "books" })).toContain(
      "category:books"
    );
  });
});

describe("createCachePattern", () => {
  it("returns wildcard pattern without filters", () => {
    expect(createCachePattern("users")).toBe("users:*");
  });

  it("embeds filter segments", () => {
    expect(createCachePattern("users", { role: "admin" })).toBe(
      "users:*role:admin*"
    );
  });

  it("uses the same object serialization as createCacheKey", () => {
    const filters = { role: { b: 2, a: 1 } };
    const key = createCacheKey("users", filters, { includePagination: false });
    const pattern = createCachePattern("users", filters);

    expect(key).toBe("users:role:a:1:b:2");
    expect(pattern).toBe("users:*role:a:1:b:2*");
  });
});

describe("deprecated global exports", () => {
  beforeEach(() => {
    configureUtils({ env: "test" });
    resetCacheAdapter();
  });

  it("getTTL resolves using global env", () => {
    expect(getTTL("medium")).toBe(300);
  });

  it("withCache works via deprecated global API", async () => {
    const fn = vi.fn(async () => ({ ok: true as const, data: 1 }));
    const cached = withCache(fn, {
      prefix: "legacy",
      keyGenerator: () => "one",
    });
    await cached();
    await cached();
    expect(fn).toHaveBeenCalledTimes(1);
    await invalidateCache("*", { prefix: "legacy" });
    resetCacheAdapter();
  });
});
