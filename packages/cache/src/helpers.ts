/**
 * Type guard: `true` when `value` is a non-null, non-array object.
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    value !== undefined
  );
}

/**
 * Type guard: `true` when `value` is an array.
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}
