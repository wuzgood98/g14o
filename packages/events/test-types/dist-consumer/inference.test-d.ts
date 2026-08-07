import type { InferEvents } from "@g14o/events";
import { Event } from "@g14o/events";
import { memoryStream } from "@g14o/events/memory";
import { z } from "zod";

const schema = {
  notification: {
    alert: z.object({
      createdAt: z.string(),
      href: z.string(),
      id: z.string(),
      kind: z.enum(["order", "review"]),
      message: z.string(),
      title: z.string(),
    }),
  },
} as const;

export const event = new Event({ schema, stream: memoryStream() });
export type Events = InferEvents<typeof event>;

type EmitEvent = Parameters<typeof event.emit>[0];

type HasExactEmitLiteral = EmitEvent extends "notification.alert"
  ? "notification.alert" extends EmitEvent
    ? true
    : false
  : false;

const _emitLiteral: HasExactEmitLiteral = true;

type AlertPayload = Events["notification.alert"];

const _alertPayload: AlertPayload = {
  createdAt: "2026-01-01T00:00:00.000Z",
  href: "/orders/1",
  id: "alert-1",
  kind: "order",
  message: "Order shipped",
  title: "Update",
};

type AlertKey = "notification.alert" extends keyof Events ? true : false;

const _alertKey: AlertKey = true;
