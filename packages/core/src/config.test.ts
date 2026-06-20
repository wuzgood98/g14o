import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createRedisClient,
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
