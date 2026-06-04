import { guardEnv } from "./client-guard.js";
import {
  assertStrictRuntimeKeys,
  pickRuntimeValues,
} from "./pick-runtime-env.js";
import { assertClientPrefix, assertNoOverlappingKeys } from "./prefix.js";
import type {
  AssertValidClientPrefix,
  CreateEnvOptions,
  CreateEnvOutput,
  ResolveClientShape,
  ResolvedCreateEnvOptions,
  RuntimeEnvInput,
  SchemaShape,
} from "./types.js";
import { validateShape } from "./validate.js";

function resolveIsServer(isServer: boolean | undefined): boolean {
  if (isServer !== undefined) {
    return isServer;
  }
  const maybeWindow = (globalThis as { window?: unknown }).window;
  return maybeWindow === undefined;
}

function getRuntimeSource(
  options: CreateEnvOptions<SchemaShape, SchemaShape, string | undefined>
): RuntimeEnvInput {
  if ("runtimeEnvStrict" in options && options.runtimeEnvStrict !== undefined) {
    return options.runtimeEnvStrict;
  }
  if ("runtimeEnv" in options && options.runtimeEnv !== undefined) {
    return options.runtimeEnv;
  }
  throw new Error("createEnv requires either runtimeEnv or runtimeEnvStrict");
}

function normalizeShapes<
  TServer extends SchemaShape | undefined,
  TClient extends SchemaShape | undefined,
>(
  server: TServer,
  client: TClient
): { server: SchemaShape; client: SchemaShape } {
  return {
    server: (server ?? {}) as SchemaShape,
    client: (client ?? {}) as SchemaShape,
  };
}

function resolveOptions<
  TServer extends SchemaShape | undefined,
  TClient extends SchemaShape | undefined,
>(
  options: CreateEnvOptions<TServer, TClient, string | undefined>
): ResolvedCreateEnvOptions<SchemaShape, SchemaShape> {
  const { server: serverShape, client: clientShape } = normalizeShapes(
    options.server,
    options.client
  );
  const serverKeys = Object.keys(serverShape);
  const clientKeys = Object.keys(clientShape);
  const allKeys = [...serverKeys, ...clientKeys];

  assertNoOverlappingKeys(serverKeys, clientKeys);
  assertClientPrefix(options.clientPrefix, clientKeys);

  const runtime = getRuntimeSource(
    options as CreateEnvOptions<SchemaShape, SchemaShape, string | undefined>
  );

  if ("runtimeEnvStrict" in options && options.runtimeEnvStrict !== undefined) {
    assertStrictRuntimeKeys(allKeys, runtime);
  }

  return {
    server: serverShape,
    client: clientShape,
    clientPrefix: options.clientPrefix,
    emptyStringAsUndefined: options.emptyStringAsUndefined ?? false,
    isServer: resolveIsServer(options.isServer),
    onInvalidAccess: options.onInvalidAccess,
    skipValidation: options.skipValidation ?? false,
    runtime,
  };
}

/**
 * Validates environment variables with Standard Schema shapes and returns a typed, frozen env object.
 *
 * On the server (`isServer` true by default when `globalThis.window` is undefined), all declared
 * `server` and `client` keys are picked from `runtimeEnv` or `runtimeEnvStrict`, validated, and
 * exposed. On the client, only `client` keys are validated; `server` keys are omitted from the
 * validated object and throw if accessed (via a `Proxy` guard unless `onInvalidAccess` handles it).
 *
 * When `skipValidation` is true, values are picked without schema validation (internal/testing use).
 *
 * @template TServer - Server-only schema shape.
 * @template TClient - Client-safe schema shape.
 * @template TPrefix - Required `client` key prefix when `clientPrefix` is set.
 * @param options - Server/client schemas, runtime source, and validation behavior.
 * @param options.server - Server-only variables; validated only when `isServer` is true.
 * @param options.client - Variables safe on the client; always validated unless `skipValidation`.
 * @param options.clientPrefix - Prefix every `client` key must use (enforced at compile time and runtime).
 * @param options.runtimeEnv - Loose record to read values from (e.g. `process.env`).
 * @param options.runtimeEnvStrict - Explicit per-key mapping; mutually exclusive with `runtimeEnv`.
 * @param options.emptyStringAsUndefined - Treat `""` as `undefined` before validation. Default `false`.
 * @param options.isServer - Override server detection. Default: no `window` on `globalThis`.
 * @param options.onInvalidAccess - Called before throwing when a non-client key is read on the client.
 * @param options.skipValidation - Skip schema validation and return picked runtime values only. Default `false`.
 * @returns Readonly, frozen env object typed from inferred schema outputs; client reads are guarded by `Proxy`.
 *
 * @example
 * ```ts
 * import { createEnv } from "@g14o/env-core";
 * import * as z from "zod";
 *
 * export const env = createEnv({
 *   clientPrefix: "PUBLIC_",
 *   server: {
 *     DATABASE_URL: z.url(),
 *     OPEN_AI_API_KEY: z.string().min(8),
 *   },
 *   client: {
 *     PUBLIC_API_URL: z.url(),
 *     PUBLIC_APP_NAME: z.string().min(1),
 *   },
 *   runtimeEnvStrict: runtimeEnvStrict(),
 *   emptyStringAsUndefined: true,
 * });
 * ```
 */
export function createEnv<
  TServer extends SchemaShape | undefined = undefined,
  const TClient extends SchemaShape | undefined = undefined,
  const TPrefix extends string | undefined = undefined,
>(
  options: CreateEnvOptions<TServer, TClient, TPrefix> &
    AssertValidClientPrefix<TPrefix, TClient>
): CreateEnvOutput<TServer, ResolveClientShape<TPrefix, TClient>> {
  const resolved = resolveOptions(
    options as CreateEnvOptions<SchemaShape, SchemaShape, string | undefined>
  );
  const serverKeys = Object.keys(resolved.server);
  const clientKeys = Object.keys(resolved.client);
  const allKeys = [...serverKeys, ...clientKeys];
  const clientKeySet = new Set(clientKeys);

  const picked = pickRuntimeValues(
    allKeys,
    resolved.runtime,
    resolved.emptyStringAsUndefined
  );

  if (resolved.skipValidation) {
    return Object.freeze({ ...picked }) as CreateEnvOutput<
      TServer,
      ResolveClientShape<TPrefix, TClient>
    >;
  }

  const clientValues = pickRuntimeValues(
    clientKeys,
    resolved.runtime,
    resolved.emptyStringAsUndefined
  );
  const validatedClient = validateShape(
    resolved.client,
    clientValues,
    "client"
  );

  let validatedServer: Record<string, unknown> = {};

  if (resolved.isServer && serverKeys.length > 0) {
    const serverValues = pickRuntimeValues(
      serverKeys,
      resolved.runtime,
      resolved.emptyStringAsUndefined
    );
    validatedServer = validateShape(resolved.server, serverValues, "server");
  }

  const target = Object.freeze(
    resolved.isServer
      ? { ...validatedServer, ...validatedClient }
      : { ...validatedClient }
  ) as CreateEnvOutput<TServer, ResolveClientShape<TPrefix, TClient>>;

  return guardEnv(target, {
    isServer: resolved.isServer,
    clientKeys: clientKeySet,
    onInvalidAccess: resolved.onInvalidAccess,
  }) as CreateEnvOutput<TServer, ResolveClientShape<TPrefix, TClient>>;
}
