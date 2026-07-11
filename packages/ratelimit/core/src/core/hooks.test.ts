import { describe, expect, it, vi } from "vitest";
import { createRateLimit } from "../create-rate-limit-client";
import { defineStore } from "../store/create-store";
import type { RateLimitStoreConfig } from "../store/interface";
import type { Logger } from "../types";
import type { RateLimitHooks } from "./hooks";

function mockRequest(headers: Record<string, string | null> = {}): Request {
  const requestHeaders = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (value !== null) {
      requestHeaders.set(name, value);
    }
  }
  return new Request("http://localhost/api", { headers: requestHeaders });
}

function createControllableStore(options?: {
  shouldThrow?: boolean;
  success?: boolean;
  limit?: number;
  remaining?: number;
}) {
  let callCount = 0;
  const store = defineStore({
    createLimiter(config: RateLimitStoreConfig) {
      return {
        limit() {
          callCount += 1;
          if (options?.shouldThrow) {
            return Promise.reject(new Error("store unavailable"));
          }
          const limit = options?.limit ?? config.limit;
          const success = options?.success ?? callCount <= limit;
          const remaining =
            options?.remaining ?? Math.max(0, limit - callCount);
          return Promise.resolve({
            success,
            limit,
            remaining,
            reset: Date.now() + 60_000,
          });
        },
      };
    },
  });
  return { store, getCallCount: () => callCount };
}

function createSpyLogger(): Logger & { errorCalls: unknown[] } {
  const errorCalls: unknown[] = [];
  return {
    errorCalls,
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn((error: unknown) => {
      errorCalls.push(error);
    }),
  };
}

describe("createRateLimit lifecycle hooks", () => {
  it("fires onSuccess with correct context when allowed", async () => {
    const onSuccess = vi.fn();
    const { store } = createControllableStore({ limit: 5, success: true });
    const rateLimit = createRateLimit({
      env: "production",
      store,
      hooks: { onSuccess },
    });

    try {
      const req = mockRequest({ "x-forwarded-for": "hook-client" });
      const result = await rateLimit.checkRateLimit(req, { tier: "strict" });

      expect(result.ok).toBe(true);
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          req,
          tier: "strict",
          identifier: "hook-client",
          limit: 5,
          remaining: 4,
        })
      );
    } finally {
      rateLimit.reset();
    }
  });

  it("fires onLimitExceeded and onFailure with limit_exceeded when blocked", async () => {
    const onLimitExceeded = vi.fn();
    const onFailure = vi.fn();
    const { store } = createControllableStore({ limit: 1, success: false });
    const rateLimit = createRateLimit({
      env: "production",
      store,
      hooks: { onLimitExceeded, onFailure },
    });

    try {
      const req = mockRequest({ "x-forwarded-for": "blocked-client" });
      const result = await rateLimit.checkRateLimit(req, { tier: "strict" });

      expect(result.ok).toBe(false);
      expect(onLimitExceeded).toHaveBeenCalledTimes(1);
      expect(onFailure).toHaveBeenCalledTimes(1);
      expect(onFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: "limit_exceeded",
          identifier: "blocked-client",
          tier: "strict",
        })
      );
    } finally {
      rateLimit.reset();
    }
  });

  it("fires onStoreError and onFailure with store_error and fails open", async () => {
    const onStoreError = vi.fn();
    const onFailure = vi.fn();
    const { store } = createControllableStore({ shouldThrow: true });
    const rateLimit = createRateLimit({
      env: "production",
      store,
      hooks: { onStoreError, onFailure },
    });

    try {
      const req = mockRequest({ "x-forwarded-for": "error-client" });
      const result = await rateLimit.checkRateLimit(req, { tier: "strict" });

      expect(result.ok).toBe(true);
      expect(onStoreError).toHaveBeenCalledTimes(1);
      expect(onStoreError).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: "error-client",
          tier: "strict",
          error: expect.any(Error),
        })
      );
      expect(onFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: "store_error",
          identifier: "error-client",
        })
      );
    } finally {
      rateLimit.reset();
    }
  });

  it("fires onReset with cleared cache keys", async () => {
    const onReset = vi.fn();
    const { store } = createControllableStore();
    const rateLimit = createRateLimit({
      env: "production",
      store,
      hooks: { onReset },
    });

    const req = mockRequest({ "x-forwarded-for": "reset-client" });
    await rateLimit.checkRateLimit(req, { tier: "strict" });
    rateLimit.reset();

    await vi.waitFor(() => {
      expect(onReset).toHaveBeenCalledTimes(1);
    });
    expect(onReset).toHaveBeenCalledWith(
      expect.objectContaining({
        clearedKeys: expect.arrayContaining(["strict:@ratelimit:strict"]),
      })
    );
  });

  it("awaits async hooks before returning", async () => {
    let asyncCompleted = false;
    const hooks: RateLimitHooks = {
      onSuccess: async () => {
        await new Promise((resolve) => {
          setTimeout(resolve, 10);
        });
        asyncCompleted = true;
      },
    };
    const { store } = createControllableStore({ limit: 5, success: true });
    const rateLimit = createRateLimit({
      env: "production",
      store,
      hooks,
    });

    try {
      await rateLimit.checkRateLimit(mockRequest(), { tier: "strict" });
      expect(asyncCompleted).toBe(true);
    } finally {
      rateLimit.reset();
    }
  });

  it("swallows hook errors and logs them", async () => {
    const logger = createSpyLogger();
    const hooks: RateLimitHooks = {
      onSuccess: () => {
        throw new Error("hook blew up");
      },
    };
    const { store } = createControllableStore({ limit: 5, success: true });
    const rateLimit = createRateLimit({
      env: "production",
      store,
      logger,
      hooks,
    });

    try {
      const result = await rateLimit.checkRateLimit(mockRequest(), {
        tier: "strict",
      });
      expect(result.ok).toBe(true);
      expect(logger.errorCalls).toHaveLength(1);
    } finally {
      rateLimit.reset();
    }
  });

  it("does not fire hooks when skipRateLimit is true", async () => {
    const onSuccess = vi.fn();
    const onLimitExceeded = vi.fn();
    const onFailure = vi.fn();
    const onStoreError = vi.fn();
    const { store } = createControllableStore();
    const rateLimit = createRateLimit({
      env: "production",
      store,
      hooks: { onSuccess, onLimitExceeded, onFailure, onStoreError },
    });

    try {
      await rateLimit.checkRateLimit(mockRequest(), {
        tier: "strict",
        skipRateLimit: true,
      });
      expect(onSuccess).not.toHaveBeenCalled();
      expect(onLimitExceeded).not.toHaveBeenCalled();
      expect(onFailure).not.toHaveBeenCalled();
      expect(onStoreError).not.toHaveBeenCalled();
    } finally {
      rateLimit.reset();
    }
  });
});
