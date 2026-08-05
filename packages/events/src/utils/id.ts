/**
 * Generates a unique identifier for an event context.
 * @internal
 */
export function createEventId(): string {
  return crypto.randomUUID();
}

/**
 * Returns the current timestamp in milliseconds for event metadata.
 * @internal
 */
export function nowTimestamp(): number {
  return Date.now();
}
