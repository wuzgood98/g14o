function serializeError(
  error: Error,
  seen: WeakSet<object>
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
  if (error.cause !== undefined) {
    result.cause = sanitize(error.cause, seen);
  }
  return result;
}

function sanitize(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  if (value instanceof Error) {
    seen.add(value);
    const result = serializeError(value, seen);
    seen.delete(value);
    return result;
  }

  if (
    "toJSON" in value &&
    typeof (value as { toJSON: unknown }).toJSON === "function"
  ) {
    return sanitize((value as { toJSON: () => unknown }).toJSON(), seen);
  }

  if (Array.isArray(value)) {
    seen.add(value);
    const result = value.map((item) => sanitize(item, seen));
    seen.delete(value);
    return result;
  }

  seen.add(value);
  const result: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    result[key] = sanitize(nested, seen);
  }
  seen.delete(value);
  return result;
}

/**
 * JSON.stringify that does not throw on circular references or bigint values.
 * Errors are shaped as `{ name, message, stack, cause? }`.
 */
export function safeJsonStringify(
  value: unknown,
  space?: string | number
): string {
  return (
    JSON.stringify(sanitize(value, new WeakSet()), undefined, space) ?? "null"
  );
}
