import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  configureUtils,
  createRedisClient,
  getEnvName,
  getLogger,
  getRedis,
  isInMemoryBackend,
  isInMemoryEnv,
  resolveEnvName,
  resolveRedisClient,
} from "./config";

describe("resolveEnvName", () => {
  it("prefers explicit env over NODE_ENV", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(resolveEnvName("test")).toBe("test");
    vi.unstubAllEnvs();
  });

  it("falls back to NODE_ENV then development", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(resolveEnvName()).toBe("production");
    vi.unstubAllEnvs();
  });
});

describe("isInMemoryEnv", () => {
  it("returns true for test and development", () => {
    expect(isInMemoryEnv("test")).toBe(true);
    expect(isInMemoryEnv("development")).toBe(true);
  });

  it("returns false for production", () => {
    expect(isInMemoryEnv("production")).toBe(false);
  });
});

describe("resolveRedisClient", () => {
  it("returns null when config is omitted", () => {
    expect(resolveRedisClient()).toBeNull();
  });

  it("returns a duck-typed Redis client as-is", () => {
    const client = {
      get: vi.fn(),
      set: vi.fn(),
    } as unknown as import("@upstash/redis").Redis;
    expect(resolveRedisClient(client)).toBe(client);
  });

  it("creates a client from credentials", () => {
    const client = resolveRedisClient({
      url: "https://example.upstash.io",
      token: "test-token",
    });
    expect(client).toBeTruthy();
    expect(typeof client?.get).toBe("function");
  });
});

describe("createRedisClient", () => {
  it("constructs a Redis instance from credentials", () => {
    const client = createRedisClient({
      url: "https://example.upstash.io",
      token: "test-token",
    });
    expect(typeof client.get).toBe("function");
  });
});

describe("configureUtils", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
    configureUtils({ env: "test" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    configureUtils({ env: "test" });
  });

  it("updates logger when provided", () => {
    const info = vi.fn();
    configureUtils({ logger: { info, warn: vi.fn(), error: vi.fn() } });
    getLogger().info("hello");
    expect(info).toHaveBeenCalledWith("hello");
  });

  it("updates env override", () => {
    configureUtils({ env: "production" });
    expect(getEnvName()).toBe("production");
    expect(isInMemoryBackend()).toBe(false);
  });

  it("accepts redis credentials", () => {
    configureUtils({
      redis: { url: "https://example.upstash.io", token: "token" },
    });
    expect(getRedis()).toBeTruthy();
  });
});

describe("isInMemoryBackend", () => {
  beforeEach(() => {
    configureUtils({ env: "test" });
  });

  it("returns true for test and development", () => {
    configureUtils({ env: "test" });
    expect(isInMemoryBackend()).toBe(true);
    configureUtils({ env: "development" });
    expect(isInMemoryBackend()).toBe(true);
  });

  it("returns false for production", () => {
    configureUtils({ env: "production" });
    expect(isInMemoryBackend()).toBe(false);
  });
});

describe("getEnvName", () => {
  it("prefers configureUtils env over NODE_ENV", () => {
    vi.stubEnv("NODE_ENV", "production");
    configureUtils({ env: "test" });
    expect(getEnvName()).toBe("test");
    vi.unstubAllEnvs();
  });
});
