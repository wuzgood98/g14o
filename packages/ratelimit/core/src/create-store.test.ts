import { describe, expect, it } from "vitest";
import { createRateLimit } from "./index";
import { createStore, defineStore } from "./store/create-store";
import type { RateLimitStore } from "./store/interface";

interface CounterEntry {
  count: number;
  reset: number;
}

function createMapBackedPrimitives() {
  const counters = new Map<string, CounterEntry>();

  return {
    increment(key: string, windowMs: number) {
      const now = Date.now();
      const existing = counters.get(key);
      if (!existing || existing.reset <= now) {
        const reset = now + windowMs;
        counters.set(key, { count: 1, reset });
        return Promise.resolve({ count: 1, reset });
      }
      const count = existing.count + 1;
      counters.set(key, { count, reset: existing.reset });
      return Promise.resolve({ count, reset: existing.reset });
    },
    reset() {
      counters.clear();
    },
  };
}

function mockRequest(headers: Record<string, string | null> = {}): Request {
  const requestHeaders = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (value !== null) {
      requestHeaders.set(name, value);
    }
  }
  return new Request("http://localhost/api", { headers: requestHeaders });
}

describe("createStore", () => {
  it("enforces fixed-window limits via increment primitive", async () => {
    const store = createStore(createMapBackedPrimitives());
    const limiter = store.createLimiter({
      limit: 2,
      window: "60 s",
      prefix: "@ratelimit:custom",
    });

    const first = await limiter.limit("client-a");
    expect(first.success).toBe(true);
    expect(first.remaining).toBe(1);
    expect(first.limit).toBe(2);

    const second = await limiter.limit("client-a");
    expect(second.success).toBe(true);
    expect(second.remaining).toBe(0);

    const blocked = await limiter.limit("client-a");
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("clears counters when reset primitive is called", async () => {
    const primitives = createMapBackedPrimitives();
    const store = createStore(primitives);
    const limiter = store.createLimiter({
      limit: 1,
      window: "60 s",
      prefix: "@ratelimit:custom",
    });

    expect((await limiter.limit("client-a")).success).toBe(true);
    expect((await limiter.limit("client-a")).success).toBe(false);

    primitives.reset();

    expect((await limiter.limit("client-a")).success).toBe(true);
  });

  it("works end-to-end with createRateLimit in production", async () => {
    const rateLimit = createRateLimit({
      env: "production",
      store: createStore(createMapBackedPrimitives()),
    });

    try {
      const req = mockRequest({ "x-forwarded-for": "custom-store-client" });
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

describe("defineStore", () => {
  it("returns the same store reference", () => {
    const store: RateLimitStore = {
      createLimiter: () => ({
        limit: async () => ({
          success: true,
          limit: 10,
          remaining: 9,
          reset: Date.now(),
        }),
      }),
    };

    expect(defineStore(store)).toBe(store);
  });

  it("is accepted by createRateLimit in production", async () => {
    const store = defineStore({
      createLimiter(config) {
        let count = 0;
        return {
          limit() {
            count += 1;
            return Promise.resolve({
              success: count <= config.limit,
              limit: config.limit,
              remaining: Math.max(0, config.limit - count),
              reset: Date.now() + 60_000,
            });
          },
        };
      },
    });

    const rateLimit = createRateLimit({
      env: "production",
      store,
    });

    try {
      const req = mockRequest({ "x-forwarded-for": "define-store-client" });
      const options = { tier: "strict" as const };

      for (let i = 0; i < 5; i++) {
        expect(await rateLimit.checkRateLimit(req, options)).toMatchObject({
          ok: true,
        });
      }

      const blocked = await rateLimit.checkRateLimit(req, options);
      expect(blocked.ok).toBe(false);
    } finally {
      rateLimit.reset();
    }
  });
});
