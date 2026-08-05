import { isControlEvent } from "../constants/control-events";
import { EventValidationError } from "../errors/event-validation-error";
import type { SchemaShape } from "./standard-schema";

/**
 * Validates emit payloads against a schema map before dispatch.
 * @internal
 */
export interface EventValidator {
  validate(event: string, payload: unknown): unknown;
}

/**
 * Creates a validator that checks payloads with Standard Schema validators.
 * @internal
 */
export function createEventValidator(schema: SchemaShape): EventValidator {
  return {
    validate(event: string, payload: unknown): unknown {
      if (isControlEvent(event)) {
        return payload;
      }

      const eventSchema = schema[event];
      if (!eventSchema) {
        throw new EventValidationError(event, payload, [
          { message: `No schema registered for event "${event}"` },
        ]);
      }

      const result = eventSchema["~standard"].validate(payload);
      if (result instanceof Promise) {
        throw new Error(
          `Async Standard Schema validation is not supported for event "${event}". Use synchronous validators.`
        );
      }

      if (result.issues) {
        throw new EventValidationError(event, payload, result.issues);
      }

      return result.value;
    },
  };
}

/**
 * Returns null when the bus runs in type-only mode without validation.
 * @internal
 */
export function createNoopValidator(): null {
  return null;
}
