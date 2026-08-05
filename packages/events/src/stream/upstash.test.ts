import type { Redis } from "@upstash/redis";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_UPSTASH_CHANNEL_PREFIX, upstashStream } from "./upstash";

const SLASH_PREFIX_ERROR = /must not contain "\/"/;

function stubRedis(overrides: Partial<Redis> = {}): Redis {
  return {
    subscribe: vi.fn(() => ({
      on: vi.fn(),
      unsubscribe: vi.fn(),
    })),
    ...overrides,
  } as unknown as Redis;
}

describe("upstashStream", () => {
  it("rejects channelPrefix containing `/`", () => {
    expect(() =>
      upstashStream({
        redis: stubRedis(),
        channelPrefix: "@g14o/events",
      })
    ).toThrow(SLASH_PREFIX_ERROR);
  });

  it("default prefix has no `/`", () => {
    expect(DEFAULT_UPSTASH_CHANNEL_PREFIX.includes("/")).toBe(false);
  });

  it("accepts the default prefix", () => {
    expect(() => upstashStream({ redis: stubRedis() })).not.toThrow();
  });
});
