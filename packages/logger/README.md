# @g14o/logger

> Documentation: [docs.g14o.dev/packages/logger](https://docs.g14o.dev/packages/logger)

Zero-dependency structured logger core for `@g14o` packages. Accepts a message string and optional plain-object meta on every call — no printf-style interpolation.

**Zero runtime dependencies.**

## Install

```bash
pnpm add @g14o/logger
```

## Usage

```ts
import { createLogger } from "@g14o/logger";

export const logger = createLogger({
  name: "cache",
  level: "info",
  formatOptions: { pretty: true },
  transports: [{ type: "console" }],
  redact: ["password", "token", "authorization"],
});

logger.info("Cache hit", { key: "users:1" });
logger.warn("Cache read error", { key: "users:1", err: "timeout" });
```

### Process lifecycle (`start` / `success`)

Use `start` to announce the beginning or progress of a process, and `success` when it completes:

```ts
logger.start("Migrating database", { version: 3 });
// ... work ...
logger.success("Migration complete", { rows: 1200 });
```

Pretty console output right-aligns the timestamp when the terminal is at least 80 columns and both sides fit; on narrower terminals (or when the line overflows), the timestamp is appended with a single space instead. In Node, most levels render a colored glyph; `error` renders a background-colored badge. In the browser, `warn`/`error`/`fatal` use badges. Multiline messages keep the first line alignable and indent continuations.

Severity order (lowest to highest): `trace` < `debug` < `info`/`start`/`success` < `warn` < `error` < `fatal`. The default threshold is `info`, so `trace` and `debug` are hidden unless you lower the level.

```text
→ [cache] Entering get {"key":"users:1"}                            00:00:00
◐ [cache] Migrating database {"version":3}                          00:00:01
✔ [cache] Migration complete {"rows":1200}                          00:00:02
ℹ [cache] Cache hit {"key":"users:1"}                               00:00:03
⚠ [cache] Cache read error {"key":"users:1"}                        00:00:04
```

When Unicode glyphs are unsupported (for example the Linux console), Node pretty symbols fall back to ASCII: `→` trace, `D` debug, `i` info, `✓` success, `o` start, `‼` warn, `×` fatal. The `error` badge label is unchanged.

### Errors

`error` and `fatal` take an `Error` first, with an optional message. The message (or `error.message` when omitted) prints inline next to the badge; when a separate message is given, `error.message` and the stack trace render structured below. Stack output drops only the duplicate error header and keeps frames plus other useful detail lines. Use `fatal` for unrecoverable failures above the `error` tier:

```ts
logger.error(new Error("connection refused"), "Database unavailable");
logger.fatal(new Error("process crashed"), "Unrecoverable failure");
```

```text
 ERROR  [cache] Database unavailable                                00:00:05

  connection refused
  at connect (db.ts:42:11)
  at bootstrap (server.ts:8:3)

☠ [cache] Unrecoverable failure                                     00:00:06

  process crashed
  at bootstrap (server.ts:8:3)
  at main (server.ts:1:1)
```

### JSON transport (production)

```ts
const logger = createLogger({
  name: "api",
  level: "info",
  transports: [{ type: "json" }],
});
```

Each log line is a single JSON object with stable key order: `timestamp` (when enabled), `level`, `name` (when provided), `message`, then meta keys sorted alphabetically. By default `timestamp` uses `"time"` (`HH:MM:SS` UTC).

### Format options

Customize console (and timestamp) output via `formatOptions`. Console pretty mode lives here (not on the transport):

```ts
createLogger({
  name: "api",
  formatOptions: {
    pretty: true,
    time: { enabled: true, format: "time12", timezone: "local" },
    meta: false, // hide inline `{...}` on console
    name: false, // hide `[name]` on console
    align: false, // never right-align timestamps
    colors: true, // force pretty colors
    stack: false, // omit stack frames from pretty errors
    levels: {
      info: { symbol: "★", label: "NOTE" },
      warn: { kind: "badge" },
    },
    json: {
      fieldOrder: ["level", "message", "meta", "timestamp"],
      pretty: true, // 2-space indented JSON
    },
  },
  transports: [
    { type: "console" },
    {
      type: "json",
      // deep-merged over logger formatOptions
      formatOptions: { json: { pretty: false } },
    },
  ],
});
```

| Key | Default | Applies to | Purpose |
|-----|---------|------------|---------|
| `pretty` | `false` | console | Glyph/badge console mode |
| `time` | enabled, `"time"`, `"utc"` | console + JSON | Timestamp display, format, and timezone |
| `meta` | `true` | console | Inline `{...}` metadata on log lines |
| `name` | `true` | console | `[name]` prefix segment |
| `align` | `80` | console | Min width for right-aligned timestamps; `false` = always compact |
| `colors` | `"auto"` | pretty console | Override ANSI (Node) / `%c` CSS (browser) detection |
| `stack` | `true` | pretty console errors | Stack frames below error/fatal messages |
| `levels` | `{}` | console | Per-level `symbol`, `fallbackSymbol`, `label`, `kind` |
| `json` | compact, default field order | JSON | `fieldOrder` groups and `pretty` indentation |

Transport `formatOptions` deep-merge over logger settings (`time`, `levels`, and `json` merge nested keys). JSON always includes meta keys and `name` when present; console-only toggles do not strip them from JSON.

#### Timestamps (`formatOptions.time`)

Timestamps are enabled by default (`DEFAULT_TIMESTAMP_CONFIG`). Disable them or choose a format:

```ts
createLogger({}); // timestamps on, "time" format (default)
createLogger({ formatOptions: { time: false } });
createLogger({ formatOptions: { time: { enabled: true } } }); // same as default
createLogger({ formatOptions: { time: { enabled: true, format: "time12" } } }); // 06:45:30 PM
createLogger({ formatOptions: { time: { enabled: true, format: "iso" } } }); // full ISO 8601
createLogger({ formatOptions: { time: { enabled: true, format: "utcString" } } }); // Thu, 16 Jul 2026 18:45:30 GMT
createLogger({ formatOptions: { time: { enabled: true, timezone: "local" } } }); // local clock
```

| Format | Example (UTC) |
|--------|---------------|
| `"time"` | `18:45:30` |
| `"time12"` | `06:45:30 PM` |
| `"iso"` | `2026-07-16T18:45:30.000Z` |
| `"utcString"` | `Thu, 16 Jul 2026 18:45:30 GMT` |

`timezone` is `"utc"` (default) or `"local"`. With `"local"`, `time` / `time12` use the local clock; `iso` stays full ISO; `utcString` uses `Date#toString()`.

When disabled, console output has no right-aligned time and JSON omits the `timestamp` field.

### Child loggers

```ts
const requestLogger = logger.child({ requestId: "req-123" });

requestLogger.info("handled", { status: 200 });
// meta: { requestId: "req-123", status: 200 }
```

Per-call meta overrides child bindings with the same key.

### Request IDs

Use `withRequestId` to create a request-scoped child logger. When no id is passed, one is generated automatically:

```ts
const requestLogger = logger.withRequestId();
// or with an explicit id from middleware:
const requestLogger = logger.withRequestId(req.headers["x-request-id"]);

requestLogger.info("handled", { status: 200 });
// meta: { requestId: "...", status: 200 }
```

`withRequestId` is sugar over `child({ requestId })` and works with all transports.

### Timing

Measure elapsed time with `time`. Calling it starts a timer; the returned stop function logs at `success` level with `durationMs` in meta:

```ts
const stop = logger.time("Handled request", { route: "/users" });
// ... work ...
stop({ status: 200 });
// success: "Handled request" {"route":"/users","status":200,"durationMs":43}
```

Timing inherits child bindings, so it works naturally with request-scoped loggers:

```ts
const requestLogger = logger.withRequestId("req-123");
const stop = requestLogger.time("Request complete");
stop();
// meta: { requestId: "req-123", durationMs: 25 }
```

### Browser support

`@g14o/logger` is isomorphic and works in browsers and Node without configuration changes. The same `createLogger` API and transports run in both environments.

- **`json` transport** — works everywhere (one JSON object per line via `console.*`).
- **`console` transport** — in Node, uses ANSI colors and responsive timestamps when `formatOptions.pretty: true` (right-aligned at ≥80 columns when both sides fit; otherwise compact). Colors follow Colorette-style detection: disabled by `NO_COLOR` / `--no-color` or a dumb `TERM`; enabled by `FORCE_COLOR` / `--color`, a compatible TTY, Windows (non-dumb), or supported CI. When colors are unsupported, pretty layout and glyphs remain but ANSI is omitted. Glyph selection also falls back to ASCII when Unicode is unsupported. Node defaults use symbols for `warn`/`fatal` and a badge for `error`. In the browser, pretty mode maps styles to `console` `%c` CSS styling (colored glyphs, warn/error/fatal badges, dimmed name and timestamp, indented multiline/stack details). Plain console output omits ANSI and uses a single text line.
- **Zero runtime dependencies** — terminal width, display-width estimation, Unicode detection, and environment checks are implemented in-package and fall back safely when `process.stdout` is unavailable.

```ts
import { createLogger } from "@g14o/logger";

export const logger = createLogger({
  name: "app",
  formatOptions: { pretty: true },
  transports: [{ type: "console" }],
});
```

### Inject into `@g14o/cache`

```ts
import { createCache } from "@g14o/cache";
import { createLogger } from "@g14o/logger";

const logger = createLogger({ name: "cache" });

export const { withCache } = createCache({ logger });
```

## API

### `createLogger(options): Logger`

| Option | Description |
|--------|-------------|
| `name` | Optional logger name. When set, included as `[name]` in console output and as a `name` field in JSON; omitted entirely when unset |
| `level` | Minimum severity: `"trace"` \| `"debug"` \| `"info"` \| `"success"` \| `"start"` \| `"warn"` \| `"error"` \| `"fatal"` \| `"silent"`. Default `"info"` |
| `formatOptions` | Output formatting: `pretty`, `time`, `meta`, `name`, `align`, `colors`, `stack`, `levels`, `json`. See [Format options](#format-options). Per-transport overrides deep-merge over these settings |
| `transports` | Built-in transports. Default `[{ type: "console" }]` |
| `redact` | Key names to redact recursively in meta (case-insensitive). Default `["password", "token", "authorization"]` |

### `Logger`

| Method | Description |
|--------|-------------|
| `trace(message, meta?)` | Log at trace level (more verbose than debug; hidden by the default `info` threshold) |
| `debug(message, meta?)` | Log at debug level |
| `info(message, meta?)` | Log at info level |
| `start(message, meta?)` | Log process start or progress (info tier) |
| `success(message, meta?)` | Log successful completion (info tier) |
| `warn(message, meta?)` | Log at warn level |
| `error(error, message?)` | Log at error level; renders the error and its stack structured below the badge |
| `fatal(error, message?)` | Log at fatal level (above error); same structured error/stack rendering as `error` |
| `child(bindings)` | Returns a child logger merging `bindings` into every subsequent log |
| `withRequestId(id?)` | Returns a child logger with `requestId` bound; generates one when `id` is omitted |
| `time(label, meta?)` | Starts a timer; returned stop function logs at `success` with `durationMs` in meta |

### Built-in transports

| Type | Options | Output |
|------|---------|--------|
| `console` | `formatOptions?` | Human-readable lines; colorized glyphs when `formatOptions.pretty: true` (ANSI in Node when the terminal supports color, `%c` CSS in browsers) |
| `json` | `formatOptions?` | One JSON object per line (or pretty-printed when `json.pretty` is set) |

Pretty console prefixes (Node defaults): colored glyphs `→` trace, `◆`/`D` debug, `ℹ`/`i` info, `✔`/`✓` success, `◐`/`o` start, `⚠`/`‼` warn, `☠`/`×` fatal (Unicode / ASCII fallback); background badge ` ERROR ` (red). In the browser, `warn`/`error`/`fatal` use badges and lower levels use `·`/`●`/`i`/`√`/`◐`. Override per level with `formatOptions.levels`.

### Types

Exported: `Logger`, `LoggerOptions`, `FormatOptions`, `ResolvedFormatOptions`, `LevelFormatOptions`, `JsonFormatOptions`, `JsonFieldGroup`, `ActiveLogLevel`, `Transport`, `ConsoleTransport`, `JsonTransport`, `LogLevel`, `TimestampFormat`, `TimestampOption`, `TimestampTimezone`, `ResolvedTimestampConfig`, `DEFAULT_TIMESTAMP_FORMAT`, `DEFAULT_TIMESTAMP_CONFIG`, `DEFAULT_FORMAT_OPTIONS`, `DEFAULT_JSON_FIELD_ORDER`, `resolveFormatOptions`, `mergeFormatOptions`.

## License

MIT
