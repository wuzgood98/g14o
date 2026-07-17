export interface ParsedFrame {
  /** Call-site descriptor; empty for bare frames. */
  descriptor: string;
  /** File path with line:col, without surrounding parens. */
  location: string;
  /** Whether the location was wrapped in parentheses. */
  parenthesized: boolean;
}

export interface NormalizedStackLine {
  /** Parsed V8 frame when the line begins with `at `; otherwise null. */
  frame: ParsedFrame | null;
  /** Raw trimmed stack detail line. */
  line: string;
}

const PARENTHESIZED_FRAME_PATTERN = /^at (.*?)\s*\(([^)]*)\)$/;
const ERROR_HEADER_PATTERN = /^(?:[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)?:\s/;

/**
 * Parses a trimmed stack frame line beginning with `at ` into descriptor and location parts.
 */
export function parseStackFrame(line: string): ParsedFrame {
  const parenthesizedMatch = PARENTHESIZED_FRAME_PATTERN.exec(line);
  if (parenthesizedMatch) {
    return {
      descriptor: parenthesizedMatch[1] ?? "",
      location: parenthesizedMatch[2] ?? "",
      parenthesized: true,
    };
  }

  return {
    descriptor: "",
    location: line.slice(3),
    parenthesized: false,
  };
}

function isDuplicateErrorHeader(line: string, message: string): boolean {
  if (!line || line.startsWith("at ")) {
    return false;
  }

  if (line === message || line === `Error: ${message}`) {
    return true;
  }

  // Drop the engine's first "Name: message" header while keeping later detail lines.
  if (ERROR_HEADER_PATTERN.test(line) && line.endsWith(message)) {
    return true;
  }

  return false;
}

/**
 * Normalizes an Error stack into detail lines, removing only the duplicate
 * error header while preserving frames and other useful non-frame details.
 */
export function normalizeStack(
  stack: string | undefined,
  message = ""
): NormalizedStackLine[] {
  if (!stack) {
    return [];
  }

  const lines = stack
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const details: NormalizedStackLine[] = [];
  let skippedHeader = false;

  for (const line of lines) {
    if (!skippedHeader && isDuplicateErrorHeader(line, message)) {
      skippedHeader = true;
      continue;
    }

    if (line.startsWith("at ")) {
      details.push({ line, frame: parseStackFrame(line) });
      continue;
    }

    details.push({ line, frame: null });
  }

  return details;
}
