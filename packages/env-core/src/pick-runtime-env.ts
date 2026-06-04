import type { RuntimeEnvInput } from "./types.js";

export function pickRuntimeValues(
  keys: readonly string[],
  runtime: RuntimeEnvInput,
  emptyStringAsUndefined: boolean
): Record<string, unknown> {
  const values: Record<string, unknown> = {};

  for (const key of keys) {
    let value: unknown = runtime[key];
    if (emptyStringAsUndefined && value === "") {
      value = undefined;
    }
    values[key] = value;
  }

  return values;
}

export function assertStrictRuntimeKeys(
  expectedKeys: readonly string[],
  runtime: RuntimeEnvInput
): void {
  const missing: string[] = [];

  for (const key of expectedKeys) {
    if (!(key in runtime)) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `runtimeEnvStrict is missing required keys: ${missing.join(", ")}`
    );
  }
}
