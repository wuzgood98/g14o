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
const CRLF_PATTERN = /[\r\n]/;

function mockRequest(headers: Record<string, string | null> = {}): Request {
  const requestHeaders = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (value !== null) {
      requestHeaders.set(name, value);
    }
  }
  return new Request("http://localhost/api", { headers: requestHeaders });
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

    it("strips CR/LF from req.url and identifier in log messages", async () => {
      const logger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const limited = createRateLimit({ env: "test", logger });

      try {
        const req = new Request("http://localhost/api%0Ainjected%0Dline");
        const maliciousIdentifier = "client\r\nINJECTED";

        await limited.checkRateLimit(req, {
          tier: "strict",
          identifierFn: async () => maliciousIdentifier,
        });

        const logMessages = [
          ...logger.info.mock.calls,
          ...logger.warn.mock.calls,
          ...logger.error.mock.calls,
        ]
          .flat()
          .filter((arg): arg is string => typeof arg === "string");

        expect(logMessages.length).toBeGreaterThan(0);
        for (const message of logMessages) {
          expect(message).not.toMatch(CRLF_PATTERN);
        }
      } finally {
        limited.reset();
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

    it("merges custom strict tier limit", async () => {
      const custom = createRateLimit({
        env: "test",
        tiers: { strict: { limit: 2 } },
      });

      try {
        const req = mockRequest({ "x-forwarded-for": "custom-strict" });
        const options = { tier: "strict" as const };

        for (let i = 0; i < 2; i++) {
          expect(await custom.checkRateLimit(req, options)).toMatchObject({
            ok: true,
          });
        }

        const blocked = await custom.checkRateLimit(req, options);
        expect(blocked.ok).toBe(false);
      } finally {
        custom.reset();
      }
    });

    it("keeps default limit for unconfigured tiers", async () => {
      const custom = createRateLimit({
        env: "test",
        tiers: { strict: { limit: 2 } },
      });

      try {
        const req = mockRequest({ "x-forwarded-for": "default-moderate" });
        const options = { tier: "moderate" as const };

        for (let i = 0; i < 10; i++) {
          expect(await custom.checkRateLimit(req, options)).toMatchObject({
            ok: true,
          });
        }

        const blocked = await custom.checkRateLimit(req, options);
        expect(blocked.ok).toBe(false);
      } finally {
        custom.reset();
      }
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

  describe("withRateLimit", () => {
    it("returns 429 when limit exceeded", async () => {
      const handler = vi.fn(async (_req: Request) =>
        Response.json({ ok: true })
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
