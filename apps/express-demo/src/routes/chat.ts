import { withRateLimit } from "../lib/ratelimit";

export const chatHandler = withRateLimit(
  (_req, res) => {
    res.json({ ok: true, message: "Chat response" });
  },
  { tier: "moderate", prefix: "@ratelimit:express-demo-chat" }
);
