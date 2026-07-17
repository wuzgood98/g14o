import { describe, expect, it } from "vitest";
import type { LogLevel } from "../types";
import { shouldLog } from "./levels";

const EMITTABLE_LEVELS: Exclude<LogLevel, "silent">[] = [
  "trace",
  "debug",
  "info",
  "success",
  "start",
  "warn",
  "error",
  "fatal",
];

describe("shouldLog", () => {
  it("orders severity as trace < debug < info tier < warn < error < fatal", () => {
    expect(shouldLog("trace", "trace")).toBe(true);
    expect(shouldLog("debug", "trace")).toBe(false);
    expect(shouldLog("debug", "debug")).toBe(true);
    expect(shouldLog("info", "debug")).toBe(false);
    expect(shouldLog("info", "info")).toBe(true);
    expect(shouldLog("info", "success")).toBe(true);
    expect(shouldLog("info", "start")).toBe(true);
    expect(shouldLog("warn", "info")).toBe(false);
    expect(shouldLog("warn", "warn")).toBe(true);
    expect(shouldLog("error", "warn")).toBe(false);
    expect(shouldLog("error", "error")).toBe(true);
    expect(shouldLog("error", "fatal")).toBe(true);
    expect(shouldLog("fatal", "error")).toBe(false);
    expect(shouldLog("fatal", "fatal")).toBe(true);
  });

  it("treats success and start as the info tier", () => {
    expect(shouldLog("info", "success")).toBe(true);
    expect(shouldLog("info", "start")).toBe(true);
    expect(shouldLog("warn", "success")).toBe(false);
    expect(shouldLog("warn", "start")).toBe(false);
  });

  it("suppresses every level when the threshold is silent", () => {
    for (const level of EMITTABLE_LEVELS) {
      expect(shouldLog("silent", level)).toBe(false);
    }
  });

  it("never emits silent as a log level", () => {
    for (const threshold of [...EMITTABLE_LEVELS, "silent"] as LogLevel[]) {
      expect(shouldLog(threshold, "silent")).toBe(false);
    }
  });
});
