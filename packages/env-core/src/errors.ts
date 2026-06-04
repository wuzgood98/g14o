import type { StandardSchemaV1 } from "./standard-schema.js";

export class InvalidEnvironmentVariablesError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[], scope: string) {
    super(
      `Invalid environment variables (${scope}):\n${issues.map((line) => `  - ${line}`).join("\n")}`
    );
    this.name = "InvalidEnvironmentVariablesError";
    this.issues = issues;
  }
}

export function formatSchemaIssue(issue: StandardSchemaV1.Issue): string {
  const path =
    issue.path && issue.path.length > 0
      ? `${issue.path.map((segment) => formatPathSegment(segment)).join(".")}: `
      : "";
  return `${path}${issue.message}`;
}

function formatPathSegment(
  segment: PropertyKey | StandardSchemaV1.PathSegment
): string {
  if (typeof segment === "object" && segment !== null && "key" in segment) {
    return String(segment.key);
  }
  return String(segment);
}

export function createServerAccessError(variable: string): Error {
  return new Error(
    `Attempted to access server environment variable(s) on the client: ${variable}`
  );
}
