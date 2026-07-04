import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  adaptExpressRequest,
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

function mockExpressRequest(
  headers: Record<string, string> = {},
  originalUrl = "/api/test"
): Request {
  return {
    protocol: "http",
    originalUrl,
    get: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
}

interface MockExpressResponse extends Response {
  body: unknown;
  capturedHeaders: Record<string, string>;
  statusCode: number;
}

function mockExpressResponse(): MockExpressResponse {
  const capturedHeaders: Record<string, string> = {};
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    capturedHeaders,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    setHeader(key: string, value: string) {
      capturedHeaders[key] = value;
      return res;
    },
    set(values: Record<string, string>) {
      Object.assign(capturedHeaders, values);
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    },
  } as unknown as MockExpressResponse;
  return res;
}

describe("adaptExpressRequest", () => {
  it("builds a RateLimitRequest from Express req", () => {
    const adapted = adaptExpressRequest(
      mockExpressRequest({ host: "example.com", "x-forwarded-for": "1.2.3.4" })
    );
    expect(adapted.url).toBe("http://example.com/api/test");
    expect(adapted.headers.get("x-forwarded-for")).toBe("1.2.3.4");
    expect(getDefaultIdentifier(adapted)).toBe("1.2.3.4");
  });
});

describe("createRateLimit (Express factory API)", () => {
  let rateLimit: ReturnType<typeof createRateLimit>;

  beforeEach(() => {
    rateLimit = createRateLimit({ env: "test" });
    rateLimit.reset();
  });

  describe("checkRateLimit", () => {
    it("blocks after strict tier limit is exceeded", async () => {
      const req = mockExpressRequest({ "x-forwarded-for": "strict-client" });
      const options = { tier: "strict" as const };

      for (let i = 0; i < 5; i++) {
        const result = await rateLimit.checkRateLimit(req, options);
        expect(result.ok).toBe(true);
      }

      const blocked = await rateLimit.checkRateLimit(req, options);
      expect(blocked.ok).toBe(false);
      if (!blocked.ok) {
        expect(blocked.status).toBe(429);
      }
    });

    it("skips when skipRateLimit returns true", async () => {
      const result = await rateLimit.checkRateLimit(mockExpressRequest(), {
        skipRateLimit: async () => true,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.remaining).toBe(999_999);
      }
    });

    it("passes native Express req to identifierFn", async () => {
      const identifierFn = vi.fn((req: Request) => {
        expect(req.originalUrl).toBe("/api/custom");
        return "custom-id";
      });

      await rateLimit.checkRateLimit(mockExpressRequest({}, "/api/custom"), {
        tier: "strict",
        identifierFn,
      });

      expect(identifierFn).toHaveBeenCalledOnce();
    });

    it("fails open on internal errors", async () => {
      rateLimit.reset();
      const production = createRateLimit({ env: "production" });

      const result = await production.checkRateLimit(mockExpressRequest(), {
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
    it("calls next when allowed and sets rate-limit headers", async () => {
      const req = mockExpressRequest({ "x-forwarded-for": "middleware-pass" });
      const res = mockExpressResponse();
      const next = vi.fn();
      const handler = rateLimit.middleware({ tier: "strict" });

      await handler(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(res.capturedHeaders["X-RateLimit-Limit"]).toEqual(
        expect.any(String)
      );
      expect(res.capturedHeaders["X-RateLimit-Remaining"]).toEqual(
        expect.any(String)
      );
    });

    it("does not call next and returns 429 when limit exceeded", async () => {
      const req = mockExpressRequest({ "x-forwarded-for": "middleware-block" });
      const options = {
        tier: "strict" as const,
        identifierFn: async () => "middleware-block",
      };
      const limited = rateLimit.middleware(options);

      for (let i = 0; i < 5; i++) {
        const res = mockExpressResponse();
        const next = vi.fn();
        await limited(req, res, next);
        expect(next).toHaveBeenCalledOnce();
      }

      const blockedRes = mockExpressResponse();
      const blockedNext = vi.fn();
      await limited(req, blockedRes, blockedNext);

      expect(blockedNext).not.toHaveBeenCalled();
      expect(blockedRes.statusCode).toBe(429);
      expect(blockedRes.body).toMatchObject({
        error: "Too many requests",
        retryAfter: expect.any(Number),
      });
      expect(blockedRes.capturedHeaders["Retry-After"]).toEqual(
        expect.any(String)
      );
    });
  });

  describe("withRateLimit", () => {
    it("invokes handler only when allowed", async () => {
      const handler = vi.fn((_req, res, next) => {
        res.json({ ok: true });
        next();
      });
      const limited = rateLimit.withRateLimit(handler, {
        tier: "strict",
        identifierFn: async () => "wrapped-strict",
      });

      const req = mockExpressRequest();
      for (let i = 0; i < 5; i++) {
        const res = mockExpressResponse();
        const next = vi.fn();
        await limited(req, res, next);
        expect(handler).toHaveBeenCalledTimes(i + 1);
      }

      const blockedRes = mockExpressResponse();
      const blockedNext = vi.fn();
      await limited(req, blockedRes, blockedNext);

      expect(handler).toHaveBeenCalledTimes(5);
      expect(blockedRes.statusCode).toBe(429);
      expect(blockedNext).not.toHaveBeenCalled();
    });
  });

  describe("userMiddleware", () => {
    it("uses user id as identifier when present", async () => {
      const req = mockExpressRequest({ "x-user-id": "user-42" });
      const res = mockExpressResponse();
      const next = vi.fn();

      await rateLimit.userMiddleware(async (r) => r.get("x-user-id") ?? null, {
        tier: "strict",
      })(req, res, next);

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
      const req = mockExpressRequest({ "x-forwarded-for": "same-ip" });

      for (let i = 0; i < 5; i++) {
        expect(
          await rateLimit.checkRateLimit(req, {
            tier: "strict",
            prefix: "@ratelimit:endpoint-a",
          })
        ).toMatchObject({ ok: true });
      }

      expect(
        await rateLimit.checkRateLimit(req, {
          tier: "strict",
          prefix: "@ratelimit:endpoint-a",
        })
      ).toMatchObject({ ok: false });

      expect(
        await rateLimit.checkRateLimit(req, {
          tier: "strict",
          prefix: "@ratelimit:endpoint-b",
        })
      ).toMatchObject({ ok: true });
    });
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
