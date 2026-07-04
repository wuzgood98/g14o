import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { demoAuth } from "./middleware/demo-auth";
import { chatHandler } from "./routes/chat";
import { statusHandler, statusMiddleware } from "./routes/status";
import { userActionHandler, userActionMiddleware } from "./routes/user-action";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>().basePath("/api");
const port = Number(process.env.PORT ?? 3002);

app.get("/", (c) =>
  c.json({
    routes: [
      "GET /api/status",
      "POST /api/chat",
      "POST /api/user-action (demo auth via x-user-id header)",
    ],
  })
);

app.get("/status", statusMiddleware, statusHandler);
app.post("/chat", chatHandler);
app.post("/user-action", demoAuth, userActionMiddleware, userActionHandler);

serve({ fetch: app.fetch, port }, () => {
  console.log(`hono-demo listening on http://localhost:${port}`);
});
