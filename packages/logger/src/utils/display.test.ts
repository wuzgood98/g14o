import { afterEach, describe, expect, it, vi } from "vitest";
import {
  forceTextPresentation,
  isUnicodeSupported,
  MIN_ALIGN_COLUMNS,
  padToRight,
  selectGlyph,
  stringWidth,
  stripAnsi,
} from "./display";

describe("stripAnsi", () => {
  it("removes ANSI color sequences", () => {
    expect(stripAnsi("\x1b[38;5;37mi\x1b[39m hello")).toBe("i hello");
  });
});

describe("stringWidth", () => {
  it("counts ASCII characters as width 1", () => {
    expect(stringWidth("hello")).toBe(5);
  });

  it("ignores ANSI sequences when measuring width", () => {
    expect(stringWidth("\x1b[2m00:00:00\x1b[22m")).toBe(8);
  });

  it("counts common CJK characters as width 2", () => {
    expect(stringWidth("漢字")).toBe(4);
  });

  it("counts common emoji as width 2", () => {
    expect(stringWidth("😀")).toBe(2);
  });

  it("ignores combining marks", () => {
    // e + combining acute
    expect(stringWidth("e\u0301")).toBe(1);
  });

  it("ignores variation selectors when measuring width", () => {
    expect(stringWidth("✔\uFE0E")).toBe(stringWidth("✔"));
    expect(stringWidth("⚠\uFE0F")).toBe(stringWidth("⚠"));
  });
});

describe("forceTextPresentation", () => {
  it("appends the text presentation selector", () => {
    expect(forceTextPresentation("✔")).toBe("✔\uFE0E");
    expect(forceTextPresentation("⚠")).toBe("⚠\uFE0E");
  });

  it("replaces an existing emoji presentation selector", () => {
    expect(forceTextPresentation("✔\uFE0F")).toBe("✔\uFE0E");
  });

  it("does not stack duplicate text presentation selectors", () => {
    expect(forceTextPresentation("✔\uFE0E")).toBe("✔\uFE0E");
  });
});

describe("padToRight", () => {
  it("right-aligns when width is at least the align threshold", () => {
    const line = padToRight("hello", "00:00:00", MIN_ALIGN_COLUMNS);
    expect(stripAnsi(line)).toBe(
      `hello${" ".repeat(MIN_ALIGN_COLUMNS - 5 - 8)}00:00:00`
    );
    expect(stringWidth(line)).toBe(MIN_ALIGN_COLUMNS);
  });

  it("uses compact spacing when width is below the align threshold", () => {
    const line = padToRight("hello", "00:00:00", 40);
    expect(line).toBe("hello 00:00:00");
  });

  it("uses compact spacing when content overflows even at wide width", () => {
    const content = "x".repeat(90);
    const line = padToRight(content, "00:00:00", MIN_ALIGN_COLUMNS);
    expect(line).toBe(`${content} 00:00:00`);
  });

  it("accounts for wide Unicode in content when aligning", () => {
    const line = padToRight("漢", "00:00:00", MIN_ALIGN_COLUMNS);
    expect(stringWidth(line)).toBe(MIN_ALIGN_COLUMNS);
    expect(stripAnsi(line).endsWith("00:00:00")).toBe(true);
  });

  it("returns content unchanged when suffix is empty", () => {
    expect(padToRight("hello", "", 100)).toBe("hello");
  });
});

const ORIGINAL_PLATFORM = process.platform;

function restorePlatform(): void {
  Object.defineProperty(process, "platform", {
    configurable: true,
    value: ORIGINAL_PLATFORM,
  });
}

describe("isUnicodeSupported", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    restorePlatform();
  });

  it("returns true in browser-like environments", () => {
    vi.stubGlobal("process", undefined);
    expect(isUnicodeSupported()).toBe(true);
  });

  it("returns false on Linux console TERM", () => {
    vi.stubEnv("TERM", "linux");
    Object.defineProperty(process, "platform", {
      configurable: true,
      value: "linux",
    });
    expect(isUnicodeSupported()).toBe(false);
  });

  it("returns true on Windows Terminal", () => {
    Object.defineProperty(process, "platform", {
      configurable: true,
      value: "win32",
    });
    vi.stubEnv("WT_SESSION", "1");
    expect(isUnicodeSupported()).toBe(true);
  });
});

describe("selectGlyph", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    restorePlatform();
  });

  it("returns the Unicode glyph when supported", () => {
    vi.stubGlobal("process", undefined);
    expect(selectGlyph("◐", "o")).toBe("◐");
  });

  it("returns the fallback glyph when Unicode is unsupported", () => {
    vi.stubEnv("TERM", "linux");
    Object.defineProperty(process, "platform", {
      configurable: true,
      value: "linux",
    });
    expect(selectGlyph("◐", "o")).toBe("o");
  });
});
