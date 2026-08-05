import { createFileRoute } from "@tanstack/react-router";
import { event } from "@/lib/events";

export const Route = createFileRoute("/api/notify")({
  server: {
    handlers: {
      POST: async () => {
        await event.channel("room-1").emit("demo.ping", {
          message: "Hello from the server!",
        });

        return Response.json({
          ok: true,
          channel: "room-1",
          event: "demo.ping",
        });
      },
    },
  },
});
