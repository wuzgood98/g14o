import { describe, expect, it } from "vitest";
import { createStore } from "./create-store";
import { memoryStore } from "./memory";
import { describeStore } from "./store-contract";

const rawMap = new Map<string, { raw: string; expiresAt: number | null }>();

function createMapStore() {
  return createStore({
    read(key) {
      const entry = rawMap.get(key);
      if (!entry) {
        return null;
      }
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        rawMap.delete(key);
        return null;
      }
      return entry.raw;
    },
    write(key, value, ttlSeconds) {
      const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
      rawMap.set(key, { raw: value, expiresAt });
    },
    remove(...keys) {
      let deleted = 0;
      for (const key of keys) {
        if (rawMap.delete(key)) {
          deleted += 1;
        }
      }
      return deleted;
    },
    list(pattern) {
      const regexPattern = pattern.replace(/\*/g, ".*").replace(/\?/g, ".");
      const regex = new RegExp(`^${regexPattern}$`);
      const now = Date.now();
      return Array.from(rawMap.entries())
        .filter(([, entry]) => !entry.expiresAt || entry.expiresAt > now)
        .map(([key]) => key)
        .filter((key) => regex.test(key));
    },
  });
}

describeStore("memoryStore", () => memoryStore());

describeStore("createStore (raw Map primitives)", () => {
  rawMap.clear();
  return createMapStore();
});

describe("createStore prefix wrapper", () => {
  it("applies prefix transparently", async () => {
    rawMap.clear();
    const store = createStore(
      {
        read(key) {
          const entry = rawMap.get(key);
          return entry?.raw ?? null;
        },
        write(key, value) {
          rawMap.set(key, { raw: value, expiresAt: null });
        },
        remove(...keys) {
          return keys.filter((key) => rawMap.delete(key)).length;
        },
        list(pattern) {
          const regex = new RegExp(
            `^${pattern.replace(/\*/g, ".*").replace(/\?/g, ".")}$`
          );
          return Array.from(rawMap.keys()).filter((key) => regex.test(key));
        },
      },
      { prefix: "app" }
    );

    await store.set("user:1", { id: 1 }, 60);
    expect(rawMap.has("app:user:1")).toBe(true);
    expect(await store.get("user:1")).toEqual({ id: 1 });

    const keys = await store.keys("user:*");
    expect(keys).toEqual(["user:1"]);
  });
});
