import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type CreateCacheOptions,
  createCache,
  createCacheKey,
  createCachePattern,
  createEntityCacheKey,
  createListCacheKey,
} from "./index";
import { memoryStore } from "./store/memory";
import { upstashStore } from "./store/upstash";

const HASHED_CACHE_KEY_PATTERN = /^users:[a-f0-9]{16}$/;
const STORE_REQUIRED_PATTERN = /cache store is required/;
const EITHER_STORE_OR_REDIS_PATTERN = /either `store` or `redis`/;

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

    it("merges flat TTL overrides for the active environment in test env", () => {
      const flat = createCache({
        env: "test",
        ttl: { short: 15, long: 45 },
      });
      expect(flat.getTTL("short")).toBe(15);
      expect(flat.getTTL("long")).toBe(45);
      expect(flat.getTTL("medium")).toBe(300);
    });

    it("merges flat TTL overrides for the active environment in production", () => {
      const flat = createCache({
        env: "production",
        ttl: { short: 45, medium: 90 },
      });
      expect(flat.getTTL("short")).toBe(45);
      expect(flat.getTTL("medium")).toBe(90);
      expect(flat.getTTL("long")).toBe(3600);
    });
  });

  describe("withCache", () => {
    it("caches successful results and skips failures by default", async () => {
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

    it("caches plain non-Result return values", async () => {
      const fn = vi.fn(async (id: string) => ({ id, name: "plain" }));
      const cached = cache.withCache(fn, {
        prefix: "plain",
        keyGenerator: (id: string) => id,
      });

      await cached("a");
      await cached("a");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("does not cache null return values", async () => {
      const fn = vi.fn(async () => null);
      const cached = cache.withCache(fn, {
        prefix: "null-plain",
        keyGenerator: () => "one",
      });

      await cached();
      await cached();
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("caches failed Result values when cacheFailures is enabled", async () => {
      const fn = vi.fn(() =>
        Promise.resolve({
          ok: false as const,
          error: new Error("not found"),
          status: 404,
        })
      );

      const cached = cache.withCache(fn, {
        prefix: "neg",
        keyGenerator: () => "one",
        cacheFailures: true,
      });

      await cached();
      await cached();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("uses custom failure TTL from cacheFailures object form", async () => {
      const fn = vi.fn(() =>
        Promise.resolve({
          ok: false as const,
          error: new Error("not found"),
          status: 404,
        })
      );

      const setSpy = vi.spyOn(cache.getCache(), "set");

      const cached = cache.withCache(fn, {
        prefix: "neg-ttl",
        keyGenerator: () => "one",
        cacheFailures: { enabled: true, ttl: "medium" },
      });

      await cached();

      expect(setSpy).toHaveBeenCalledWith(
        "neg-ttl:one",
        expect.anything(),
        cache.getTTL("medium")
      );

      setSpy.mockRestore();
    });

    it("does not cache failures when cacheFailures object has enabled false", async () => {
      const fn = vi.fn(() =>
        Promise.resolve({
          ok: false as const,
          error: new Error("not found"),
          status: 404,
        })
      );

      const cached = cache.withCache(fn, {
        prefix: "neg-off",
        keyGenerator: () => "one",
        cacheFailures: { enabled: false },
      });

      await cached();
      await cached();
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("applies client-level cacheFailures object as withCache default", async () => {
      const clientCache = createCache({
        env: "test",
        cacheFailures: { enabled: true, ttl: "short" },
      });

      const fn = vi.fn(() =>
        Promise.resolve({
          ok: false as const,
          error: new Error("not found"),
          status: 404,
        })
      );

      const cached = clientCache.withCache(fn, {
        prefix: "neg-client",
        keyGenerator: () => "one",
      });

      await cached();
      await cached();
      expect(fn).toHaveBeenCalledTimes(1);

      clientCache.reset();
    });

    it("serves stale values and refreshes in the background", async () => {
      vi.useFakeTimers();
      const fn = vi.fn(async () => ({ value: fn.mock.calls.length }));

      const swrCache = createCache({ env: "test" });
      const cached = swrCache.withCache(fn, {
        prefix: "swr",
        keyGenerator: () => "item",
        ttl: "short",
        staleWhileRevalidate: 30,
      });

      const first = await cached();
      expect(first).toEqual({ value: 1 });

      vi.advanceTimersByTime(61_000);

      const second = await cached();
      expect(second).toEqual({ value: 1 });

      await vi.waitFor(() => {
        expect(fn).toHaveBeenCalledTimes(2);
      });

      vi.useRealTimers();
      swrCache.reset();
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
    it("throws when production without store", () => {
      delete process.env.NEXT_PHASE;
      const productionCache = createCache({ env: "production" });
      expect(() => productionCache.getCache()).toThrow(STORE_REQUIRED_PATTERN);
    });

    it("uses explicit memoryStore in production", () => {
      delete process.env.NEXT_PHASE;
      const productionCache = createCache({
        env: "production",
        store: memoryStore(),
      });
      productionCache.getCache();
      expect(productionCache.inMemoryCache()).not.toBeNull();
    });

    it("uses in-memory cache during Next production build by default", () => {
      vi.stubEnv("NEXT_PHASE", "phase-production-build");
      const productionCache = createCache({ env: "production" });
      productionCache.getCache();
      expect(productionCache.inMemoryCache()).not.toBeNull();
      vi.unstubAllEnvs();
    });

    it("uses configured store during production build when inMemoryDuringBuild is false", () => {
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
        inMemoryDuringBuild: false,
        store: upstashStore({ redis: mockRedis }),
      });
      productionCache.getCache();
      expect(productionCache.inMemoryCache()).toBeNull();
      vi.unstubAllEnvs();
    });

    it("accepts legacy redis option in production", () => {
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

    it("throws when both store and redis are provided", () => {
      expect(() =>
        createCache({
          store: memoryStore(),
          redis: { url: "https://example.com", token: "token" },
        } as unknown as CreateCacheOptions)
      ).toThrow(EITHER_STORE_OR_REDIS_PATTERN);
    });
  });

  describe("inMemoryCache probe", () => {
    it("returns null before cache is initialized in test env", () => {
      expect(cache.inMemoryCache()).toBeNull();
    });
  });

  describe("clearAllCache and getCacheStats", () => {
    it("do not initialize adapter in production without store", () => {
      delete process.env.NEXT_PHASE;
      const productionCache = createCache({ env: "production" });

      expect(() => productionCache.clearAllCache()).not.toThrow();
      expect(productionCache.clearAllCache()).toEqual({
        ok: false,
        error: expect.any(Error),
        status: 400,
      });

      expect(() => productionCache.getCacheStats()).not.toThrow();
      expect(productionCache.getCacheStats()).toBeNull();
      expect(productionCache.inMemoryCache()).toBeNull();
    });

    it("reports stats and clears after withCache use", async () => {
      const fn = vi.fn(async () => ({ ok: true as const, data: 1 }));
      const cached = cache.withCache(fn, {
        prefix: "stats",
        keyGenerator: () => "k",
      });
      await cached();

      expect(cache.getCacheStats()?.size).toBe(1);

      const result = cache.clearAllCache();
      expect(result).toEqual({ ok: true, data: undefined });
      expect(cache.getCacheStats()?.size).toBe(0);
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
