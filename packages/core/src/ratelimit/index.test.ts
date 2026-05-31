import { configureUtils } from "@g14o/utils/config";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkRateLimit,
  createRateLimit,
  getDefaultIdentifier,
  parseDurationToMs,
  resetRateLimiters,
  withRateLimit,
} from "./index";

const INVALID_DURATION_PATTERN = /Invalid rate limit window/;

function mockRequest(headers: Record<string, string | null> = {}): NextRequest {
  return {
    url: "http://localhost/api",
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  } as unknown as NextRequest;
}

describe("createRateLimit (factory API)", () => {
  let rateLimit: ReturnType<typeof createRateLimit>;

  beforeEach(() => {
    rateLimit = createRateLimit({ env: "test" });
    rateLimit.reset();
  });

  describe("checkRateLimit", () => {
    it("blocks after strict tier limit is exceeded", async () => {
      const req = mockRequest({ "x-forwarded-for": "strict-client" });
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
      const result = await rateLimit.checkRateLimit(mockRequest(), {
        skipRateLimit: async () => true,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.remaining).toBe(999_999);
      }
    });

    it("fails open on internal errors", async () => {
      rateLimit.reset();
      const production = createRateLimit({ env: "production" });

      const result = await production.checkRateLimit(mockRequest(), {
        tier: "moderate",
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.remaining).toBe(0);
        expect(result.limit).toBe(0);
      }
    });
  });

  describe("withRateLimit", () => {
    it("returns 429 when limit exceeded", async () => {
      const handler = vi.fn(async (_req: NextRequest) =>
        NextResponse.json({ ok: true })
      );
      const limited = rateLimit.withRateLimit(handler, {
        tier: "strict",
        identifierFn: async () => "wrapped-strict",
      });

      const req = mockRequest();
      for (let i = 0; i < 5; i++) {
        const res = await limited(req);
        expect(res.status).toBe(200);
      }

      const blocked = await limited(req);
      expect(blocked.status).toBe(429);
      expect(handler).toHaveBeenCalledTimes(5);
    });
  });
});

describe("parseDurationToMs", () => {
  it("parses supported duration strings", () => {
    expect(parseDurationToMs("60 s")).toBe(60_000);
    expect(parseDurationToMs("15 m")).toBe(900_000);
    expect(parseDurationToMs("1 h")).toBe(3_600_000);
  });

  it("throws on invalid format", () => {
    expect(() => parseDurationToMs("invalid" as "60 s")).toThrow(
      INVALID_DURATION_PATTERN
    );
  });
});

describe("getDefaultIdentifier", () => {
  it("uses x-forwarded-for when present", () => {
    expect(
      getDefaultIdentifier(
        mockRequest({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" })
      )
    ).toBe("1.2.3.4");
  });

  it("falls back to anonymous", () => {
    expect(getDefaultIdentifier(mockRequest())).toBe("anonymous");
  });
});

describe("deprecated global exports", () => {
  beforeEach(() => {
    configureUtils({ env: "test" });
    resetRateLimiters();
  });

  it("checkRateLimit works via deprecated global API", async () => {
    const req = mockRequest({ "x-forwarded-for": "legacy-client" });
    const result = await checkRateLimit(req, { tier: "moderate" });
    expect(result.ok).toBe(true);
  });

  it("withRateLimit works via deprecated global API", async () => {
    const handler = vi.fn(async (_req: NextRequest) =>
      NextResponse.json({ ok: true })
    );
    const limited = withRateLimit(handler, {
      tier: "strict",
      identifierFn: async () => "legacy-wrapped",
    });
    const res = await limited(mockRequest());
    expect(res.status).toBe(200);
    resetRateLimiters();
  });
});
