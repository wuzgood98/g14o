import { describe, expect, it } from "vitest";
import { normalizeLogArgs } from "./normalize-args";

describe("normalizeLogArgs", () => {
  it("handles structured message + meta", () => {
    expect(normalizeLogArgs(["ready", { status: 200 }])).toEqual({
      message: "ready",
      meta: { status: 200 },
    });
  });

  it("handles cache-style error + message calls", () => {
    const error = new Error("boom");
    expect(normalizeLogArgs([error, "Cache read error"])).toEqual({
      message: "Cache read error",
      meta: {
        err: error,
        error: "boom",
      },
    });
  });

  it("preserves trailing args for error + message calls", () => {
    const error = new Error("boom");
    expect(normalizeLogArgs([error, "Cache read error", "extra1", 42])).toEqual(
      {
        message: "Cache read error",
        meta: {
          err: error,
          error: "boom",
          details: ["extra1", 42],
        },
      }
    );
  });

  it("preserves trailing args for message + meta calls", () => {
    expect(normalizeLogArgs(["ready", { status: 200 }, "ctx"])).toEqual({
      message: "ready",
      meta: { status: 200, details: ["ctx"] },
    });
  });

  it("handles a single string message", () => {
    expect(normalizeLogArgs(["Cache miss"])).toEqual({
      message: "Cache miss",
      meta: {},
    });
  });
});
