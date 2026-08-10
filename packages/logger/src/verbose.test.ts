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
    expect(resolveVerboseLogger({})).toBe(noopVerboseLogger);
  });

  it("returns console when verbose is true", () => {
    expect(resolveVerboseLogger(true)).toBe(consoleVerboseLogger);
    expect(resolveVerboseLogger({ verbose: true })).toBe(consoleVerboseLogger);
  });

  it("returns injected logger when provided", () => {
    const injected = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    expect(resolveVerboseLogger({ logger: injected })).toBe(injected);
  });

  it("prefers injected logger over verbose", () => {
    const injected = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    expect(resolveVerboseLogger({ verbose: true, logger: injected })).toBe(
      injected
    );
  });
});
