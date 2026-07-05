import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { createRateLimit } from "./create-rate-limit-client";

describe("middleware with real Hono app", () => {
  let rateLimit: ReturnType<typeof createRateLimit>;

  beforeEach(() => {
    rateLimit = createRateLimit({ env: "test" });
    rateLimit.reset();
  });

  it("returns JSON body with limit/remaining on status-style route", async () => {
    const app = new Hono();
    app.get("/status", rateLimit.middleware({ tier: "lenient" }), (c) =>
      c.json({
        ok: true,
        limit: c.res.headers.get("X-RateLimit-Limit"),
        remaining: c.res.headers.get("X-RateLimit-Remaining"),
      })
    );

    const response = await app.request("/status");

    expect(response.status).toBe(200);
    expect(response.headers.get("X-RateLimit-Limit")).not.toBeNull();
    const body = await response.json();
    expect(body).toMatchObject({
      ok: true,
      limit: expect.any(String),
      remaining: expect.any(String),
    });
  });

  it("returns JSON body on user-action-style route", async () => {
    const app = new Hono();
    app.post(
      "/user-action",
      rateLimit.userMiddleware(async (c) => c.req.header("x-user-id") ?? null, {
        tier: "auth",
      }),
      (c) => c.json({ ok: true, message: "done" })
    );

    const response = await app.request("/user-action", {
      method: "POST",
      headers: { "x-user-id": "demo-user" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("X-RateLimit-Limit")).not.toBeNull();
    expect(await response.json()).toEqual({ ok: true, message: "done" });
  });
});
