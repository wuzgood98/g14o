import { createEvent } from "@g14o/events/client";

// biome-ignore lint/style/useConsistentTypeDefinitions: preserve index signature
export type Events = {
  "demo.notification": { body: string; title: string };
  "demo.ping": { message: string };
};

export const { useChannel, useEvent, useEventStatus } = createEvent<Events>();
