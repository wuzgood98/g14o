/**
 * Discriminated union for success/failure results returned by server functions,
 * especially those wrapped with `withCache` from `@g14o/cache`.
 *
 * @typeParam T - Type of the success payload in `data`.
 * @typeParam E - Error type when `ok` is `false`. Defaults to `Error`.
 *
 * @example
 * ```ts
 * const result: Result<User[], Error> = await getUsers();
 * if (result.ok) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.error, result.status);
 * }
 * ```
 */
export type Result<T, E extends Error = Error> =
  | { ok: true; data: T }
  | { ok: false; error: E; status: number };

/**
 * Pagination metadata attached to offset/page-based list responses.
 */
export interface PaginationMeta {
  /** Whether another page exists after the current page. */
  hasNextPage: boolean;
  /** Whether a page exists before the current page. */
  hasPreviousPage: boolean;
  /** Maximum number of items returned per page. */
  limit: number;
  /** Current page number (1-based). */
  page: number;
  /** Total number of items across all pages. */
  total: number;
  /** Total number of pages given `limit` and `total`. */
  totalPages: number;
}

/**
 * Paginated list payload with items and {@link PaginationMeta}.
 *
 * @typeParam T - Element type of each item in `data`.
 */
export interface PaginatedResponse<T> {
  /** Items for the current page. */
  data: T[];
  /** Pagination metadata for the current page. */
  meta: PaginationMeta;
}

/**
 * {@link Result} wrapping a {@link PaginatedResponse}.
 *
 * @typeParam T - Element type of each item in the paginated `data` array.
 */
export type PaginatedResult<T> = Result<PaginatedResponse<T>, Error>;

/**
 * Query parameters for offset/page-based pagination.
 */
export interface PaginationOptions {
  /** Number of items per page. */
  limit?: number;
  /** Zero-based offset from the start of the collection (alternative to `page`). */
  offset?: number;
  /** Page number (1-based). */
  page?: number;
}

/**
 * Metadata for cursor-based (keyset) pagination.
 */
export interface CursorPaginationMeta {
  /** Whether more items exist after this cursor. */
  hasNextPage: boolean;
  /**
   * Opaque cursor for the next page, or `null` when there is no next page.
   * Pass this value to subsequent requests to continue listing.
   */
  nextCursor: string | null;
}

/**
 * Cursor-paginated list payload with items and {@link CursorPaginationMeta}.
 *
 * @typeParam T - Element type of each item in `data`.
 */
export interface CursorPaginationResponse<T> {
  /** Items for the current cursor window. */
  data: T[];
  /** Cursor pagination metadata. */
  meta: CursorPaginationMeta;
}

/**
 * {@link Result} wrapping a {@link CursorPaginationResponse}.
 *
 * @typeParam T - Element type of each item in the cursor-paginated `data` array.
 */
export type CursorPaginationResult<T> = Result<
  CursorPaginationResponse<T>,
  Error
>;

/**
 * Logger interface used by `@g14o/cache` and `@g14o/ratelimit-nextjs`.
 */
export interface Logger {
  error: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
}

/** Supported environment names for cache and rate-limit factories. */
export type Environment = "development" | "test" | "production";

/**
 * Options for {@link isInMemoryEnv} and factory clients (`createCache`, `createRateLimit`).
 */
export interface InMemoryEnvOptions {
  /**
   * Environment name override. When omitted, falls back to `process.env.NODE_ENV`
   * or `"development"`.
   *
   * Values `"development"` and `"test"` use in-memory cache and rate limiting.
   */
  env?: Environment;
  /**
   * When `true` (default), use in-memory cache/rate-limit backends during Next.js
   * `phase-production-build` and `phase-export`.
   *
   * @default true
   */
  inMemoryDuringNextBuild?: boolean;
}

const noop = (): void => {
  /* silent default logger */
};

/** Silent logger used when no custom logger is configured. */
export const noopLogger: Logger = {
  info: noop,
  warn: noop,
  error: noop,
};
