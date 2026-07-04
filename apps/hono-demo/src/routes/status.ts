import { middleware } from "../lib/ratelimit";
import type { Context } from "../types";

export const statusMiddleware = middleware({ tier: "lenient" });

export function statusHandler(c: Context) {
  return c.json({
    ok: true,
    limit: c.res.headers.get("X-RateLimit-Limit"),
    remaining: c.res.headers.get("X-RateLimit-Remaining"),
  });
}
