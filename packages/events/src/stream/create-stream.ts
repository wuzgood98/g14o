import type { EventStream } from "./interface";

/**
 * Identity helper for implementing {@link EventStream} with full type inference.
 */
export function defineStream(stream: EventStream): EventStream {
  return stream;
}
