import { createEvent } from "@g14o/events/client";

export interface Events {
  "demo.notification": { body: string; title: string };
  "demo.ping": { message: string };
}

export const { useChannel, useEvent, useEventStatus } = createEvent<Events>();
