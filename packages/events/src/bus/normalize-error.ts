/**
 * Ensures bus-routed errors are always {@link Error} instances.
 */
export function normalizeEventError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === "string") {
    return new Error(error);
  }

  return new Error("Unknown event bus error");
}
