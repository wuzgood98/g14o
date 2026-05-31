/**
 * Core utility functions for `@g14o/utils`.
 *
 * Configuration helpers are re-exported from `./config`; shared types from `./types`.
 * See those modules for full documentation of `configureUtils`, `Result`, and pagination types.
 */

import type { Result } from "./types";

/**
 * Parses a string or number into an integer.
 *
 * @param value - Value to parse. Numbers are returned unchanged.
 * @param options - Parsing options.
 * @param options.radix - Radix passed to `Number.parseInt` when `value` is a string. Default `10`.
 * @returns The parsed integer.
 */
export function parseNumber(
  value: string | number,
  options: { radix?: number } = { radix: 10 }
): number {
  if (typeof value === "number") {
    return value;
  }
  return Number.parseInt(value, options.radix);
}

/**
 * Type guard: `true` when `value` is a non-null, non-array object.
 *
 * @param value - Value to test.
 * @returns Whether `value` is a plain object suitable for key iteration.
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    value !== undefined
  );
}

/**
 * Type guard: `true` when `value` is an array.
 *
 * @param value - Value to test.
 * @returns Whether `value` is an array.
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Formats a number as currency using the `en-GH` locale.
 *
 * @param amount - Numeric amount in major currency units (not pesewas).
 * @param currency - ISO 4217 currency code. Default `"GHS"`.
 * @returns Formatted currency string with zero fraction digits.
 */
export function formatCurrency(amount: number, currency = "GHS"): string {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Converts a partial record of query parameters into a deterministic URL query string.
 *
 * Keys are sorted alphabetically for stable output. Entries that are `null`, `undefined`,
 * empty strings, or empty arrays are omitted. Array values are joined with commas.
 *
 * @typeParam TParams - Shape of the input parameter record.
 * @param params - Partial query parameters to serialize.
 * @returns Query string without a leading `?` (e.g. `page=1&search=foo`).
 *
 * @example
 * ```ts
 * stringifyParams({ search: "john", page: 1, tags: ["a", "b"] });
 * // "page=1&search=john&tags=a,b"
 * ```
 */
export function stringifyParams<
  TParams extends Record<
    string,
    string | number | boolean | null | undefined | string[]
  > = Record<string, string>,
>(params: Partial<TParams>) {
  const stringParams: Record<string, string> = {};

  const sortedEntries = Object.entries(params).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  for (const [key, value] of sortedEntries) {
    if (value == null || value === "" || value === undefined) {
      continue;
    }

    if (isArray(value)) {
      if (value.length === 0) {
        continue;
      }
      stringParams[key] = value.join(",");
    } else {
      stringParams[key] = value.toString();
    }
  }

  return new URLSearchParams(stringParams).toString();
}

type FetcherSearchParams = Record<
  string,
  string | number | boolean | null | undefined | string[]
>;

type FetcherQueryOptions =
  | {
      /**
       * Pre-built query string.
       */
      stringifiedParams: string;
      /**
       * No query parameters.
       */
      searchParams?: never;
    }
  | {
      /**
       * Query parameters to serialize.
       */
      searchParams: FetcherSearchParams;
      /**
       * No pre-built query string.
       */
      stringifiedParams?: never;
    }
  | {
      /**
       * No pre-built query string.
       */
      stringifiedParams?: undefined;
      /**
       * No query parameters.
       */
      searchParams?: undefined;
    };

type FetcherBaseOptions = FetcherQueryOptions & {
  /**
   * Custom error message used when the response body has no `error` field. Default `"Something went wrong. Please try again later."`.
   */
  errorMessage?: string;
};

const DEFAULT_FETCHER_ERROR_MESSAGE =
  "Something went wrong. Please try again later.";

function resolveFetcherErrorMessage(body: unknown, fallback?: string): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as { error: unknown }).error === "string"
  ) {
    return (body as { error: string }).error;
  }
  return fallback ?? DEFAULT_FETCHER_ERROR_MESSAGE;
}

function buildFetcherQueryString(options?: FetcherBaseOptions): string {
  if (options?.stringifiedParams) {
    return `?${options.stringifiedParams}`;
  }
  if (options?.searchParams) {
    return `?${stringifyParams(options.searchParams)}`;
  }
  return "";
}

/**
 * Generic `fetch` wrapper that appends query params, parses JSON, and throws on non-OK responses by default.
 *
 * Pass either {@link stringifyParams `stringifiedParams`} **or** `searchParams`, not both.
 * When `throw` is `false`, returns a {@link Result} instead of throwing on HTTP errors.
 *
 * @typeParam TData - Expected JSON response shape.
 * @param url - Request URL without query string.
 * @param options - Optional fetch configuration.
 * @param options.errorMessage - Message used when the response body has no `error` field.
 * @param options.stringifiedParams - Pre-built query string (from {@link stringifyParams}).
 * @param options.searchParams - Object serialized via {@link stringifyParams}.
 * @param options.throw - When `true` (default), throws on non-OK responses. When `false`, returns {@link Result}.
 * @returns Parsed JSON body on success when `throw` is `true` (default).
 * @throws {Error} When `throw` is `true` and `response.ok` is false.
 *
 * @example
 * ```ts
 * const users = await fetcher<User[]>("/api/users", {
 *   searchParams: { page: 1, limit: 10 },
 * });
 * ```
 *
 * @example
 * ```ts
 * const result = await fetcher<User[]>("/api/users", { throw: false });
 * if (result.ok) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.error, result.status);
 * }
 * ```
 */
