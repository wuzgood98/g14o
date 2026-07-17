function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function errorMeta(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      err: error,
      error: error.message,
    };
  }
  return {
    error: String(error),
  };
}

/**
 * Normalizes structured and legacy rest-arg call shapes into message + meta.
 */
export function normalizeLogArgs(args: unknown[]): {
  message: string;
  meta: Record<string, unknown>;
} {
  if (args.length === 0) {
    return { message: "", meta: {} };
  }

  const [first, second] = args;

  if (args.length === 1) {
    if (typeof first === "string") {
      return { message: first, meta: {} };
    }
    if (first instanceof Error) {
      return { message: first.message, meta: errorMeta(first) };
    }
    return { message: String(first), meta: {} };
  }

  if (first instanceof Error && typeof second === "string") {
    return { message: second, meta: errorMeta(first) };
  }

  if (typeof first === "string" && isPlainObject(second)) {
    return { message: first, meta: second };
  }

  if (typeof first === "string") {
    return {
      message: first,
      meta: { details: args.slice(1) },
    };
  }

  return {
    message: String(first),
    meta: { details: args.slice(1) },
  };
}
