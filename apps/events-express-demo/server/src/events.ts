import type { InferEvents } from "@g14o/events";
import { Event } from "@g14o/events";
import { memoryStream } from "@g14o/events/memory";
import { demoEventSchema } from "./schema.js";

export const event = new Event({
  schema: demoEventSchema,
  stream: memoryStream(),
});

export type Events = InferEvents<typeof event>;
