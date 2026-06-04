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
