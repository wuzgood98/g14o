import { handler } from "@g14o/events/handler";
import { createFileRoute } from "@tanstack/react-router";
import { event } from "@/lib/events";

const { GET } = handler({ event });

export const Route = createFileRoute("/api/events")({
  server: {
    handlers: {
      GET: async ({ request }) => GET(request),
    },
  },
});
