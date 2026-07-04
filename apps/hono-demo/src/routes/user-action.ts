import { userMiddleware } from "../lib/ratelimit";
import type { Context } from "../types";

export const userActionMiddleware = userMiddleware(
  async (c) => c.req.header("x-user-id") ?? null,
  { tier: "auth" }
);

export function userActionHandler(c: Context) {
  return c.json({ ok: true, message: "User action completed" });
}
