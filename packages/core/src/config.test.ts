import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  configureUtils,
  createRedisClient,
  getEnvName,
  getLogger,
  getRedis,
  isInMemoryBackend,
  isInMemoryEnv,
  isNextBuildLikePhase,
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

describe("isNextBuildLikePhase", () => {
  const originalNextPhase = process.env.NEXT_PHASE;

  afterEach(() => {
    if (originalNextPhase === undefined) {
      delete process.env.NEXT_PHASE;
    } else {
      process.env.NEXT_PHASE = originalNextPhase;
    }
  });

  it("returns true during Next production build", () => {
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    expect(isNextBuildLikePhase()).toBe(true);
    vi.unstubAllEnvs();
  });

  it("returns true during Next export", () => {
    vi.stubEnv("NEXT_PHASE", "phase-export");
    expect(isNextBuildLikePhase()).toBe(true);
    vi.unstubAllEnvs();
  });

  it("returns false when NEXT_PHASE is unset or runtime", () => {
    delete process.env.NEXT_PHASE;
    expect(isNextBuildLikePhase()).toBe(false);
    vi.stubEnv("NEXT_PHASE", "phase-production-server");
    expect(isNextBuildLikePhase()).toBe(false);
    vi.unstubAllEnvs();
  });
});

describe("isInMemoryEnv", () => {
  const originalNextPhase = process.env.NEXT_PHASE;

  afterEach(() => {
    if (originalNextPhase === undefined) {
      delete process.env.NEXT_PHASE;
    } else {
      process.env.NEXT_PHASE = originalNextPhase;
    }
    vi.unstubAllEnvs();
  });

  it("returns true for test and development", () => {
    expect(isInMemoryEnv("test")).toBe(true);
    expect(isInMemoryEnv("development")).toBe(true);
  });

  it("returns false for production when not in a Next build phase", () => {
    delete process.env.NEXT_PHASE;
    expect(isInMemoryEnv("production")).toBe(false);
  });

  it("returns true for production during Next build/export by default", () => {
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    expect(isInMemoryEnv("production")).toBe(true);
    vi.unstubAllEnvs();

    vi.stubEnv("NEXT_PHASE", "phase-export");
    expect(isInMemoryEnv("production")).toBe(true);
    vi.unstubAllEnvs();
  });

  it("returns false for production during Next build when inMemoryDuringNextBuild is false", () => {
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    expect(
      isInMemoryEnv("production", { inMemoryDuringNextBuild: false })
    ).toBe(false);
    vi.unstubAllEnvs();
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
  const originalNextPhase = process.env.NEXT_PHASE;

  beforeEach(() => {
    configureUtils({ env: "test" });
  });

  afterEach(() => {
    if (originalNextPhase === undefined) {
      delete process.env.NEXT_PHASE;
    } else {
      process.env.NEXT_PHASE = originalNextPhase;
    }
    vi.unstubAllEnvs();
  });

  it("returns true for test and development", () => {
    configureUtils({ env: "test" });
    expect(isInMemoryBackend()).toBe(true);
    configureUtils({ env: "development" });
    expect(isInMemoryBackend()).toBe(true);
  });

  it("returns false for production when not in a Next build phase", () => {
    delete process.env.NEXT_PHASE;
    configureUtils({ env: "production" });
    expect(isInMemoryBackend()).toBe(false);
  });

  it("returns true for production during Next build by default", () => {
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    configureUtils({ env: "production" });
    expect(isInMemoryBackend()).toBe(true);
    vi.unstubAllEnvs();
  });

  it("returns false for production during Next build when opted out via configureUtils", () => {
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    configureUtils({
      env: "production",
      inMemoryDuringNextBuild: false,
    });
    expect(isInMemoryBackend()).toBe(false);
    configureUtils({ env: "test", inMemoryDuringNextBuild: true });
    vi.unstubAllEnvs();
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
