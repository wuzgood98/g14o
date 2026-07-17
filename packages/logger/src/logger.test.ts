import { afterEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "./logger";
// biome-ignore lint/performance/noNamespaceImport: vitest spyOn requires module namespace
import * as transportsModule from "./transports";
import type { LogRecord, LogTransport } from "./types";
// biome-ignore lint/performance/noNamespaceImport: vitest spyOn requires module namespace
import * as idModule from "./utils/id";
// biome-ignore lint/performance/noNamespaceImport: vitest spyOn requires module namespace
import * as timingModule from "./utils/timing";

const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function createCaptureTransport(): {
  records: LogRecord[];
  transport: LogTransport;
} {
  const records: LogRecord[] = [];
  const transport: LogTransport = {
    write(record: LogRecord): void {
      records.push(record);
    },
  };
  return { records, transport };
}

function createMockTransport(): LogTransport {
  return {
    write: vi.fn(),
  };
}

describe("createLogger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("filters logs below the configured level", () => {
    const { records, transport } = createCaptureTransport();
    vi.spyOn(transportsModule, "resolveTransports").mockReturnValue([
      transport,
    ]);

    const logger = createLogger({
      name: "app",
      level: "warn",
      transports: [{ type: "console" }],
      redact: [],
    });

    logger.info("hidden");
    logger.warn("visible");

    expect(records).toHaveLength(1);
    expect(records[0]?.level).toBe("warn");
    expect(records[0]?.message).toBe("visible");
  });

  it("emits logs at or above the configured level", () => {
    const { records, transport } = createCaptureTransport();
    vi.spyOn(transportsModule, "resolveTransports").mockReturnValue([
      transport,
    ]);

    const logger = createLogger({
      name: "app",
      level: "info",
      transports: [{ type: "console" }],
      redact: [],
    });

    logger.trace("trace message");
    logger.debug("debug message");
    logger.info("info message");
    logger.warn("warn message");
    logger.error("error message");
    logger.fatal("fatal message");

    expect(records.map((record) => record.level)).toEqual([
      "info",
      "warn",
      "error",
      "fatal",
    ]);
    expect(records[0]?.message).toBe("info message");
  });

  it("emits every level when the threshold is trace", () => {
    const { records, transport } = createCaptureTransport();
    vi.spyOn(transportsModule, "resolveTransports").mockReturnValue([
      transport,
    ]);

    const logger = createLogger({
      level: "trace",
      transports: [{ type: "console" }],
      redact: [],
    });

    logger.trace("trace message");
    logger.debug("debug message");
    logger.info("info message");
    logger.warn("warn message");
    logger.error("error message");
    logger.fatal("fatal message");

    expect(records.map((record) => record.level)).toEqual([
      "trace",
      "debug",
      "info",
      "warn",
      "error",
      "fatal",
    ]);
  });

  it("suppresses trace when the threshold is debug", () => {
    const { records, transport } = createCaptureTransport();
    vi.spyOn(transportsModule, "resolveTransports").mockReturnValue([
      transport,
    ]);

    const logger = createLogger({
      level: "debug",
      transports: [{ type: "console" }],
      redact: [],
    });

    logger.trace("hidden");
    logger.debug("visible");

    expect(records).toHaveLength(1);
    expect(records[0]?.level).toBe("debug");
  });

  it("emits only fatal when the threshold is fatal", () => {
    const { records, transport } = createCaptureTransport();
    vi.spyOn(transportsModule, "resolveTransports").mockReturnValue([
      transport,
    ]);

    const logger = createLogger({
      level: "fatal",
      transports: [{ type: "console" }],
      redact: [],
    });

    logger.error("hidden");
    logger.fatal("visible");

    expect(records).toHaveLength(1);
    expect(records[0]?.level).toBe("fatal");
    expect(records[0]?.message).toBe("visible");
  });

  it("supports error-like fatal calls with structured meta", () => {
    const { records, transport } = createCaptureTransport();
    vi.spyOn(transportsModule, "resolveTransports").mockReturnValue([
      transport,
    ]);

    const logger = createLogger({
      name: "app",
      level: "fatal",
      transports: [{ type: "console" }],
      redact: [],
    });

    const error = new Error("process crashed");
    logger.fatal(error, "Unrecoverable failure");

    expect(records[0]?.level).toBe("fatal");
    expect(records[0]?.message).toBe("Unrecoverable failure");
    expect(records[0]?.meta).toMatchObject({
      err: error,
      error: "process crashed",
    });
  });

  it("merges child bindings and lets per-call meta override", () => {
    const { records, transport } = createCaptureTransport();
    vi.spyOn(transportsModule, "resolveTransports").mockReturnValue([
      transport,
    ]);

    const logger = createLogger({
      name: "app",
      level: "info",
      transports: [{ type: "console" }],
      redact: [],
    }).child({ requestId: "req-1", userId: "u-1" });

    logger.info("handled", { userId: "u-2", status: 200 });

    expect(records[0]?.meta).toEqual({
      requestId: "req-1",
      userId: "u-2",
      status: 200,
    });
  });

  it("redacts sensitive meta before writing", () => {
    const { records, transport } = createCaptureTransport();
    vi.spyOn(transportsModule, "resolveTransports").mockReturnValue([
      transport,
    ]);

    const logger = createLogger({
      name: "app",
      level: "info",
      transports: [{ type: "console" }],
      redact: ["token"],
    });

    logger.info("auth", { token: "secret", ok: true });

    expect(records[0]?.meta).toEqual({ token: "[REDACTED]", ok: true });
  });

  it("short-circuits silent mode without invoking transports", () => {
    const transport = createMockTransport();
    vi.spyOn(transportsModule, "resolveTransports").mockReturnValue([
      transport,
    ]);

    const logger = createLogger({
      name: "app",
      level: "silent",
      transports: [{ type: "console" }],
      redact: [],
    });

    logger.trace("should not log");
    logger.error("should not log");
    logger.fatal("should not log");

    expect(transport.write).not.toHaveBeenCalled();
  });

  it("includes the logger name on every record", () => {
    const { records, transport } = createCaptureTransport();
    vi.spyOn(transportsModule, "resolveTransports").mockReturnValue([
      transport,
    ]);

    const logger = createLogger({
      name: "cache",
      level: "info",
      transports: [{ type: "console" }],
      redact: [],
    });

    logger.info("ready");

    expect(records[0]?.name).toBe("cache");
  });

  it("allows creating a logger without a name", () => {
    const { records, transport } = createCaptureTransport();
    vi.spyOn(transportsModule, "resolveTransports").mockReturnValue([
      transport,
    ]);

    const logger = createLogger({
      level: "info",
      transports: [{ type: "console" }],
      redact: [],
    });

    logger.info("ready");

    expect(records[0]?.name).toBeUndefined();
    expect(records[0]?.message).toBe("ready");
  });

  it("still captures a raw ISO timestamp when timestamp display is disabled", () => {
    const { records, transport } = createCaptureTransport();
    const resolveSpy = vi
      .spyOn(transportsModule, "resolveTransports")
      .mockReturnValue([transport]);

    const logger = createLogger({
      level: "info",
      formatOptions: { time: false },
      transports: [{ type: "console" }],
      redact: [],
    });

    logger.info("ready");

    expect(resolveSpy).toHaveBeenCalledWith([{ type: "console" }], {
      time: { enabled: false, format: "time", timezone: "utc" },
      meta: true,
      name: true,
      align: 80,
      colors: "auto",
      stack: true,
      pretty: false,
      levels: {},
      json: {
        fieldOrder: ["timestamp", "level", "name", "message", "meta"],
        pretty: false,
      },
    });
    expect(records[0]?.timestamp).toMatch(ISO_TIMESTAMP_PATTERN);
  });

  it("supports cache-style error + message calls", () => {
    const { records, transport } = createCaptureTransport();
    vi.spyOn(transportsModule, "resolveTransports").mockReturnValue([
      transport,
    ]);

    const logger = createLogger({
      name: "cache",
      level: "warn",
      transports: [{ type: "console" }],
      redact: [],
    });

    const error = new Error("timeout");
    logger.warn(error, "Cache read error");

    expect(records[0]?.message).toBe("Cache read error");
    expect(records[0]?.meta).toMatchObject({
      err: error,
      error: "timeout",
    });
  });

  it("emits success and start at info level", () => {
    const { records, transport } = createCaptureTransport();
    vi.spyOn(transportsModule, "resolveTransports").mockReturnValue([
      transport,
    ]);

    const logger = createLogger({
      name: "app",
      level: "info",
      transports: [{ type: "console" }],
      redact: [],
    });

    logger.start("Migrating");
    logger.success("Done");

    expect(records.map((record) => record.level)).toEqual(["start", "success"]);
    expect(records[0]?.message).toBe("Migrating");
    expect(records[1]?.message).toBe("Done");
  });

  it("suppresses success and start at warn level", () => {
    const { records, transport } = createCaptureTransport();
    vi.spyOn(transportsModule, "resolveTransports").mockReturnValue([
      transport,
    ]);

    const logger = createLogger({
      name: "app",
      level: "warn",
      transports: [{ type: "console" }],
      redact: [],
    });

    logger.start("Migrating");
    logger.success("Done");
    logger.warn("Slow query");

    expect(records).toHaveLength(1);
    expect(records[0]?.level).toBe("warn");
  });

  it("logs elapsed duration when a time stop function is called", () => {
    const { records, transport } = createCaptureTransport();
    vi.spyOn(transportsModule, "resolveTransports").mockReturnValue([
      transport,
    ]);
    const monotonicNow = vi
      .spyOn(timingModule, "monotonicNow")
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(142.7);

    const logger = createLogger({
      name: "api",
      level: "info",
      transports: [{ type: "console" }],
      redact: [],
    });

    const stop = logger.time("Handled request", { route: "/users" });
    stop({ status: 200 });

    expect(monotonicNow).toHaveBeenCalledTimes(2);
    expect(records).toHaveLength(1);
    expect(records[0]?.level).toBe("success");
    expect(records[0]?.message).toBe("Handled request");
    expect(records[0]?.meta).toEqual({
      route: "/users",
      status: 200,
      durationMs: 43,
    });
  });

  it("suppresses time stop logs below the configured level", () => {
    const { records, transport } = createCaptureTransport();
    vi.spyOn(transportsModule, "resolveTransports").mockReturnValue([
      transport,
    ]);
    vi.spyOn(timingModule, "monotonicNow")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(10);

    const logger = createLogger({
      level: "warn",
      transports: [{ type: "console" }],
      redact: [],
    });

    logger.time("Hidden timing")();

    expect(records).toHaveLength(0);
  });

  it("binds an explicit request id via withRequestId", () => {
    const { records, transport } = createCaptureTransport();
    vi.spyOn(transportsModule, "resolveTransports").mockReturnValue([
      transport,
    ]);

    const logger = createLogger({
      name: "api",
      level: "info",
      transports: [{ type: "console" }],
      redact: [],
    }).withRequestId("req-123");

    logger.info("handled", { status: 200 });

    expect(records[0]?.meta).toEqual({
      requestId: "req-123",
      status: 200,
    });
  });

  it("generates a request id when withRequestId is called without an id", () => {
    const { records, transport } = createCaptureTransport();
    vi.spyOn(transportsModule, "resolveTransports").mockReturnValue([
      transport,
    ]);
    vi.spyOn(idModule, "generateRequestId").mockReturnValue(
      "generated-request-id"
    );

    const logger = createLogger({
      name: "api",
      level: "info",
      transports: [{ type: "console" }],
      redact: [],
    }).withRequestId();

    logger.info("handled");

    expect(records[0]?.meta).toEqual({
      requestId: "generated-request-id",
    });
  });

  it("inherits child bindings when timing from a request-scoped logger", () => {
    const { records, transport } = createCaptureTransport();
    vi.spyOn(transportsModule, "resolveTransports").mockReturnValue([
      transport,
    ]);
    vi.spyOn(timingModule, "monotonicNow")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(25);

    const logger = createLogger({
      level: "info",
      transports: [{ type: "console" }],
      redact: [],
    }).withRequestId("req-456");

    logger.time("Request complete")();

    expect(records[0]?.meta).toEqual({
      requestId: "req-456",
      durationMs: 25,
    });
  });
});
