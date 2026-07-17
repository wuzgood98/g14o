const REDACTED = "[REDACTED]";
const CIRCULAR = "[Circular]";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function normalizeRedactKeys(keys: readonly string[]): Set<string> {
  return new Set(keys.map((key) => key.toLowerCase()));
}

function shouldRedactKey(key: string, redactKeys: Set<string>): boolean {
  return redactKeys.has(key.toLowerCase());
}

function cloneAndRedact(
  value: unknown,
  redactKeys: Set<string>,
  seen: WeakSet<object>
): unknown {
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return CIRCULAR;
    }
    seen.add(value);
    const result = value.map((item) => cloneAndRedact(item, redactKeys, seen));
    seen.delete(value);
    return result;
  }

  if (isPlainObject(value)) {
    if (seen.has(value)) {
      return CIRCULAR;
    }
    seen.add(value);
    const result: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      if (shouldRedactKey(key, redactKeys)) {
        result[key] = REDACTED;
      } else {
        result[key] = cloneAndRedact(nestedValue, redactKeys, seen);
      }
    }
    seen.delete(value);
    return result;
  }

  return value;
}

/**
 * Deep-clones `meta` and replaces values whose keys match `keys` (case-insensitive).
 * Does not mutate the original object.
 */
export function redactMeta(
  meta: Record<string, unknown> | undefined,
  keys: readonly string[]
): Record<string, unknown> {
  if (!meta || keys.length === 0) {
    return meta ? { ...meta } : {};
  }

  const redactKeys = normalizeRedactKeys(keys);
  const result = cloneAndRedact(meta, redactKeys, new WeakSet());
  return isPlainObject(result) ? result : {};
}
