/** @see https://standardschema.dev */

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
