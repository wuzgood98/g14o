import { handler } from "@g14o/events/handler";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { event } from "./events.js";

const { GET } = handler({ event });
const app = new Hono();

app.get("/api/events", (c) => GET(c.req.raw));

app.post("/api/notify", async (c) => {
  await event.channel("room-1").emit("demo.ping", {
    message: "Hello from the server!",
  });

  return c.json({
    ok: true,
    channel: "room-1",
    event: "demo.ping",
  });
});

const port = 3010;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Events Hono API listening on http://localhost:${info.port}`);
});
