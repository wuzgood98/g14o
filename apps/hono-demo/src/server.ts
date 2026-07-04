import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { withRateLimit } from "./lib/ratelimit";
import { statusHandler, statusMiddleware } from "./routes/status";
import { userActionHandler, userActionMiddleware } from "./routes/user-action";

const app = new Hono().basePath("/api");
const port = Number(process.env.PORT ?? 3002);

app.get("/", (c) =>
  c.json({
    routes: [
      "GET /api/status",
      "POST /api/chat",
      "POST /api/user-action (requires x-user-id header)",
    ],
  })
);

app.get("/status", statusMiddleware, statusHandler);
app.post(
  "/chat",
  withRateLimit(
    (c) => {
      const user = c.get("user");
      const token = c.env.TOKEN;
      return c.json({
        ok: true,
        message: "Chat response",
        user,
        token,
      });
    },
    { tier: "moderate", prefix: "@ratelimit:hono-demo-chat" }
  )
);
app.post("/user-action", userActionMiddleware, userActionHandler);

serve({ fetch: app.fetch, port }, () => {
  console.log(`hono-demo listening on http://localhost:${port}`);
});
