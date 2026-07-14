import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { CacheStore } from "./interface";

export interface DescribeStoreOptions {
  /** When true, runs TTL/expiration tests that require real time delays. */
  supportsExpiration?: boolean;
}

/**
 * Shared contract suite for {@link CacheStore} implementations.
 *
 * Run against memory, Upstash, Redis, or any future adapter to verify
 * consistent get/set/delete/keys behavior.
 */
export function describeStore(
  name: string,
  factory: () => CacheStore | Promise<CacheStore>,
  options: DescribeStoreOptions = {}
): void {
  const { supportsExpiration = true } = options;

  describe(name, () => {
    it("stores and retrieves JSON payloads", async () => {
      const runId = randomUUID();
      const store = await factory();
      const key = `@cache:contract:${runId}:payload`;
      const payload = { ok: true as const, data: { id: "test" } };

      await store.set(key, payload, 60);
      const cached = await store.get<typeof payload>(key);

      expect(cached).toEqual(payload);
    });

    it("returns null for missing keys", async () => {
      const store = await factory();
      const missing = await store.get(
        `@cache:contract:missing:${randomUUID()}`
      );
      expect(missing).toBeNull();
    });

    it("deletes keys", async () => {
      const runId = randomUUID();
      const store = await factory();
      const key = `@cache:contract:${runId}:delete`;

      await store.set(key, { value: 1 }, 60);
      const deleted = await store.delete(key);
      expect(deleted).toBeGreaterThanOrEqual(1);
      expect(await store.get(key)).toBeNull();
    });

    it("lists keys by pattern", async () => {
      const runId = randomUUID();
      const store = await factory();
      const prefix = `@cache:contract:${runId}`;
      const keyA = `${prefix}:a`;
      const keyB = `${prefix}:b`;

      await store.set(keyA, 1, 60);
      await store.set(keyB, 2, 60);

      const keys = await store.keys(`${prefix}:*`);
      expect(keys).toEqual(expect.arrayContaining([keyA, keyB]));
    });

    if (supportsExpiration) {
      it("expires entries after TTL", async () => {
        const runId = randomUUID();
        const store = await factory();
        const key = `@cache:contract:${runId}:expire`;

        await store.set(key, { value: "temp" }, 1);
        expect(await store.get(key)).toEqual({ value: "temp" });

        await vi.waitFor(
          async () => {
            expect(await store.get(key)).toBeNull();
          },
          { timeout: 3000, interval: 200 }
        );
      }, 10_000);
    }
  });
}
