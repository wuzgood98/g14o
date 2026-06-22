import type { RuntimeEnvInput } from "./types";

export function pickRuntimeValues(
  keys: readonly string[],
  runtime: RuntimeEnvInput,
  emptyStringAsUndefined: boolean
): Record<string, unknown> {
  const values: Record<string, unknown> = {};

  for (const key of keys) {
    let value: unknown = Object.hasOwn(runtime, key) ? runtime[key] : undefined;
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
    if (!Object.hasOwn(runtime, key)) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `runtimeEnvStrict is missing required keys: ${missing.join(", ")}`
    );
  }
}
