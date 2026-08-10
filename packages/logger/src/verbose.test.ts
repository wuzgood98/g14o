import { describe, expect, it, vi } from "vitest";
import {
  consoleVerboseLogger,
  noopVerboseLogger,
  resolveVerboseLogger,
} from "./verbose";

describe("resolveVerboseLogger", () => {
  it("returns noop by default", () => {
    expect(resolveVerboseLogger()).toBe(noopVerboseLogger);
    expect(resolveVerboseLogger(false)).toBe(noopVerboseLogger);
  });

  it("returns console when verbose is true", () => {
    expect(resolveVerboseLogger(true)).toBe(consoleVerboseLogger);
  });

  it("returns injected logger when verbose is an adapter", () => {
    const injected = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    expect(resolveVerboseLogger(injected)).toBe(injected);
  });
});
