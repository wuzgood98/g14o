import { formatSchemaIssue, InvalidEnvironmentVariablesError } from "./errors";
import type { StandardSchemaV1 } from "./standard-schema";
import type { SchemaShape } from "./types";

interface PendingValidation {
  key: string;
  promise: Promise<StandardSchemaV1.Result<unknown>>;
}

export function validateShape(
  shape: SchemaShape,
  values: Record<string, unknown>,
  scope: string
): Record<string, unknown> {
  const keys = Object.keys(shape);
  if (keys.length === 0) {
    return {};
  }

  const output: Record<string, unknown> = {};
  const issues: string[] = [];
  const pending: PendingValidation[] = [];

  for (const key of keys) {
    const schema = shape[key];
    if (!schema) {
      continue;
    }

    const result = schema["~standard"].validate(values[key]);
    if (result instanceof Promise) {
      pending.push({ key, promise: result });
      continue;
    }

    applyValidationResult(key, result, output, issues);
  }

  if (pending.length > 0) {
    throw new Error(
      `Async Standard Schema validation is not supported in createEnv (${scope}). Use synchronous validators.`
    );
  }

  if (issues.length > 0) {
    throw new InvalidEnvironmentVariablesError(issues, scope);
  }

  return output;
}

function applyValidationResult(
  key: string,
  result: StandardSchemaV1.Result<unknown>,
  output: Record<string, unknown>,
  issues: string[]
): void {
  if (result.issues) {
    for (const issue of result.issues) {
      issues.push(`${key}: ${formatSchemaIssue(issue)}`);
    }
    return;
  }

  output[key] = result.value;
}
