import type {
  NestedSchemaShape,
  SchemaShape,
  StandardSchemaV1,
} from "./standard-schema";

function isStandardSchema(value: unknown): value is StandardSchemaV1 {
  return typeof value === "object" && value !== null && "~standard" in value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" && value !== null && !isStandardSchema(value)
  );
}

/**
 * Flattens a nested schema map into dotted event keys.
 * Flat keys like `"demo.ping"` pass through unchanged when they hold a validator leaf.
 */
export function flattenSchema(
  input: NestedSchemaShape,
  prefix = ""
): SchemaShape {
  const out: SchemaShape = {};

  for (const [key, value] of Object.entries(input)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (isStandardSchema(value)) {
      out[path] = value;
      continue;
    }

    if (isPlainObject(value)) {
      Object.assign(out, flattenSchema(value as NestedSchemaShape, path));
      continue;
    }

    throw new Error(
      `Invalid schema entry at "${path}". Expected a Standard Schema validator or nested group.`
    );
  }

  return out;
}
