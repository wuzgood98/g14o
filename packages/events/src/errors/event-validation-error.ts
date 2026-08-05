import type { StandardSchemaV1 } from "../schema/standard-schema";

/**
 * Thrown or routed when payload validation fails before middleware and listeners run.
 *
 * Routed to {@link EventBus.onValidationError} handlers. On `emit()`, the promise
 * always rejects after handlers run. On `dispatch()`, handlers are notified only
 * (fire-and-forget; no caller to reject).
 */
export class EventValidationError extends Error {
  readonly event: string;
  readonly issues: readonly StandardSchemaV1.Issue[];
  readonly payload: unknown;

  constructor(
    event: string,
    payload: unknown,
    issues: readonly StandardSchemaV1.Issue[]
  ) {
    super(`Validation failed for event "${event}"`);
    this.name = "EventValidationError";
    this.event = event;
    this.payload = payload;
    this.issues = issues;
  }
}

/**
 * Wraps a listener exception while preserving the original cause stack.
 * Routed to {@link EventBus.onError} when a listener throws (never to
 * {@link EventBus.onValidationError}).
 */
export class EventListenerError extends Error {
  readonly cause: unknown;
  readonly event: string;

  constructor(event: string, cause: unknown) {
    const message =
      cause instanceof Error ? cause.message : "Listener execution failed";
    super(`Listener failed for event "${event}": ${message}`, {
      cause: cause instanceof Error ? cause : undefined,
    });
    this.name = "EventListenerError";
    this.event = event;
    this.cause = cause;
  }
}
