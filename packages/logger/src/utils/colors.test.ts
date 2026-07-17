import { afterEach, describe, expect, it, vi } from "vitest";
import { createColors, isColorSupported } from "./colors";

describe("isColorSupported", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns false when process is undefined", () => {
    vi.stubGlobal("process", undefined);
    expect(isColorSupported()).toBe(false);
  });

  it("returns false when NO_COLOR is set", () => {
    vi.stubEnv("NO_COLOR", "");
    vi.stubEnv("FORCE_COLOR", "1");
    expect(isColorSupported()).toBe(false);
  });

  it("returns false when --no-color is present", () => {
    vi.stubGlobal("process", {
      ...process,
      argv: ["node", "app", "--no-color"],
      env: { ...process.env, FORCE_COLOR: "1" },
      stdout: { isTTY: true },
    });
    expect(isColorSupported()).toBe(false);
  });

  it("returns true when FORCE_COLOR is set", () => {
    vi.stubEnv("FORCE_COLOR", "1");
    vi.stubEnv("NO_COLOR", undefined);
    expect(isColorSupported()).toBe(true);
  });

  it("returns true when --color is present", () => {
    vi.stubGlobal("process", {
      ...process,
      argv: ["node", "app", "--color"],
      env: { TERM: "xterm-256color" },
      stdout: { isTTY: false },
      platform: "linux",
    });
    expect(isColorSupported()).toBe(true);
  });

  it("returns true for a compatible TTY terminal", () => {
    vi.stubGlobal("process", {
      ...process,
      argv: ["node", "app"],
      env: { TERM: "xterm-256color" },
      stdout: { isTTY: true },
      platform: "linux",
    });
    expect(isColorSupported()).toBe(true);
  });

  it("returns false for a dumb terminal without FORCE_COLOR", () => {
    vi.stubGlobal("process", {
      ...process,
      argv: ["node", "app"],
      env: { TERM: "dumb" },
      stdout: { isTTY: true },
      platform: "linux",
    });
    expect(isColorSupported()).toBe(false);
  });

  it("returns true on Windows when TERM is not dumb", () => {
    vi.stubGlobal("process", {
      ...process,
      argv: ["node", "app"],
      env: {},
      stdout: { isTTY: false },
      platform: "win32",
    });
    expect(isColorSupported()).toBe(true);
  });

  it("returns true in supported CI environments", () => {
    vi.stubGlobal("process", {
      ...process,
      argv: ["node", "app"],
      env: { CI: "true", GITHUB_ACTIONS: "true" },
      stdout: { isTTY: false },
      platform: "linux",
    });
    expect(isColorSupported()).toBe(true);
  });
});

describe("createColors", () => {
  it("wraps text with open and close codes when enabled", () => {
    const colors = createColors({ useColor: true });
    expect(colors.dim("hi")).toBe("\x1b[2mhi\x1b[22m");
    expect(colors.info("i")).toBe("\x1b[38;5;37mi\x1b[39m");
    expect(colors.greenBright("√")).toBe("\x1b[92m√\x1b[39m");
    expect(colors.trace("·")).toBe("\x1b[38;5;245m·\x1b[39m");
    expect(colors.warn("⚠")).toBe("\x1b[38;5;227m⚠\x1b[39m");
    expect(colors.error("✖")).toBe("\x1b[91m✖\x1b[39m");
    expect(colors.fatal("☠")).toBe("\x1b[38;5;88m☠\x1b[39m");
    expect(colors.bgFatal(" FATAL ")).toBe("\x1b[48;5;88m FATAL \x1b[49m");
  });

  it("returns identity functions when disabled", () => {
    const colors = createColors({ useColor: false });
    expect(colors.dim("hi")).toBe("hi");
    expect(colors.bgWarn(colors.black(colors.bold(" WARN ")))).toBe(" WARN ");
    expect(colors.trace("·")).toBe("·");
    expect(colors.warn("⚠")).toBe("⚠");
    expect(colors.error("✖")).toBe("✖");
    expect(colors.fatal("☠")).toBe("☠");
    expect(colors.bgFatal(" FATAL ")).toBe(" FATAL ");
  });

  it("returns empty string for empty input", () => {
    const colors = createColors({ useColor: true });
    expect(colors.dim("")).toBe("");
  });

  it("prevents nested close-code bleed", () => {
    const colors = createColors({ useColor: true });
    const nested = colors.whiteBright(`(${colors.stackGreen("file.ts:1:1")})`);
    expect(nested).toBe("\x1b[97m(\x1b[38;5;43mfile.ts:1:1\x1b[97m)\x1b[39m");
  });

  it("repairs many close sequences without overflowing the stack", () => {
    const colors = createColors({ useColor: true });
    const close = "\x1b[39m";
    const open = "\x1b[38;5;37m";
    const matchCount = 5000;
    // clearBleed only scans for close codes from open.length + 1 onward
    const prefix = "p".repeat(open.length + 1);
    const input = `${prefix}${close.repeat(matchCount)}y`;

    expect(() => colors.info(input)).not.toThrow();
    expect(colors.info(input)).toBe(
      `${open}${prefix}${open.repeat(matchCount)}y${close}`
    );
  });

  it("nests badge styles without full reset", () => {
    const colors = createColors({ useColor: true });
    const badge = colors.bgWarn(colors.black(colors.bold(" WARN ")));
    expect(badge).toBe(
      "\x1b[48;5;227m\x1b[30m\x1b[1m WARN \x1b[22m\x1b[39m\x1b[49m"
    );
  });
});
