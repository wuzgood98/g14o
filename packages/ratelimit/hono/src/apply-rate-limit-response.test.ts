import type { Context } from "hono";
import { describe, expect, it } from "vitest";
import {
  applyRateLimitHeadersToContext,
  applyRateLimitHeadersToResponse,
  applyRateLimitHeadersViaContext,
} from "./apply-rate-limit-response";

const rateLimitResult = {
  limit: 10,
  remaining: 7,
  reset: Date.now() + 60_000,
};

describe("applyRateLimitHeadersToResponse", () => {
  it("returns a new response with rate-limit headers without mutating the original", async () => {
    const original = await fetch("data:application/json,{}");
    expect(() => original.headers.set("X-Test", "1")).toThrow(TypeError);

    const updated = applyRateLimitHeadersToResponse(original, rateLimitResult);

    expect(updated).not.toBe(original);
    expect(updated.headers.get("X-RateLimit-Limit")).toBe("10");
    expect(updated.headers.get("X-RateLimit-Remaining")).toBe("7");
    expect(updated.headers.get("X-RateLimit-Reset")).toBe(
      rateLimitResult.reset.toString()
    );
    expect(original.headers.get("X-RateLimit-Limit")).toBeNull();
  });

  it("preserves status and body from the original response", async () => {
    const original = Response.json({ ok: true }, { status: 201 });
    const updated = applyRateLimitHeadersToResponse(original, rateLimitResult);

    expect(updated.status).toBe(201);
    expect(await updated.json()).toEqual({ ok: true });
  });
});

describe("applyRateLimitHeadersViaContext", () => {
  it("sets rate-limit headers via c.header without replacing c.res", () => {
    const res = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    const c = {
      res,
      header: (name: string, value: string) => {
        res.headers.set(name, value);
      },
    } as unknown as Context;

    applyRateLimitHeadersViaContext(c, rateLimitResult);

    expect(c.res).toBe(res);
    expect(c.res.headers.get("X-RateLimit-Limit")).toBe("10");
    expect(c.res.headers.get("X-RateLimit-Remaining")).toBe("7");
  });
});

describe("applyRateLimitHeadersToContext", () => {
  it("replaces c.res with a new response that has rate-limit headers", async () => {
    const original = await fetch("data:application/json,{}");
    expect(() => original.headers.set("X-Test", "1")).toThrow(TypeError);

    const c = { res: original } as unknown as Context;
    applyRateLimitHeadersToContext(c, rateLimitResult);

    expect(c.res).not.toBe(original);
    expect(c.res.headers.get("X-RateLimit-Limit")).toBe("10");
    expect(c.res.headers.get("X-RateLimit-Remaining")).toBe("7");
    expect(original.headers.get("X-RateLimit-Limit")).toBeNull();
  });
});
