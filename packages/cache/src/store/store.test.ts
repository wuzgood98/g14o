import { describe, expect, it } from "vitest";
import { createStore } from "./create-store";
import { globToRegExp } from "./glob";
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
      const regex = globToRegExp(pattern);
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

describe("globToRegExp literal metacharacters", () => {
  it("treats dots as literals while preserving wildcards", async () => {
    const store = memoryStore();
    await store.set("user.v1:a", { id: "a" });
    await store.set("userXv1:a", { id: "x" });

    const keys = await store.keys("user.v1:*");
    expect(keys).toEqual(["user.v1:a"]);
  });
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
          const regex = globToRegExp(pattern);
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

describe("createStore undefined serialization", () => {
  it("writes a raw string for undefined and round-trips", async () => {
    rawMap.clear();
    const store = createMapStore();

    await store.set("undef", undefined);
    const entry = rawMap.get("undef");
    expect(entry).toBeDefined();
    expect(typeof entry?.raw).toBe("string");
    expect(await store.get("undef")).toBeUndefined();
  });

  it("round-trips null distinctly from undefined", async () => {
    rawMap.clear();
    const store = createMapStore();

    await store.set("nil", null);
    expect(await store.get("nil")).toBeNull();

    await store.set("undef", undefined);
    expect(await store.get("undef")).toBeUndefined();
  });

  it("coerces a custom serialize returning undefined to a string write", async () => {
    rawMap.clear();
    const store = createStore(
      {
        read(key) {
          return rawMap.get(key)?.raw ?? null;
        },
        write(key, value) {
          rawMap.set(key, { raw: value, expiresAt: null });
        },
        remove(...keys) {
          return keys.filter((key) => rawMap.delete(key)).length;
        },
        list() {
          return Array.from(rawMap.keys());
        },
      },
      {
        serialize: () => undefined as unknown as string,
        deserialize: <T>(_raw: string): T => "deserialized" as T,
      }
    );

    await store.set("custom", { any: true });
    const entry = rawMap.get("custom");
    expect(typeof entry?.raw).toBe("string");
    expect(await store.get("custom")).toBe("deserialized");
  });
});