export async function fetcher<TData>(
  /**
   * Request URL.
   */
  url: string,
  options?: FetcherBaseOptions & {
    /**
     * When `true` (default), throws on non-OK responses. When `false`, returns {@link Result}.
     */
    throw?: true;
  }
): Promise<TData>;
export async function fetcher<TData>(
  /**
   * Request URL.
   */
  url: string,
  options: FetcherBaseOptions & {
    /**
     * When `false`, returns {@link Result} instead of throwing on non-OK responses.
     */
    throw: false;
  }
): Promise<Result<TData>>;
export async function fetcher<TData>(
  /**
   * Request URL.
   */
  url: string,
  options?: FetcherBaseOptions & {
    /**
     * When `true` (default), throws on non-OK responses. When `false`, returns {@link Result}.
     */
    throw?: boolean;
  }
): Promise<TData | Result<TData>> {
  if (options?.stringifiedParams && options?.searchParams) {
    throw new TypeError(
      "fetcher: pass either stringifiedParams or searchParams, not both"
    );
  }

  const shouldThrow = options?.throw !== false;

  try {
    const response = await fetch(`${url}${buildFetcherQueryString(options)}`);

    if (!response.ok) {
      const body = await response.json();
      const message = resolveFetcherErrorMessage(body, options?.errorMessage);
      if (shouldThrow) {
        throw new Error(message);
      }
      return { ok: false, error: new Error(message), status: response.status };
    }

    const data = (await response.json()) as TData;
    if (shouldThrow) {
      return data;
    }
    return { ok: true, data };
  } catch (error) {
    if (shouldThrow) {
      throw error;
    }
    const resolvedError =
      error instanceof Error ? error : new Error(String(error));
    return { ok: false, error: resolvedError, status: 0 };
  }
}

/**
 * Generic JSON mutation helper (`POST` by default) with error handling matching {@link fetcher}.
 *
 * @typeParam TData - Expected JSON response shape.
 * @param url - Request URL.
 * @param options - Request options.
 * @param options.data - JSON-serializable body. Omitted when undefined.
 * @param options.errorMessage - Message used when the response body has no `error` field.
 * @param options.method - HTTP method. Default `"POST"`.
 * @returns Parsed JSON body on success.
 * @throws {Error} When `response.ok` is false.
 */
export async function mutationFn<TData>(
  /**
   * Request URL.
   */
  url: string,
  /**
   * Request options.
   */
  options: {
    /**
     * JSON-serializable body. Omitted when undefined.
     */
    data?: Record<string, unknown>;
    /**
     * Custom error message used when the response body has no `error` field. Default `"Request failed"`.
     */
    errorMessage?: string;
    /**
     * HTTP method. Default `"POST"`.
     */
    method?: "POST" | "PUT" | "PATCH" | "DELETE";
  }
): Promise<TData> {
  const method = options?.method || "POST";
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: options?.data ? JSON.stringify(options.data) : undefined,
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || options?.errorMessage || "Request failed");
  }

  return await res.json();
}

/**
 * Formats an integer amount in **pesewas** as Ghana Cedis (GHS).
 *
 * @param pesewas - Amount in pesewas (100 pesewas = 1 GHS).
 * @returns Formatted currency string (e.g. `129900` → `₵1,299.00`).
 *
 * @example
 * ```ts
 * formatGhsFromPesewas(129900); // "₵1,299"
 * ```
 */
export function formatGhsFromPesewas(pesewas: number): string {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(pesewas / 100);
}

/**
 * Formats an array of strings as a human-readable list using `Intl.ListFormat`.
 *
 * @param list - Strings to join (e.g. `["apples", "oranges", "pears"]`).
 * @param options - `Intl.ListFormat` options.
 * @param options.style - List style: `"long"` | `"short"` | `"narrow"`. Default `"long"`.
 * @param options.type - Join type: `"conjunction"` | `"disjunction"` | `"unit"`. Default `"conjunction"`.
 * @returns Formatted list (e.g. `"apples, oranges, and pears"`).
 */
export function formatStringList(
  /**
   * List of strings to join.
   * @example
   * ```ts
   * formatStringList(["apples", "oranges", "pears"]); // "apples, oranges, and pears"
   * ```
   */
  list: string[],
  /**
   * `Intl.ListFormat` options.
   * @example
   * ```ts
   * formatStringList(["apples", "oranges", "pears"], { style: "long", type: "conjunction" }); // "apples, oranges, and pears"
   * formatStringList(["apples", "oranges", "pears"], { style: "short" }); // "apples, oranges, or pears"
   * formatStringList(["apples", "oranges", "pears"], { style: "narrow" }); // "apples, oranges, pears"
   * ```
   */
  options?: {
    /**
     * List style. Default `"long"`.
     * @example
     * ```ts
     * formatStringList(["apples", "oranges", "pears"], { style: "long" }); // "apples, oranges, and pears"
     * ```
     */
    style?: "long" | "short" | "narrow";
    /**
     * Join type. Default `"conjunction"`.
     * @example
     * ```ts
     * formatStringList(["apples", "oranges", "pears"], { type: "conjunction" }); // "apples, oranges, and pears"
     * ```
     */
    type?: "conjunction" | "disjunction" | "unit";
  }
): string {
  return new Intl.ListFormat("en-US", {
    style: options?.style ?? "long",
    type: options?.type ?? "conjunction",
  }).format(list);
}

export type {
  ConfigureUtilsOptions,
  Logger,
  RedisConfig,
  RedisCredentials,
} from "./config";
/** biome-ignore lint/performance/noBarrelFile: intentional root re-export of config alongside utilities */
export {
  configureUtils,
  createRedisClient,
  getEnvName,
  getLogger,
  getRedis,
  isInMemoryBackend,
  isInMemoryEnv,
  noopLogger,
  resolveEnvName,
  resolveRedisClient,
} from "./config";
export * from "./types";
