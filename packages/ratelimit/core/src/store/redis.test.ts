import { describe, expect, it, vi } from "vitest";
import { type IoRedisLike, type NodeRedisLike, redisStore } from "./redis";

const REDIS_CONNECTION_ERROR = /Redis.*ECONNREFUSED/;

function createNodeRedisMock(
  handlers: {
    eval?: NodeRedisLike["eval"];
    evalSha?: NodeRedisLike["evalSha"];
    scriptLoad?: NodeRedisLike["scriptLoad"];
  } = {}
): NodeRedisLike {
  return {
    eval:
      handlers.eval ??
      vi.fn(() => Promise.resolve([1, 1, Date.now() + 60_000])),
    evalSha:
      handlers.evalSha ??
      vi.fn(() => Promise.resolve([1, 1, Date.now() + 60_000])),
    scriptLoad: handlers.scriptLoad ?? vi.fn(() => Promise.resolve("mock-sha")),
  };
}

function createIoRedisMock(
  handlers: {
    eval?: IoRedisLike["eval"];
    evalsha?: IoRedisLike["evalsha"];
    script?: IoRedisLike["script"];
  } = {}
): IoRedisLike {
  return {
    defineCommand: vi.fn(),
    status: "ready",
    eval:
      handlers.eval ??
      vi.fn(() => Promise.resolve([1, 1, Date.now() + 60_000])),
    evalsha:
      handlers.evalsha ??
      vi.fn(() => Promise.resolve([1, 1, Date.now() + 60_000])),
    script: handlers.script ?? vi.fn(() => Promise.resolve("mock-sha")),
  };
}

describe("redisStore", () => {
  it("throws for an unsupported client", () => {
    expect(() => redisStore({} as NodeRedisLike)).toThrow(
      "Invalid Redis client: provide a node-redis client (from `redis`) or an ioredis client (from `ioredis`)."
    );
  });

  it("accepts a node-redis client", () => {
    const store = redisStore(createNodeRedisMock());
    expect(typeof store.createLimiter).toBe("function");
  });

  it("accepts an ioredis client", () => {
    const store = redisStore(createIoRedisMock());
    expect(typeof store.createLimiter).toBe("function");
  });

  it("builds keys from prefix and identifier", async () => {
    const evalMock = vi.fn(() => Promise.resolve([1, 1, Date.now() + 60_000]));
    const client = createNodeRedisMock({
      eval: evalMock,
      evalSha: vi.fn(() =>
        Promise.reject(
          new Error("NOSCRIPT No matching script. Please use EVAL.")
        )
      ),
      scriptLoad: vi.fn(() => Promise.resolve("sha")),
    });

    const store = redisStore(client);
    const limiter = store.createLimiter({
      limit: 10,
      window: "60 s",
      prefix: "@ratelimit:test",
    });

    await limiter.limit("user-123");

    expect(evalMock).toHaveBeenCalledWith(
      expect.stringContaining("ZREMRANGEBYSCORE"),
      expect.objectContaining({
        keys: ["@ratelimit:test:user-123"],
        arguments: expect.arrayContaining([
          expect.any(String),
          expect.any(String),
          "10",
          expect.any(String),
        ]),
      })
    );
  });

  it("maps allowed script results to success responses", async () => {
    const resetAt = Date.now() + 60_000;
    const client = createNodeRedisMock({
      evalSha: vi.fn(() => Promise.resolve([1, 3, resetAt])),
      scriptLoad: vi.fn(() => Promise.resolve("sha")),
    });

    const store = redisStore(client);
    const limiter = store.createLimiter({
      limit: 5,
      window: "60 s",
      prefix: "@ratelimit:test",
    });

    const result = await limiter.limit("client-a");

    expect(result).toEqual({
      success: true,
      limit: 5,
      remaining: 2,
      reset: resetAt,
    });
  });

  it("maps blocked script results to failure responses", async () => {
    const resetAt = Date.now() + 60_000;
    const client = createNodeRedisMock({
      evalSha: vi.fn(() => Promise.resolve([0, 5, resetAt])),
      scriptLoad: vi.fn(() => Promise.resolve("sha")),
    });

    const store = redisStore(client);
    const limiter = store.createLimiter({
      limit: 5,
      window: "60 s",
      prefix: "@ratelimit:test",
    });

    const result = await limiter.limit("client-a");

    expect(result).toEqual({
      success: false,
      limit: 5,
      remaining: 0,
      reset: resetAt,
    });
  });

  it("falls back to eval when evalSha returns NOSCRIPT", async () => {
    const evalMock = vi.fn(() => Promise.resolve([1, 1, Date.now() + 60_000]));
    const evalShaMock = vi.fn(() =>
      Promise.reject(new Error("NOSCRIPT No matching script. Please use EVAL."))
    );
    const scriptLoadMock = vi
      .fn()
      .mockResolvedValueOnce("sha")
      .mockResolvedValueOnce("new-sha");

    const client = createNodeRedisMock({
      eval: evalMock,
      evalSha: evalShaMock,
      scriptLoad: scriptLoadMock,
    });

    const store = redisStore(client);
    const limiter = store.createLimiter({
      limit: 1,
      window: "60 s",
      prefix: "@ratelimit:noscript",
    });

    await limiter.limit("client-a");

    expect(evalShaMock).toHaveBeenCalled();
    expect(evalMock).toHaveBeenCalled();
  });

  it("uses ioredis eval with positional arguments", async () => {
    const evalMock = vi.fn(() => Promise.resolve([1, 1, Date.now() + 60_000]));
    const client = createIoRedisMock({
      eval: evalMock,
      evalsha: vi.fn(() =>
        Promise.reject(
          new Error("NOSCRIPT No matching script. Please use EVAL.")
        )
      ),
      script: vi.fn(() => Promise.resolve("sha")),
    });

    const store = redisStore(client);
    const limiter = store.createLimiter({
      limit: 1,
      window: "60 s",
      prefix: "@ratelimit:ioredis",
    });

    await limiter.limit("client-a");

    expect(evalMock).toHaveBeenCalledWith(
      expect.stringContaining("ZREMRANGEBYSCORE"),
      1,
      "@ratelimit:ioredis:client-a",
      expect.any(String),
      expect.any(String),
      "1",
      expect.any(String)
    );
  });

  it("wraps Redis command failures with context", async () => {
    const client = createNodeRedisMock({
      evalSha: vi.fn(() =>
        Promise.reject(
          new Error("NOSCRIPT No matching script. Please use EVAL.")
        )
      ),
      eval: vi.fn(() => Promise.reject(new Error("ECONNREFUSED"))),
      scriptLoad: vi.fn(() => Promise.resolve("sha")),
    });

    const store = redisStore(client);
    const limiter = store.createLimiter({
      limit: 1,
      window: "60 s",
      prefix: "@ratelimit:error",
    });

    await expect(limiter.limit("client-a")).rejects.toThrow(
      REDIS_CONNECTION_ERROR
    );
  });
});
