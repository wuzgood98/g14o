import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIMESTAMP_CONFIG,
  DEFAULT_TIMESTAMP_FORMAT,
  DEFAULT_TIMESTAMP_TIMEZONE,
  formatTimestamp,
  resolveTimestampConfig,
} from "./timestamp";

describe("resolveTimestampConfig", () => {
  it("defaults to enabled with time format when omitted", () => {
    expect(resolveTimestampConfig(undefined)).toEqual(DEFAULT_TIMESTAMP_CONFIG);
  });

  it("treats true as the default config", () => {
    expect(resolveTimestampConfig(true)).toEqual(DEFAULT_TIMESTAMP_CONFIG);
  });

  it("disables timestamps when false", () => {
    expect(resolveTimestampConfig(false)).toEqual({
      enabled: false,
      format: DEFAULT_TIMESTAMP_FORMAT,
      timezone: DEFAULT_TIMESTAMP_TIMEZONE,
    });
  });

  it("disables timestamps when enabled is false", () => {
    expect(resolveTimestampConfig({ enabled: false })).toEqual({
      enabled: false,
      format: DEFAULT_TIMESTAMP_FORMAT,
      timezone: DEFAULT_TIMESTAMP_TIMEZONE,
    });
  });

  it("defaults format to time when enabled without format", () => {
    expect(resolveTimestampConfig({ enabled: true })).toEqual({
      enabled: true,
      format: "time",
      timezone: "utc",
    });
  });

  it("uses the provided format when enabled", () => {
    expect(resolveTimestampConfig({ enabled: true, format: "iso" })).toEqual({
      enabled: true,
      format: "iso",
      timezone: "utc",
    });
    expect(
      resolveTimestampConfig({ enabled: true, format: "utcString" })
    ).toEqual({
      enabled: true,
      format: "utcString",
      timezone: "utc",
    });
    expect(resolveTimestampConfig({ enabled: true, format: "time12" })).toEqual(
      {
        enabled: true,
        format: "time12",
        timezone: "utc",
      }
    );
  });

  it("uses the provided timezone when enabled", () => {
    expect(
      resolveTimestampConfig({
        enabled: true,
        format: "time",
        timezone: "local",
      })
    ).toEqual({
      enabled: true,
      format: "time",
      timezone: "local",
    });
  });
});

describe("formatTimestamp", () => {
  it("formats time as HH:MM:SS UTC", () => {
    expect(formatTimestamp("2026-07-15T00:00:00.000Z", "time")).toBe(
      "00:00:00"
    );
    expect(formatTimestamp("2026-07-15T14:30:45.123Z", "time")).toBe(
      "14:30:45"
    );
  });

  it("returns the full ISO string for iso format", () => {
    expect(formatTimestamp("2026-07-15T14:30:45.123Z", "iso")).toBe(
      "2026-07-15T14:30:45.123Z"
    );
    expect(formatTimestamp("2026-07-15T14:30:45.123Z", "iso", "local")).toBe(
      "2026-07-15T14:30:45.123Z"
    );
  });

  it("formats utcString as HTTP-style UTC date", () => {
    expect(formatTimestamp("2026-07-16T18:45:30.000Z", "utcString")).toBe(
      "Thu, 16 Jul 2026 18:45:30 GMT"
    );
  });

  it("formats utcString as local Date#toString when timezone is local", () => {
    const iso = "2026-07-16T18:45:30.000Z";
    expect(formatTimestamp(iso, "utcString", "local")).toBe(
      new Date(iso).toString()
    );
  });

  it("formats time12 with AM/PM UTC", () => {
    expect(formatTimestamp("2026-07-16T00:00:00.000Z", "time12")).toBe(
      "12:00:00 AM"
    );
    expect(formatTimestamp("2026-07-16T12:00:00.000Z", "time12")).toBe(
      "12:00:00 PM"
    );
    expect(formatTimestamp("2026-07-16T18:45:30.000Z", "time12")).toBe(
      "06:45:30 PM"
    );
  });

  it("formats time and time12 in local timezone", () => {
    const iso = "2026-07-16T18:45:30.000Z";
    const date = new Date(iso);
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    const expectedTime = `${String(hours).padStart(2, "0")}:${minutes}:${seconds}`;

    expect(formatTimestamp(iso, "time", "local")).toBe(expectedTime);

    const meridiem = hours >= 12 ? "PM" : "AM";
    const hours12 = hours % 12 || 12;
    const expectedTime12 = `${String(hours12).padStart(2, "0")}:${minutes}:${seconds} ${meridiem}`;
    expect(formatTimestamp(iso, "time12", "local")).toBe(expectedTime12);
  });
});
