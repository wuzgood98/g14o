import { withRateLimit } from "../lib/ratelimit";

export const chatHandler = withRateLimit(
  (c) => c.json({ ok: true, message: "Chat response" }),
  { tier: "moderate", prefix: "@ratelimit:hono-demo-chat" }
);
