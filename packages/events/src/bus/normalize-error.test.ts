import { describe, expect, it } from "vitest";
import { normalizeEventError } from "./normalize-error";

describe("normalizeEventError", () => {
  it("returns Error instances unchanged", () => {
    const error = new Error("boom");
    expect(normalizeEventError(error)).toBe(error);
  });

  it("wraps strings in Error", () => {
    const error = normalizeEventError("validation failed");
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("validation failed");
  });

  it("wraps unknown values in a generic Error", () => {
    const error = normalizeEventError({ code: 1 });
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("Unknown event bus error");
  });
});
