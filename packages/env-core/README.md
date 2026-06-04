# @g14o/env-core

Framework-agnostic, typesafe environment variables validated with any [Standard Schema](https://standardschema.dev) library (Zod, Valibot, ArkType, and others).

**Zero runtime dependencies** — install only the validator you use.

## Install

```bash
pnpm add @g14o/env-core zod
```

## Usage

```ts
import { createEnv } from "@g14o/env-core";
import * as z from "zod";

export const env = createEnv({
  clientPrefix: "NEXT_PUBLIC_",
  server: {
    DATABASE_URL: z.url(),
    OPEN_AI_API_KEY: z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.url(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
```

On the **server**, all variables are validated and readable. On the **client**, only `client` keys are validated; accessing a `server` key throws with the exact variable name.

Import the same `env` object in server and client code — no separate client export is required.

### How client protection works

`createEnv` returns a [`Proxy`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) around the validated environment object (on both server and client, matching t3-env):

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
| `onInvalidAccess` | Hook before throwing when a server key is read on the client |

## Security

Server **values** are never validated or exposed on the client. Importing a single `env.ts` that defines `server` schemas still ships those **names** to the client bundle. For sensitive names, split into `env/server.ts` and `env/client.ts`.

## License

MIT
