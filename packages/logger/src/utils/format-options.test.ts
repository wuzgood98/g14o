import { describe, expect, it } from "vitest";
import { MIN_ALIGN_COLUMNS } from "./display";
import {
  DEFAULT_FORMAT_OPTIONS,
  DEFAULT_JSON_FIELD_ORDER,
  DEFAULT_JSON_FORMAT_OPTIONS,
  mergeFormatOptions,
  resolveFormatOptions,
  resolveJsonFieldOrder,
  resolveJsonIndent,
} from "./format-options";
import { DEFAULT_TIMESTAMP_CONFIG } from "./timestamp";

describe("resolveFormatOptions", () => {
  it("returns defaults when omitted", () => {
    expect(resolveFormatOptions(undefined)).toEqual(DEFAULT_FORMAT_OPTIONS);
    expect(DEFAULT_FORMAT_OPTIONS).toEqual({
      time: DEFAULT_TIMESTAMP_CONFIG,
      meta: true,
      name: true,
      align: MIN_ALIGN_COLUMNS,
      colors: "auto",
      stack: true,
      pretty: false,
      levels: {},
      json: DEFAULT_JSON_FORMAT_OPTIONS,
    });
  });

  it("resolves partial overrides", () => {
    expect(
      resolveFormatOptions({
        meta: false,
        name: false,
        align: false,
        colors: true,
        stack: false,
        pretty: true,
        time: { enabled: true, format: "iso", timezone: "local" },
        levels: { info: { symbol: "*" } },
        json: { pretty: true, fieldOrder: ["message", "level"] },
      })
    ).toEqual({
      time: { enabled: true, format: "iso", timezone: "local" },
      meta: false,
      name: false,
      align: false,
      colors: true,
      stack: false,
      pretty: true,
      levels: { info: { symbol: "*" } },
      json: {
        fieldOrder: ["message", "level"],
        pretty: true,
      },
    });
  });

  it("disables time when time is false", () => {
    expect(resolveFormatOptions({ time: false }).time).toEqual({
      enabled: false,
      format: "time",
      timezone: "utc",
    });
  });

  it("uses custom align width", () => {
    expect(resolveFormatOptions({ align: 120 }).align).toBe(120);
  });

  it("deep-merges level overrides over a base config", () => {
    const base = resolveFormatOptions({
      levels: { info: { symbol: "i", label: "INFO" } },
      pretty: true,
    });
    const merged = resolveFormatOptions(
      { levels: { info: { kind: "badge" }, warn: { symbol: "!" } } },
      base
    );
    expect(merged.levels).toEqual({
      info: { symbol: "i", label: "INFO", kind: "badge" },
      warn: { symbol: "!" },
    });
    expect(merged.pretty).toBe(true);
  });
});

describe("mergeFormatOptions", () => {
  it("applies transport overrides over logger options", () => {
    const global = resolveFormatOptions({
      pretty: false,
      time: { enabled: true, format: "time" },
      colors: "auto",
    });
    const merged = mergeFormatOptions(global, {
      pretty: true,
      time: { enabled: true, format: "iso" },
      json: { pretty: 4 },
    });
    expect(merged.pretty).toBe(true);
    expect(merged.time).toEqual({
      enabled: true,
      format: "iso",
      timezone: "utc",
    });
    expect(merged.json.pretty).toBe(4);
    expect(merged.colors).toBe("auto");
  });
});

describe("resolveJsonFieldOrder", () => {
  it("returns defaults when omitted", () => {
    expect(resolveJsonFieldOrder(undefined)).toEqual(DEFAULT_JSON_FIELD_ORDER);
  });

  it("dedupes and appends missing groups in default order", () => {
    expect(resolveJsonFieldOrder(["meta", "message", "meta", "level"])).toEqual(
      ["meta", "message", "level", "timestamp", "name"]
    );
  });
});

describe("resolveJsonIndent", () => {
  it("returns undefined for compact output", () => {
    expect(resolveJsonIndent(false)).toBeUndefined();
  });

  it("uses 2 spaces when pretty is true", () => {
    expect(resolveJsonIndent(true)).toBe(2);
  });

  it("clamps numeric indentation to 0–10", () => {
    expect(resolveJsonIndent(-3)).toBe(0);
    expect(resolveJsonIndent(4)).toBe(4);
    expect(resolveJsonIndent(20)).toBe(10);
  });
});
