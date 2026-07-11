import { randomUUID } from "node:crypto";
import { parseDurationToMs } from "../parse-duration";
import type {
  RateLimitResultData,
  RateLimitStore,
  RateLimitStoreConfig,
  RateLimitStoreLimiter,
} from "./interface";

/**
 * Atomic sliding-window log script.
 *
 * Why Lua: ZREMRANGEBYSCORE, ZCARD, conditional ZADD, and PEXPIRE must run
 * atomically so concurrent requests cannot over-count or leave inconsistent TTLs.
 *
 * KEYS[1]  — rate-limit key (`prefix:identifier`)
 * ARGV[1]  — current time (ms)
 * ARGV[2]  — window length (ms)
 * ARGV[3]  — max requests
 * ARGV[4]  — unique ZSET member for this request
 *
 * Returns: { allowed (0|1), count, reset (ms epoch) }
 */
const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

local cutoff = now - windowMs
redis.call('ZREMRANGEBYSCORE', key, 0, cutoff)

local count = redis.call('ZCARD', key)
local allowed = 0

if count < limit then
  redis.call('ZADD', key, now, member)
  count = count + 1
  allowed = 1
end

redis.call('PEXPIRE', key, windowMs)

local oldest = now
local oldestEntries = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
if #oldestEntries > 0 then
  oldest = tonumber(oldestEntries[2])
end

