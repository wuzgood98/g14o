/** Standard Schema V1. @see https://standardschema.dev */

// biome-ignore lint/style/useConsistentTypeDefinitions: mirrors Standard Schema spec shape
export type StandardSchemaV1<Input = unknown, Output = Input> = {
  readonly "~standard": StandardSchemaV1.Props<Input, Output>;
};

// biome-ignore lint/style/noNamespace: grouped Standard Schema result types
export namespace StandardSchemaV1 {
  export interface Props<Input = unknown, Output = Input> {
    readonly types?: {
      readonly input: Input;
      readonly output: Output;
    };
    readonly validate: (
      value: unknown
    ) => Result<Output> | Promise<Result<Output>>;
    readonly vendor: string;
    readonly version: 1;
  }

  export type Result<Output> = SuccessResult<Output> | FailureResult;

  export interface SuccessResult<Output> {
    readonly issues?: undefined;
    readonly value: Output;
  }

  export interface FailureResult {
    readonly issues: readonly Issue[];
  }

  export interface Issue {
    readonly message: string;
    readonly path?: readonly (PropertyKey | PathSegment)[] | undefined;
  }

  export interface PathSegment {
    readonly key: PropertyKey;
  }
}

/** @internal */
export type SchemaShape = Record<string, StandardSchemaV1>;

export type InferSchemaOutput<TSchema extends StandardSchemaV1> =
  TSchema extends StandardSchemaV1<unknown, infer TOutput> ? TOutput : never;

/** @internal */
export type EventsFromSchema<TSchema extends SchemaShape> = {
  [K in keyof TSchema]: InferSchemaOutput<TSchema[K]>;
};

/** Nested schema input — groups map to dotted event names. */
// biome-ignore lint/style/useConsistentTypeDefinitions: recursive index map
export type NestedSchemaShape = {
  readonly [key: string]: NestedSchemaShape | StandardSchemaV1;
};

type MergeUnion<T> = {
  [K in T extends unknown ? keyof T : never]: T extends Record<K, infer V>
    ? V
    : never;
};

type FlattenSchemaEventsLeaf<
  K extends string,
  Prefix extends string,
  TSchema extends StandardSchemaV1,
> = {
  [P in Prefix extends "" ? K : `${Prefix}.${K}`]: InferSchemaOutput<TSchema>;
};

type FlattenSchemaEventsLevel<
  T extends NestedSchemaShape,
  Prefix extends string,
  Depth extends readonly unknown[],
> = Depth["length"] extends 8
  ? Record<string, never>
  : MergeUnion<
      {
        [K in keyof T & string]: T[K] extends StandardSchemaV1
          ? FlattenSchemaEventsLeaf<K, Prefix, T[K]>
          : T[K] extends NestedSchemaShape
            ? FlattenSchemaEvents<
                T[K],
                Prefix extends "" ? K : `${Prefix}.${K}`,
                [...Depth, unknown]
              >
            : never;
      }[keyof T & string]
    >;

export type FlattenSchemaEvents<
  T extends NestedSchemaShape,
  Prefix extends string = "",
  Depth extends readonly unknown[] = [],
> = FlattenSchemaEventsLevel<T, Prefix, Depth>;

/** Resolve event map from either flat or grouped schema input. */
export type EventsFromSchemaInput<T extends NestedSchemaShape> =
  FlattenSchemaEvents<T> extends Record<string, unknown>
    ? FlattenSchemaEvents<T>
    : Record<string, never>;
