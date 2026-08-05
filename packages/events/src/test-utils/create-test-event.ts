import type { EventBusOptions } from "../bus/create-event-bus";
import { Event } from "../bus/event";
import type { NestedSchemaShape } from "../schema/standard-schema";
import { memoryStream } from "../stream/memory";

/** Shared in-process stream for unit tests. */
export const testStream = memoryStream();

/** Creates an {@link Event} with a configured stream for tests. */
export function createTestEvent<
  TEvents extends Record<string, unknown> = Record<string, unknown>,
>(config?: EventBusOptions & { schema?: NestedSchemaShape }) {
  return new Event<TEvents>({ stream: testStream, ...config });
}
