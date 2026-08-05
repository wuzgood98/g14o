/** biome-ignore-all lint/complexity/noVoid: we need to test the types */
import { Event } from "@g14o/events";
import { memoryStream } from "@g14o/events/memory";

// biome-ignore lint/style/useConsistentTypeDefinitions: we need to test the types
type Events = {
  "demo.notification": { body: string; title: string };
  "demo.ping": { message: string };
};

const bus = new Event<Events>({ stream: memoryStream() });

void bus.subscribe({
  events: ["demo.ping", "demo.notification"],
  onData(ctx) {
    if (ctx.event === "demo.ping") {
      const _message: string = ctx.payload.message;
    }
    if (ctx.event === "demo.notification") {
      const _title: string = ctx.payload.title;
    }
  },
});

void bus.subscribe({
  channels: ["room-1"],
  events: ["demo.ping"] as const,
  onData(ctx) {
    const _channel: string | undefined = ctx.channel;
    const _message: string = ctx.payload.message;
  },
});

void bus.subscribe("demo.*", (ctx) => {
  if (ctx.event === "demo.ping") {
    const _message: string = ctx.payload.message;
  }
});

void bus.subscribe(
  "demo.ping",
  (ctx) => {
    const _message: string = ctx.payload.message;
  },
  {
    // @ts-expect-error — single-event bus.subscribe does not accept channels
    channels: ["room-1"],
  }
);

void bus.channel("room-1").subscribe({
  events: ["demo.ping"] as const,
  onData(ctx) {
    const _event: "demo.ping" = ctx.event;
    const _channel: string = ctx.channel;
    const _message: string = ctx.payload.message;
  },
});

void bus.channel("room-1").subscribe({
  // @ts-expect-error — channel-scoped subscribe does not accept channels
  channels: ["room-1"],
  events: ["demo.ping"] as const,
  onData(ctx) {
    const _message: string = ctx.payload.message;
  },
});
