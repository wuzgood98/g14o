import type { Context } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRateLimit,
  getDefaultIdentifier,
  getTokenConfigReadonly,
  parseDurationToMs,
  tokenConfigSnapshot,
} from "./index";

const INVALID_DURATION_PATTERN = /Invalid rate limit window/;
const INVALID_LIMIT_PATTERN = /limit must be a positive number/;
const INVALID_WINDOW_POSITIVE_PATTERN = /window must be a positive duration/;
const INVALID_PREFIX_PATTERN = /prefix must be a non-empty string/;

function mockRequest(
  headers: Record<string, string | null> = {},
  url = "http://localhost/api/test"
): Request {
  return {
    url,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  } as unknown as Request;
}

function mockContext(
  headers: Record<string, string | null> = {},
  url = "http://localhost/api/test"
): Context {
  const raw = mockRequest(headers, url);
  const headerMap = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );
  const res = new Response(null, { status: 200 });

  return {
    req: {
      raw,
      header: (name: string) => headerMap[name.toLowerCase()] ?? undefined,
    },
    res,
    header: (name: string, value: string) => {
      res.headers.set(name, value);
    },
  } as unknown as Context;
}

describe("createRateLimit (Hono factory API)", () => {
  let rateLimit: ReturnType<typeof createRateLimit>;

  beforeEach(() => {
    rateLimit = createRateLimit({ env: "test" });
    rateLimit.reset();
  });

  describe("checkRateLimit", () => {
    it("blocks after strict tier limit is exceeded", async () => {
      const c = mockContext({ "x-forwarded-for": "strict-client" });
      const options = { tier: "strict" as const };

      for (let i = 0; i < 5; i++) {
        const result = await rateLimit.checkRateLimit(c, options);
        expect(result.ok).toBe(true);
      }

      const blocked = await rateLimit.checkRateLimit(c, options);
      expect(blocked.ok).toBe(false);
      if (!blocked.ok) {
        expect(blocked.status).toBe(429);
      }
    });

    it("skips when skipRateLimit returns true", async () => {
      const result = await rateLimit.checkRateLimit(mockContext(), {
        skipRateLimit: async () => true,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.remaining).toBe(999_999);
      }
    });

    it("skips when skipRateLimit is true", async () => {
      const result = await rateLimit.checkRateLimit(mockContext(), {
        skipRateLimit: true,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.remaining).toBe(999_999);
      }
    });

    it("passes native Hono context to identifierFn", async () => {
      const identifierFn = vi.fn((ctx: Context) => {
        expect(ctx.req.raw.url).toBe("http://localhost/api/custom");
        return "custom-id";
      });

      await rateLimit.checkRateLimit(
        mockContext({}, "http://localhost/api/custom"),
        {
          tier: "strict",
          identifierFn,
        }
      );

      expect(identifierFn).toHaveBeenCalledOnce();
    });

    it("fails open on internal errors", async () => {
      rateLimit.reset();
      const production = createRateLimit({ env: "production" });

      const result = await production.checkRateLimit(mockContext(), {
        tier: "moderate",
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.remaining).toBe(0);
        expect(result.limit).toBe(0);
      }
    });
  });

  describe("middleware", () => {
    it("calls next when allowed and sets rate-limit headers on c.res", async () => {
      const c = mockContext({ "x-forwarded-for": "middleware-pass" });
      const next = vi.fn();
      const handler = rateLimit.middleware({ tier: "strict" });

      await handler(c, next);

      expect(next).toHaveBeenCalledOnce();
      expect(c.res.headers.get("X-RateLimit-Limit")).not.toBeNull();
      expect(c.res.headers.get("X-RateLimit-Remaining")).not.toBeNull();
    });

    it("sets rate-limit headers on c.res before next() so handlers can read them", async () => {
      const c = mockContext({
        "x-forwarded-for": "middleware-read-during-next",
      });
      const handler = rateLimit.middleware({ tier: "strict" });
      let limitDuringNext: string | null = null;
      let remainingDuringNext: string | null = null;

      const next = vi.fn(async () => {
        limitDuringNext = c.res.headers.get("X-RateLimit-Limit");
        remainingDuringNext = c.res.headers.get("X-RateLimit-Remaining");
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      await handler(c, next);

      expect(next).toHaveBeenCalledOnce();
      expect(limitDuringNext).not.toBeNull();
      expect(remainingDuringNext).not.toBeNull();
    });

    it("does not call next and returns 429 when limit exceeded", async () => {
      const c = mockContext({ "x-forwarded-for": "middleware-block" });
      const options = {
        tier: "strict" as const,
        identifierFn: async () => "middleware-block",
      };
      const limited = rateLimit.middleware(options);

      for (let i = 0; i < 5; i++) {
        const ctx = mockContext({ "x-forwarded-for": "middleware-block" });
        const next = vi.fn();
        await limited(ctx, next);
        expect(next).toHaveBeenCalledOnce();
      }

      const blockedNext = vi.fn();
      const response = await limited(c, blockedNext);

      expect(blockedNext).not.toHaveBeenCalled();
      expect(response).toBeInstanceOf(Response);
      expect(response?.status).toBe(429);
      const body = await response?.json();
      expect(body).toMatchObject({
        error: "Too many requests",
        retryAfter: expect.any(Number),
      });
      expect(response?.headers.get("Retry-After")).not.toBeNull();
    });
  });

  describe("withRateLimit", () => {
    it("invokes handler only when allowed and attaches headers", async () => {
      const handler = vi.fn(() => Response.json({ ok: true }));
      const limited = rateLimit.withRateLimit(handler, {
        tier: "strict",
        identifierFn: async () => "wrapped-strict",
      });

      const c = mockContext();
      for (let i = 0; i < 5; i++) {
        const response = await limited(c, vi.fn());
        expect(handler).toHaveBeenCalledTimes(i + 1);
        expect(response?.status).toBe(200);
        expect(response?.headers.get("X-RateLimit-Limit")).not.toBeNull();
        expect(response?.headers.get("X-RateLimit-Remaining")).not.toBeNull();
      }

      const blockedResponse = await limited(c, vi.fn());

      expect(handler).toHaveBeenCalledTimes(5);
      expect(blockedResponse?.status).toBe(429);
    });
  });

  describe("userMiddleware", () => {
    it("uses user id as identifier when present", async () => {
      const c = mockContext({ "x-user-id": "user-42" });
      const next = vi.fn();

      await rateLimit.userMiddleware(
        async (ctx) => ctx.req.header("x-user-id") ?? null,
        {
          tier: "strict",
        }
      )(c, next);

      expect(next).toHaveBeenCalledOnce();
    });
  });

  describe("tier override validation", () => {
    it("throws at init when limit is zero", () => {
      expect(() =>
        createRateLimit({ env: "test", tiers: { strict: { limit: 0 } } })
      ).toThrow(INVALID_LIMIT_PATTERN);
    });

    it("throws at init when window format is invalid", () => {
      expect(() =>
        createRateLimit({
          env: "test",
          tiers: { moderate: { window: "invalid" as "60 s" } },
        })
      ).toThrow(INVALID_DURATION_PATTERN);
    });

    it("throws at init when window is non-positive", () => {
      expect(() =>
        createRateLimit({ env: "test", tiers: { auth: { window: "0 s" } } })
      ).toThrow(INVALID_WINDOW_POSITIVE_PATTERN);
    });

    it("throws at init when prefix is empty", () => {
      expect(() =>
        createRateLimit({ env: "test", tiers: { write: { prefix: "" } } })
      ).toThrow(INVALID_PREFIX_PATTERN);
    });
  });

  describe("prefix isolation", () => {
    it("scopes limits independently per prefix", async () => {
      const c = mockContext({ "x-forwarded-for": "same-ip" });

      for (let i = 0; i < 5; i++) {
        expect(
          await rateLimit.checkRateLimit(c, {
            tier: "strict",
            prefix: "@ratelimit:endpoint-a",
          })
        ).toMatchObject({ ok: true });
      }

      expect(
        await rateLimit.checkRateLimit(c, {
          tier: "strict",
          prefix: "@ratelimit:endpoint-a",
        })
      ).toMatchObject({ ok: false });

      expect(
        await rateLimit.checkRateLimit(c, {
          tier: "strict",
          prefix: "@ratelimit:endpoint-b",
        })
      ).toMatchObject({ ok: true });
    });
  });
});

describe("getDefaultIdentifier via c.req.raw", () => {
  it("extracts IP from adapted request", () => {
    const c = mockContext({ "x-forwarded-for": "1.2.3.4" });
    expect(getDefaultIdentifier(c.req.raw)).toBe("1.2.3.4");
  });
});

describe("parseDurationToMs", () => {
  it("parses supported duration strings", () => {
    expect(parseDurationToMs("60 s")).toBe(60_000);
    expect(parseDurationToMs("60s")).toBe(60_000);
    expect(parseDurationToMs("500ms")).toBe(500);
    expect(parseDurationToMs("15 m")).toBe(900_000);
    expect(parseDurationToMs("1 h")).toBe(3_600_000);
  });

  it("throws on invalid format", () => {
    expect(() => parseDurationToMs("invalid" as "60 s")).toThrow(
      INVALID_DURATION_PATTERN
    );
  });
});

describe("tokenConfigSnapshot export", () => {
  it("exports frozen defaults that cannot be mutated", () => {
    expect(Object.isFrozen(tokenConfigSnapshot)).toBe(true);
    expect(Object.isFrozen(tokenConfigSnapshot.strict)).toBe(true);
    expect(() => {
      (tokenConfigSnapshot as { strict: { limit: number } }).strict.limit = 999;
    }).toThrow();
  });

  it("returns a new frozen clone from getTokenConfigReadonly", () => {
    const snapshot = getTokenConfigReadonly();
    expect(snapshot).not.toBe(tokenConfigSnapshot);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.moderate)).toBe(true);
    expect(snapshot.strict.limit).toBe(5);
  });
});
