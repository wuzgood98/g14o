import type { StandardSchemaV1 } from "../schema/standard-schema";

/**
 * Builds a Standard Schema validator stub for tests.
 * @internal
 */
export function createMockSchema<TOutput>(
  validate: (value: unknown) => StandardSchemaV1.Result<TOutput>
): StandardSchemaV1<unknown, TOutput> {
  return {
    "~standard": {
      version: 1,
      vendor: "test",
      validate,
    },
  };
}

/**
 * Returns a mock schema that accepts any payload unchanged.
 * @internal
 */
export function passThrough<T>(): StandardSchemaV1<unknown, T> {
  return createMockSchema((value) => ({ value: value as T }));
}

/**
 * Returns a mock schema that always fails validation with a message.
 * @internal
 */
export function alwaysFail(
  message = "invalid"
): StandardSchemaV1<unknown, never> {
  return createMockSchema(() => ({ issues: [{ message }] }));
}
