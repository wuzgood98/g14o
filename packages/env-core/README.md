# @g14o/env-core

> Documentation: [docs.g14o.dev/packages/env-core](https://docs.g14o.dev/packages/env-core)

Framework-agnostic, typesafe environment variables validated with any [Standard Schema](https://standardschema.dev) library (Zod, Valibot, ArkType, and others).

**Zero runtime dependencies** — install only the validator you use.

## Install

```bash
pnpm add @g14o/env-core zod
```

### Peer dependencies

`zod`, `valibot`, and `arktype` are **optional** peers — install the validator you use. Ranges follow [Standard Schema v1](https://standardschema.dev) support on each major line (`arktype` ^2.0.0, `valibot` ^1.0.0, `zod` ^4.0.0). `typescript` (>=5) is optional but recommended for typed env definitions.

## Usage

```ts
import { createEnv } from "@g14o/env-core";
import * as z from "zod";

export const env = createEnv({
  clientPrefix: "PUBLIC_",
  server: {
    DATABASE_URL: z.url(),
    OPEN_AI_API_KEY: z.string().min(1),
  },
  client: {
    PUBLIC_API_URL: z.url(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
```

On the **server**, all variables are validated and readable. On the **client**, only `client` keys are validated; accessing a `server` key throws with the exact variable name.

Import the same `env` object in server and client code — no separate client export is required.

### How client protection works

`createEnv` returns a [`Proxy`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) around the validated environment object (on both server and client):

- **Server**: the proxy is transparent — all validated server and client keys are readable.
- **Client**: only `client` schemas are validated at import time (missing server vars in `process.env` do not throw).
- **Client access**: any property that is not a declared `client` key throws with the exact name, e.g. `DATABASE_URL` or typos like `NOT_DECLARED`.
- **Interop**: `__esModule` and `$$typeof` are ignored so bundlers and React do not trigger false positives.

### Valibot

```ts
import { createEnv } from "@g14o/env-core";
import * as v from "valibot";

export const env = createEnv({
  clientPrefix: "PUBLIC_",
  server: {
    DATABASE_URL: v.pipe(v.string(), v.url()),
  },
  client: {
    PUBLIC_API_URL: v.pipe(v.string(), v.url()),
  },
  runtimeEnv: process.env,
});
```

### ArkType

```ts
import { createEnv } from "@g14o/env-core";
import { type } from "arktype";

export const env = createEnv({
  server: {
    DATABASE_URL: type("string.url"),
  },
  clientPrefix: "PUBLIC_",
  client: {
    PUBLIC_API_URL: type("string.url"),
  },
  runtimeEnv: process.env,
});
```

### Strict runtime mapping (bundler-friendly)

When your framework only inlines env vars you reference explicitly, use `runtimeEnvStrict`:

```ts
import { createEnv } from "@g14o/env-core";
import * as z from "zod";

export const env = createEnv({
  server: { DATABASE_URL: z.url() },
  clientPrefix: "NEXT_PUBLIC_",
  client: { NEXT_PUBLIC_API_URL: z.url() },
  runtimeEnvStrict: {
    DATABASE_URL: process.env.DATABASE_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
});
```

### Overriding default error handler

```ts
import { createEnv } from "@g14o/env-core";

export const env = createEnv({
  // ...
  // Called when schema validation fails.
  onValidationError: (issues) => {
    console.error("Invalid environment variables:", issues);
    throw new Error("Invalid environment variables");
  },
  // Called when a server variable is accessed on the client.
  onInvalidAccess: (variable) => {
    console.error("Invalid access to server variable:", variable);
    throw new Error("Invalid access to server variable");
  },
});
```

### Tell when we're in a server context

```ts
import { createEnv } from "@g14o/env-core";

export const env = createEnv({
  // ...
  // Tell when we're in a server context
  isServer: typeof window === "undefined", // or straight up `true` or `false`
});
```

### Skip validation

`skipValidation` bypasses both schema validation and the client-access proxy. Only use it when exposing the picked keys acceptable for the current runtime.

```ts
import { createEnv } from "@g14o/env-core";

export const env = createEnv({
  // ...
  // Tell the library to skip validation and return picked runtime values only
  skipValidation: true,
});
```

## Options

| Option | Description |
|--------|-------------|
| `server` | Server-only variables (validated on server; throw on client access) |
| `client` | Client-safe variables (validated on server and client) |
| `clientPrefix` | Optional prefix required on all `client` keys (type + runtime) |
| `runtimeEnv` | Record to read values from (e.g. `process.env`) |
| `runtimeEnvStrict` | Explicit per-key mapping; mutually exclusive with `runtimeEnv` |
| `emptyStringAsUndefined` | Treat `""` as `undefined` before validation |
| `isServer` | Override server detection (default: `typeof window === "undefined"`) |
| `onValidationError` | Hook when schema validation fails; may throw custom error, otherwise default `InvalidEnvironmentVariablesError` is thrown |
| `onInvalidAccess` | Hook when a server key is accessed on the client; may throw custom error, otherwise default server-access error is thrown |
| `skipValidation` | Bypasses both schema validation and the client-access proxy. Only use it when exposing the picked keys acceptable for the current runtime (default: `false`) |

## Security

Server **values** are never validated or exposed on the client. Importing a single `env.ts` that defines `server` schemas still ships those **names** to the client bundle. For sensitive names, split into `env/server.ts` and `env/client.ts`.

## License

MIT
