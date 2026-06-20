const UNSAFE_METADATA_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Safely parse JSON metadata stored in the database or received from webhooks.
 */
export const parseSafeMetadata = (
  metadata: string | Record<string, unknown> | null | undefined
): Record<string, unknown> | undefined => {
  if (!metadata) {
    return;
  }

  let parsed: Record<string, unknown>;

  if (typeof metadata === "string") {
    try {
      const value = JSON.parse(metadata) as unknown;
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return;
      }
      parsed = value as Record<string, unknown>;
    } catch {
      return;
    }
  } else {
    parsed = metadata;
  }

  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (UNSAFE_METADATA_KEYS.has(key)) {
      continue;
    }
    safe[key] = value;
  }

  return safe;
};