local reset = oldest + windowMs
return { allowed, count, reset }
`;

const INVALID_CLIENT_ERROR =
  "Invalid Redis client: provide a node-redis client (from `redis`) or an ioredis client (from `ioredis`).";

/** node-redis v4/v5 client shape (subset used by this adapter). */
export interface NodeRedisLike {
  eval(
    script: string,
    options: { keys: string[]; arguments: string[] }
  ): Promise<unknown>;
  evalSha(
    sha: string,
    options: { keys: string[]; arguments: string[] }
  ): Promise<unknown>;
  scriptLoad(script: string): Promise<string>;
}

/** ioredis client shape (subset used by this adapter). */
export interface IoRedisLike {
  defineCommand(
    name: string,
    definition: { lua: string; numberOfKeys?: number }
  ): void;
  eval(
    script: string,
    numKeys: number,
    ...keysAndArgs: (string | number | Buffer)[]
  ): Promise<unknown>;
  evalsha(
    sha: string,
    numKeys: number,
    ...keysAndArgs: (string | number | Buffer)[]
  ): Promise<unknown>;
  // Return is `unknown` (not `string`) so real ioredis clients assign: their
  // overloaded `script` resolves to `Result<unknown, Context>`, which is not
  // assignable to `Promise<string>`.
  script(command: "LOAD", script: string): Promise<unknown>;
  status: string;
}

type RedisClientKind = "node-redis" | "ioredis";

interface NormalizedRedisClient {
  eval(keys: string[], args: string[]): Promise<[number, number, number]>;
  loadScript(): Promise<string>;
}

function isIoRedisLike(client: unknown): client is IoRedisLike {
  if (typeof client !== "object" || client === null) {
    return false;
  }
  const candidate = client as Record<string, unknown>;
  return (
    typeof candidate.defineCommand === "function" &&
    typeof candidate.status === "string"
  );
}

function isNodeRedisLike(client: unknown): client is NodeRedisLike {
  if (typeof client !== "object" || client === null) {
    return false;
  }
  const candidate = client as Record<string, unknown>;
  return (
    typeof candidate.scriptLoad === "function" ||
    typeof candidate.evalSha === "function"
  );
}

function detectClientKind(client: unknown): RedisClientKind {
  if (isIoRedisLike(client)) {
    return "ioredis";
  }
  if (isNodeRedisLike(client)) {
    return "node-redis";
  }
  throw new Error(INVALID_CLIENT_ERROR);
}

function isNoScriptError(error: unknown): boolean {
  return (
    error instanceof Error && error.message.toUpperCase().includes("NOSCRIPT")
  );
}

function parseScriptResult(result: unknown): [number, number, number] {
  if (!Array.isArray(result) || result.length < 3) {
    throw new Error(
      `Redis rate limit script returned unexpected result: ${String(result)}`
    );
  }
  const allowed = Number(result[0]);
  const count = Number(result[1]);
  const reset = Number(result[2]);
  if (Number.isNaN(allowed) || Number.isNaN(count) || Number.isNaN(reset)) {
    throw new Error(
      `Redis rate limit script returned non-numeric values: ${String(result)}`
    );
  }
  return [allowed, count, reset];
}

function wrapRedisError(error: unknown, context: string): Error {
  if (error instanceof Error) {
    if (error.message.startsWith("Redis ")) {
      return error;
    }
    return new Error(`Redis ${context}: ${error.message}`);
  }
  return new Error(`Redis ${context}: ${String(error)}`);
}

function normalizeClient(client: unknown): NormalizedRedisClient {
  const kind = detectClientKind(client);

  if (kind === "ioredis") {
    const ioClient = client as IoRedisLike;
    return {
      async loadScript() {
        try {
          const sha = await ioClient.script("LOAD", SLIDING_WINDOW_SCRIPT);
          if (typeof sha !== "string" || sha.length === 0) {
            throw new Error(
              `Redis SCRIPT LOAD returned unexpected value: ${String(sha)}`
            );
          }
          return sha;
        } catch (error) {
          throw wrapRedisError(error, "script load failed");
        }
      },
      async eval(keys, args) {
        const allArgs = [...keys, ...args];
        try {
          const result = await ioClient.eval(
            SLIDING_WINDOW_SCRIPT,
            keys.length,
            ...allArgs
          );
          return parseScriptResult(result);
        } catch (error) {
          throw wrapRedisError(error, "eval command failed");
        }
      },
    };
  }

  const nodeClient = client as NodeRedisLike;
  return {
    async loadScript() {
      try {
        return await nodeClient.scriptLoad(SLIDING_WINDOW_SCRIPT);
      } catch (error) {
        throw wrapRedisError(error, "script load failed");
      }
    },
    async eval(keys, args) {
      try {
        const result = await nodeClient.eval(SLIDING_WINDOW_SCRIPT, {
          keys,
          arguments: args,
        });
        return parseScriptResult(result);
      } catch (error) {
        throw wrapRedisError(error, "eval command failed");
      }
    },
  };
}

class ScriptRunner {
  private scriptSha: string | undefined;
  private readonly normalized: NormalizedRedisClient;
  private readonly kind: RedisClientKind;
  private readonly rawClient: unknown;

  constructor(client: unknown) {
    this.kind = detectClientKind(client);
    this.rawClient = client;
    this.normalized = normalizeClient(client);
  }

  private async evalSha(
    keys: string[],
    args: string[]
  ): Promise<[number, number, number]> {
    if (this.kind === "ioredis") {
      const ioClient = this.rawClient as IoRedisLike;
      const allArgs = [...keys, ...args];
      try {
        const result = await ioClient.evalsha(
          this.scriptSha ?? "",
          keys.length,
          ...allArgs
        );
        return parseScriptResult(result);
      } catch (error) {
        throw wrapRedisError(error, "evalsha command failed");
      }
    }

    const nodeClient = this.rawClient as NodeRedisLike;
    try {
      const result = await nodeClient.evalSha(this.scriptSha ?? "", {
        keys,
        arguments: args,
      });
      return parseScriptResult(result);
    } catch (error) {
      throw wrapRedisError(error, "evalsha command failed");
    }
  }

  async run(keys: string[], args: string[]): Promise<[number, number, number]> {
    if (this.scriptSha === undefined) {
      try {
        this.scriptSha = await this.normalized.loadScript();
      } catch {
        return this.normalized.eval(keys, args);
      }
    }

    try {
      return await this.evalSha(keys, args);
    } catch (error) {
      if (!isNoScriptError(error)) {
        throw error;
      }
      try {
        return await this.normalized.eval(keys, args);
      } catch (evalError) {
        throw wrapRedisError(evalError, "eval fallback after NOSCRIPT failed");
      } finally {
        try {
          this.scriptSha = await this.normalized.loadScript();
        } catch {
          this.scriptSha = undefined;
        }
      }
    }
  }
}

class RedisRateLimiter implements RateLimitStoreLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly keyPrefix: string;
  private readonly runner: ScriptRunner;
  private sequence = 0;

  constructor(config: RateLimitStoreConfig, runner: ScriptRunner) {
    this.maxRequests = config.limit;
    this.windowMs = parseDurationToMs(config.window);
    this.keyPrefix = config.prefix;
    this.runner = runner;
  }

  async limit(identifier: string): Promise<RateLimitResultData> {
    const now = Date.now();
    const key = `${this.keyPrefix}:${identifier}`;
    const member = `${now}:${this.sequence++}:${randomUUID()}`;

    const [allowed, count, reset] = await this.runner.run(
      [key],
      [String(now), String(this.windowMs), String(this.maxRequests), member]
    );

    return {
      success: allowed === 1,
      limit: this.maxRequests,
      remaining: Math.max(0, this.maxRequests - count),
      reset,
    };
  }
}

/** Options for {@link redisStore}. Reserved for future configuration. */
export type RedisStoreOptions = Record<string, never>;

/**
 * Creates a Redis rate limit store backed by a sliding-window log (ZSET).
 *
 * Accepts either a **node-redis** client (`redis` package) or an **ioredis**
 * client. Install one peer dependency and pass a connected client instance.
 *
 * @param client - Connected node-redis or ioredis client.
 * @param _options - Reserved for future configuration.
 * @returns A {@link RateLimitStore} backed by Redis.
 *
 * @example
 * ```ts
 * import { createClient } from "redis";
 * import { redisStore } from "@g14o/ratelimit/redis";
 *
 * const redis = createClient({ url: process.env.REDIS_URL });
 * await redis.connect();
 *
 * createRateLimit({ store: redisStore(redis) });
 * ```
 */
export function redisStore(
  client: NodeRedisLike | IoRedisLike,
  _options?: RedisStoreOptions
): RateLimitStore {
  const runner = new ScriptRunner(client);

  return {
    createLimiter(config: RateLimitStoreConfig): RateLimitStoreLimiter {
      return new RedisRateLimiter(config, runner);
    },
  };
}
