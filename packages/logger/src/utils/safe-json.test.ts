import { describe, expect, it } from "vitest";
import { safeJsonStringify } from "./safe-json";

describe("safeJsonStringify", () => {
  it("stringifies plain objects", () => {
    expect(safeJsonStringify({ a: 1, b: "two" })).toBe('{"a":1,"b":"two"}');
  });

  it("replaces circular references", () => {
    const value: Record<string, unknown> = { a: 1 };
    value.self = value;

    expect(safeJsonStringify(value)).toBe('{"a":1,"self":"[Circular]"}');
  });

  it("stringifies bigint values", () => {
    expect(safeJsonStringify({ amount: 9007199254740993n })).toBe(
      '{"amount":"9007199254740993"}'
    );
  });

  it("serializes Error values with name, message, and stack", () => {
    const error = new Error("boom");
    const parsed = JSON.parse(safeJsonStringify({ error })) as {
      error: { message: string; name: string; stack: string };
    };

    expect(parsed.error.name).toBe("Error");
    expect(parsed.error.message).toBe("boom");
    expect(typeof parsed.error.stack).toBe("string");
  });

  it("replaces circular Error causes", () => {
    const error = new Error("boom");
    error.cause = error;

    const parsed = JSON.parse(safeJsonStringify({ error })) as {
      error: { cause: string; message: string };
    };

    expect(parsed.error.message).toBe("boom");
    expect(parsed.error.cause).toBe("[Circular]");
  });

  it("supports indentation", () => {
    expect(safeJsonStringify({ a: 1 }, 2)).toBe('{\n  "a": 1\n}');
  });
});
