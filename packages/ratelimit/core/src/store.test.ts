import { beforeEach, describe, expect, it, vi } from "vitest";
import { type CreateRateLimitOptions, createRateLimit } from "./index";
import { type ResolveStoreOptions, resolveStore } from "./store/factory";
import type { RateLimitStore } from "./store/interface";
import { memoryStore } from "./store/memory";
import { describeStore } from "./store/store-contract";
import { upstashStore } from "./store/upstash";

describeStore("Memory Store", () => memoryStore());

describe("memoryStore", () => {
  it("enforces sliding window limits", async () => {
    const store = memoryStore();
    const limiter = store.createLimiter({
      limit: 2,
      window: "60 s",
      prefix: "@ratelimit:test",
    });

    const first = await limiter.limit("client-a");
    expect(first.success).toBe(true);
    expect(first.remaining).toBe(1);

    const second = await limiter.limit("client-a");
    expect(second.success).toBe(true);
    expect(second.remaining).toBe(0);

    const blocked = await limiter.limit("client-a");
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("isolates identifiers", async () => {
    const store = memoryStore();
    const limiter = store.createLimiter({
      limit: 1,
      window: "60 s",
      prefix: "@ratelimit:test",
    });

    expect((await limiter.limit("client-a")).success).toBe(true);
    expect((await limiter.limit("client-a")).success).toBe(false);
    expect((await limiter.limit("client-b")).success).toBe(true);
  });

  it("clears state via reset()", async () => {
    const store = memoryStore();
    const limiter = store.createLimiter({
      limit: 1,
      window: "60 s",
      prefix: "@ratelimit:test",
    });

    expect((await limiter.limit("client-a")).success).toBe(true);
    expect((await limiter.limit("client-a")).success).toBe(false);

    limiter.reset?.();

    expect((await limiter.limit("client-a")).success).toBe(true);
  });
});

describe("upstashStore", () => {
  it("accepts flat url and token credentials", () => {
    const store = upstashStore({
      url: "https://example.upstash.io",
      token: "test-token",
    });

    expect(typeof store.createLimiter).toBe("function");
    const limiter = store.createLimiter({
      limit: 10,
      window: "60 s",
      prefix: "@ratelimit:flat",
    });
    expect(typeof limiter.limit).toBe("function");
  });

  it("accepts wrapped redis credentials", () => {
    const store = upstashStore({
      redis: { url: "https://example.upstash.io", token: "test-token" },
    });

    expect(typeof store.createLimiter).toBe("function");
  });
});

describe("resolveStore", () => {
  it("throws when both store and redis are provided", () => {
    const customStore: RateLimitStore = {
      createLimiter: () => ({
        limit: async () => ({
          success: true,
          limit: 1,
          remaining: 0,
          reset: Date.now(),
        }),
      }),
    };

    expect(() =>
      resolveStore({
        store: customStore,
        redis: { url: "https://example.com", token: "token" },
      } as unknown as ResolveStoreOptions)
    ).toThrow(
      "createRateLimit: pass either `store` or `redis`, not both. Use `store: upstashStore({ url, token })` instead of the legacy `redis` option."
    );
  });

  it("uses explicit store when only store is provided", () => {
    const customStore: RateLimitStore = {
      createLimiter: () => ({
        limit: async () => ({
          success: true,
          limit: 1,
          remaining: 0,
          reset: Date.now(),
        }),
      }),
    };

    expect(resolveStore({ store: customStore })).toBe(customStore);
  });

  it("creates upstash store from legacy redis config", () => {
    const resolved = resolveStore({
      redis: { url: "https://example.com", token: "token" },
    });

    expect(resolved).toBeDefined();
    expect(typeof resolved?.createLimiter).toBe("function");
  });

  it("returns undefined when no backend is configured", () => {
    expect(resolveStore({})).toBeUndefined();
  });
});

describe("createRateLimit store configuration", () => {
  function mockRequest(headers: Record<string, string | null> = {}): Request {
    const requestHeaders = new Headers();
    for (const [name, value] of Object.entries(headers)) {
      if (value !== null) {
        requestHeaders.set(name, value);
      }
    }
    return new Request("http://localhost/api", { headers: requestHeaders });
  }

  it("throws at client creation when both store and redis are provided", () => {
    expect(() =>
      createRateLimit({
        env: "production",
        store: memoryStore(),
        redis: { url: "https://example.com", token: "token" },
      } as unknown as CreateRateLimitOptions)
    ).toThrow(
      "createRateLimit: pass either `store` or `redis`, not both. Use `store: upstashStore({ url, token })` instead of the legacy `redis` option."
    );
  });

  it("enforces limits with explicit memoryStore in production", async () => {
    const rateLimit = createRateLimit({
      env: "production",
      store: memoryStore(),
    });

    try {
      const req = mockRequest({ "x-forwarded-for": "prod-memory-client" });
      const options = { tier: "strict" as const };

      for (let i = 0; i < 5; i++) {
        const result = await rateLimit.checkRateLimit(req, options);
        expect(result.ok).toBe(true);
      }

      const blocked = await rateLimit.checkRateLimit(req, options);
      expect(blocked.ok).toBe(false);
    } finally {
      rateLimit.reset();
    }
  });

  it("fails open in production when no store or redis is configured", async () => {
    const rateLimit = createRateLimit({ env: "production" });

    const result = await rateLimit.checkRateLimit(mockRequest(), {
      tier: "moderate",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.remaining).toBe(0);
      expect(result.limit).toBe(0);
    }
  });

  it("uses configured store in test when store is provided", async () => {
    const createLimiter = vi.fn(() => ({
      limit: async () => ({
        success: true,
        limit: 10,
        remaining: 9,
        reset: Date.now() + 60_000,
      }),
    }));
    const customStore: RateLimitStore = { createLimiter };
    const rateLimit = createRateLimit({
      env: "test",
      store: customStore,
    });

    try {
      await rateLimit.checkRateLimit(mockRequest(), { tier: "moderate" });
      expect(createLimiter).toHaveBeenCalledTimes(1);
    } finally {
      rateLimit.reset();
    }
  });

  it("uses explicit memoryStore in development", async () => {
    const rateLimit = createRateLimit({
      env: "development",
      store: memoryStore(),
    });

    try {
      const req = mockRequest({ "x-forwarded-for": "dev-memory-client" });
      const options = { tier: "strict" as const };

      for (let i = 0; i < 5; i++) {
        const result = await rateLimit.checkRateLimit(req, options);
        expect(result.ok).toBe(true);
      }

      const blocked = await rateLimit.checkRateLimit(req, options);
      expect(blocked.ok).toBe(false);
    } finally {
      rateLimit.reset();
    }
  });

  it("uses automatic memory in test when no store is configured", async () => {
    const rateLimit = createRateLimit({ env: "test" });

    try {
      const req = mockRequest({ "x-forwarded-for": "auto-memory-client" });
      const options = { tier: "strict" as const };

      for (let i = 0; i < 5; i++) {
        const result = await rateLimit.checkRateLimit(req, options);
        expect(result.ok).toBe(true);
      }

      const blocked = await rateLimit.checkRateLimit(req, options);
      expect(blocked.ok).toBe(false);
    } finally {
      rateLimit.reset();
    }
  });
});

describe("createRateLimit reset with store limiters", () => {
  let rateLimit: ReturnType<typeof createRateLimit>;

  beforeEach(() => {
    rateLimit = createRateLimit({ env: "test" });
    rateLimit.reset();
  });

  it("clears cached limiter state", async () => {
    const req = new Request("http://localhost/api", {
      headers: { "x-forwarded-for": "reset-client" },
    });
    const options = { tier: "strict" as const };

    for (let i = 0; i < 5; i++) {
      expect(await rateLimit.checkRateLimit(req, options)).toMatchObject({
        ok: true,
      });
    }

    expect(await rateLimit.checkRateLimit(req, options)).toMatchObject({
      ok: false,
    });

    rateLimit.reset();

    expect(await rateLimit.checkRateLimit(req, options)).toMatchObject({
      ok: true,
    });
  });
});
