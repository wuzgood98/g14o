import type { OnInvalidAccessHandler } from "./client-guard.js";
import type { StandardSchemaV1 } from "./standard-schema.js";

export type SchemaShape = Record<string, StandardSchemaV1>;

export type RuntimeEnvValue = string | number | boolean | undefined | null;

export type RuntimeEnvInput = Record<string, RuntimeEnvValue>;

export type Simplify<T> = { [K in keyof T]: T[K] } & {};

export type InferSchemaOutput<TSchema extends StandardSchemaV1> =
  TSchema extends StandardSchemaV1<unknown, infer TOutput> ? TOutput : never;

export type InferShapeOutput<TShape extends SchemaShape> = Simplify<{
  [K in keyof TShape]: InferSchemaOutput<TShape[K]>;
}>;

type ClientKeyWithPrefix<
  TPrefix extends string,
  TKey extends PropertyKey,
> = TKey extends `${TPrefix}${string}` ? TKey : never;

export type PrefixedClientShape<
  TPrefix extends string,
  TClient extends SchemaShape,
> = Simplify<{
  [K in keyof TClient as ClientKeyWithPrefix<TPrefix, K>]: TClient[K];
}>;

export type InvalidClientKeys<
  TPrefix extends string,
  TClient extends SchemaShape,
> = Exclude<keyof TClient, `${TPrefix}${string}`>;

export type AssertValidClientPrefix<
  TPrefix extends string | undefined,
  TClient extends SchemaShape | undefined,
> = TPrefix extends string
  ? TClient extends SchemaShape
    ? InvalidClientKeys<TPrefix, TClient> extends never
      ? unknown
      : `Client environment variable(s) must start with "${TPrefix}": ${InvalidClientKeys<TPrefix, TClient> & string}`
    : unknown
  : unknown;

export type ResolveClientShape<
  TPrefix extends string | undefined,
  TClient extends SchemaShape | undefined,
> = TClient extends SchemaShape
  ? TPrefix extends string
    ? PrefixedClientShape<TPrefix, TClient>
    : TClient
  : Record<string, never>;

type ShapeKeys<TShape extends SchemaShape | undefined> =
  TShape extends SchemaShape ? keyof TShape : never;

export type StrictRuntimeEnv<
  TServer extends SchemaShape | undefined,
  TClient extends SchemaShape | undefined,
> = Simplify<{
  [K in ShapeKeys<TServer> | ShapeKeys<TClient>]: RuntimeEnvValue;
}>;

type MutuallyExclusive<
  A extends Record<string, unknown>,
  B extends Record<string, unknown>,
> = (A & { [K in keyof B]?: never }) | (B & { [K in keyof A]?: never });

type RuntimeEnvSource<
  TServer extends SchemaShape | undefined,
  TClient extends SchemaShape | undefined,
> = MutuallyExclusive<
  { runtimeEnv: RuntimeEnvInput },
  { runtimeEnvStrict: StrictRuntimeEnv<TServer, TClient> }
>;

export type MergeEnvShapes<
  TServer extends SchemaShape | undefined,
  TClient extends SchemaShape | undefined,
> = (TServer extends SchemaShape ? TServer : Record<string, never>) &
  (TClient extends SchemaShape ? TClient : Record<string, never>);

export type CreateEnvOptions<
  TServer extends SchemaShape | undefined = undefined,
  TClient extends SchemaShape | undefined = undefined,
  TPrefix extends string | undefined = undefined,
> = {
  server?: TServer;
  client?: TClient;
  clientPrefix?: TPrefix;
  emptyStringAsUndefined?: boolean;
  isServer?: boolean;
  onInvalidAccess?: OnInvalidAccessHandler;
  /** @internal */
  skipValidation?: boolean;
} & RuntimeEnvSource<TServer, TClient>;

export type CreateEnvOutput<
  TServer extends SchemaShape | undefined,
  TClient extends SchemaShape | undefined,
> = Readonly<InferShapeOutput<MergeEnvShapes<TServer, TClient>>>;

export interface ResolvedCreateEnvOptions<
  TServer extends SchemaShape,
  TClient extends SchemaShape,
> {
  client: TClient;
  clientPrefix: string | undefined;
  emptyStringAsUndefined: boolean;
  isServer: boolean;
  onInvalidAccess: OnInvalidAccessHandler | undefined;
  runtime: RuntimeEnvInput;
  server: TServer;
  skipValidation: boolean;
}
