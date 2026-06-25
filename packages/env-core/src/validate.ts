import { formatSchemaIssue, InvalidEnvironmentVariablesError } from "./errors";
import type { StandardSchemaV1 } from "./standard-schema";
import type { SchemaShape } from "./types";

/** Called when schema validation fails. May throw a custom error; otherwise the default is thrown. */
export type OnValidationErrorHandler = (
  issues: readonly StandardSchemaV1.Issue[]
) => never;

interface PendingValidation {
  key: string;
  promise: Promise<StandardSchemaV1.Result<unknown>>;
}

function augmentIssueWithKey(
  key: string,
  issue: StandardSchemaV1.Issue
): StandardSchemaV1.Issue {
  return {
    message: issue.message,
    path: [{ key }, ...(issue.path ?? [])],
  };
}

export function validateShape(
  shape: SchemaShape,
  values: Record<string, unknown>,
  scope: string,
  onValidationError?: OnValidationErrorHandler
): Record<string, unknown> {
  const keys = Object.keys(shape);
  if (keys.length === 0) {
    return {};
  }

  const output: Record<string, unknown> = {};
  const formattedIssues: string[] = [];
  const rawIssues: StandardSchemaV1.Issue[] = [];
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

    applyValidationResult(key, result, output, formattedIssues, rawIssues);
  }

  if (pending.length > 0) {
    throw new Error(
      `Async Standard Schema validation is not supported in createEnv (${scope}). Use synchronous validators.`
    );
  }

  const onValidationErrorHandler =
    onValidationError ??
    ((issues) => {
      console.error("❌ Invalid environment variables:", issues);
      throw new InvalidEnvironmentVariablesError(formattedIssues, scope);
    });

  if (rawIssues.length > 0) {
    return onValidationErrorHandler(rawIssues);
  }

  return output;
}

function applyValidationResult(
  key: string,
  result: StandardSchemaV1.Result<unknown>,
  output: Record<string, unknown>,
  formattedIssues: string[],
  rawIssues: StandardSchemaV1.Issue[]
): void {
  if (result.issues) {
    for (const issue of result.issues) {
      const augmented = augmentIssueWithKey(key, issue);
      rawIssues.push(augmented);
      formattedIssues.push(`${key}: ${formatSchemaIssue(issue)}`);
    }
    return;
  }

  output[key] = result.value;
}
