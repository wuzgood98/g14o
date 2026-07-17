import { describe, expect, it } from "vitest";
import { normalizeStack, parseStackFrame } from "./stack";

describe("parseStackFrame", () => {
  it("parses parenthesized frames with a call-site descriptor", () => {
    expect(
      parseStackFrame("at runWithHooks (C:\\Users\\app\\runtime.js:1554:9)")
    ).toEqual({
      descriptor: "runWithHooks",
      location: "C:\\Users\\app\\runtime.js:1554:9",
      parenthesized: true,
    });
  });

  it("parses parenthesized frames with alias descriptors", () => {
    expect(
      parseStackFrame(
        "at Context.esmImport [as i] (C:\\Users\\app\\runtime.js:281:20)"
      )
    ).toEqual({
      descriptor: "Context.esmImport [as i]",
      location: "C:\\Users\\app\\runtime.js:281:20",
      parenthesized: true,
    });
  });

  it("parses bare frames without a descriptor", () => {
    expect(parseStackFrame("at C:\\Users\\app\\runtime.js:1291:27")).toEqual({
      descriptor: "",
      location: "C:\\Users\\app\\runtime.js:1291:27",
      parenthesized: false,
    });
  });
});

describe("normalizeStack", () => {
  it("returns an empty array when stack is missing", () => {
    expect(normalizeStack(undefined, "boom")).toEqual([]);
  });

  it("removes the duplicate error header and keeps frames", () => {
    const stack =
      "Error: boom\n    at runWithHooks (runtime.js:1554:9)\n    at runtime.js:1291:27";
    expect(normalizeStack(stack, "boom")).toEqual([
      {
        line: "at runWithHooks (runtime.js:1554:9)",
        frame: {
          descriptor: "runWithHooks",
          location: "runtime.js:1554:9",
          parenthesized: true,
        },
      },
      {
        line: "at runtime.js:1291:27",
        frame: {
          descriptor: "",
          location: "runtime.js:1291:27",
          parenthesized: false,
        },
      },
    ]);
  });

  it("preserves non-frame detail lines after the header", () => {
    const stack =
      "Error: boom\nCaused by: timeout\n    at connect (db.ts:42:11)";
    expect(normalizeStack(stack, "boom")).toEqual([
      {
        line: "Caused by: timeout",
        frame: null,
      },
      {
        line: "at connect (db.ts:42:11)",
        frame: {
          descriptor: "connect",
          location: "db.ts:42:11",
          parenthesized: true,
        },
      },
    ]);
  });

  it("does not drop a later line that happens to equal the message", () => {
    const stack = "Error: boom\n    at run (a.ts:1:1)\nboom";
    expect(normalizeStack(stack, "boom")).toEqual([
      {
        line: "at run (a.ts:1:1)",
        frame: {
          descriptor: "run",
          location: "a.ts:1:1",
          parenthesized: true,
        },
      },
      {
        line: "boom",
        frame: null,
      },
    ]);
  });
});
