import { handler } from "@g14o/events/handler";
import { getRequestListener } from "@hono/node-server";
import express from "express";
import { event } from "./events.js";

const { GET } = handler({ event });
const app = express();

app.use("/api/events", getRequestListener(GET));

app.use(express.json());

app.post("/api/notify", async (_request, response) => {
  await event.channel("room-1").emit("demo.ping", {
    message: "Hello from the server!",
  });

  response.json({
    ok: true,
    channel: "room-1",
    event: "demo.ping",
  });
});

const port = 3020;

app.listen(port, () => {
  console.log(`Events Express API listening on http://localhost:${port}`);
});
