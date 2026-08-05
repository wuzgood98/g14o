import { event } from "@/lib/events";

export async function POST(): Promise<Response> {
  const channel = event.channel("room-1");
  await channel.emit("demo.ping", {
    message: "Hello from the server!",
  });

  return Response.json({
    ok: true,
    channel: "room-1",
    event: "demo.ping",
  });
}
