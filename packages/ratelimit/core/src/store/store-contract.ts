import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { RateLimitStore } from "./interface";

export interface DescribeStoreOptions {
  /** When true, runs concurrent request tests. */
  supportsConcurrency?: boolean;
  /** When true, runs TTL/expiration tests that require real time delays. */
  supportsExpiration?: boolean;
}

/**
 * Shared contract suite for {@link RateLimitStore} implementations.
 *
 * Run against memory, Upstash, Redis, or any future adapter to verify
 * consistent limit enforcement, isolation, and result shape.
 */
export function describeStore(
  name: string,
  factory: () => RateLimitStore | Promise<RateLimitStore>,
  options: DescribeStoreOptions = {}
): void {
  const { supportsExpiration = true, supportsConcurrency = true } = options;

  describe(name, () => {
    it("enforces sliding window limits", async () => {
      const runId = randomUUID();
      const store = await factory();
      const limiter = store.createLimiter({
        limit: 2,
        window: "60 s",
        prefix: `@ratelimit:contract:${runId}`,
      });

      const first = await limiter.limit("client-a");
      expect(first.success).toBe(true);
      expect(first.remaining).toBe(1);
      expect(first.limit).toBe(2);
      expect(first.reset).toBeGreaterThan(Date.now());

      const second = await limiter.limit("client-a");
      expect(second.success).toBe(true);
      expect(second.remaining).toBe(0);

      const blocked = await limiter.limit("client-a");
      expect(blocked.success).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.limit).toBe(2);
    });

    it("isolates identifiers", async () => {
      const runId = randomUUID();
      const store = await factory();
      const limiter = store.createLimiter({
        limit: 1,
        window: "60 s",
        prefix: `@ratelimit:contract:${runId}`,
      });

      expect((await limiter.limit("client-a")).success).toBe(true);
      expect((await limiter.limit("client-a")).success).toBe(false);
      expect((await limiter.limit("client-b")).success).toBe(true);
    });

    it("uses prefix for key isolation", async () => {
      const runId = randomUUID();
      const store = await factory();
      const limiterA = store.createLimiter({
        limit: 1,
        window: "60 s",
        prefix: `@ratelimit:prefix-a:${runId}`,
      });
      const limiterB = store.createLimiter({
        limit: 1,
        window: "60 s",
        prefix: `@ratelimit:prefix-b:${runId}`,
      });

      expect((await limiterA.limit("shared-id")).success).toBe(true);
      expect((await limiterA.limit("shared-id")).success).toBe(false);
      expect((await limiterB.limit("shared-id")).success).toBe(true);
    });

    if (supportsConcurrency) {
      it("handles concurrent requests atomically", async () => {
        const runId = randomUUID();
        const store = await factory();
        const limiter = store.createLimiter({
          limit: 5,
          window: "60 s",
          prefix: `@ratelimit:concurrent:${runId}`,
        });
        const identifier = `concurrent-${Date.now()}`;

        const results = await Promise.all(
          Array.from({ length: 10 }, () => limiter.limit(identifier))
        );

        const allowed = results.filter((result) => result.success);
        const blocked = results.filter((result) => !result.success);

        expect(allowed).toHaveLength(5);
        expect(blocked).toHaveLength(5);
        for (const result of blocked) {
          expect(result.remaining).toBe(0);
        }
      });
    }

    if (supportsExpiration) {
      it("allows requests again after the window expires", async () => {
        const runId = randomUUID();
        const store = await factory();
        const limiter = store.createLimiter({
          limit: 1,
          window: "1 s",
          prefix: `@ratelimit:expire:${runId}`,
        });
        const identifier = `expire-${Date.now()}`;

        expect((await limiter.limit(identifier)).success).toBe(true);
        expect((await limiter.limit(identifier)).success).toBe(false);

        await vi.waitFor(
          async () => {
            const result = await limiter.limit(identifier);
            expect(result.success).toBe(true);
          },
          { timeout: 3000, interval: 200 }
        );
      }, 10_000);
    }
  });
}
