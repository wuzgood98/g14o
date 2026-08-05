import type {
  EventsFromSchemaInput,
  NestedSchemaShape,
} from "../schema/standard-schema";
import type { EventBus, EventBusOptions } from "./create-event-bus";
import { createEventBus } from "./create-event-bus";

function EventConstructor(
  config?: EventBusOptions & { schema?: NestedSchemaShape }
): EventBus<Record<string, unknown>> {
  return createEventBus(config);
}

export type Event<
  TEvents extends Record<string, unknown> = Record<string, unknown>,
> = EventBus<TEvents>;

/** Typed event instance. See docs for schema + stream setup. */
export const Event = EventConstructor as unknown as {
  new <const TSchema extends NestedSchemaShape>(
    config: EventBusOptions & { schema: TSchema }
  ): EventBus<EventsFromSchemaInput<TSchema>>;
  new <TEvents extends Record<string, unknown> = Record<string, unknown>>(
    config?: EventBusOptions
  ): EventBus<TEvents>;
};

/** Infers the event map from an {@link Event} instance. */
export type InferEvents<T> = T extends EventBus<infer E> ? E : never;
