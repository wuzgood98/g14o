import { handler } from "@g14o/events/handler";
import { event } from "@/lib/events";

const ALLOWED_CHANNELS = new Set(["demo", "room-1"]);

export const { GET } = handler({
  event,
  middleware: ({ channels }) => {
    if (!channels.every((channel) => ALLOWED_CHANNELS.has(channel))) {
      return Response.json(
        { ok: false, error: "Channel join rejected." },
        { status: 403 }
      );
    }
  },
});
