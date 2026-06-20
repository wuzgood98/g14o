import { PaystackError } from "./errors";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface PaystackHttpOptions {
  /**
   * The base URL of the Paystack API.
   * @default "https://api.paystack.co"
   */
  baseUrl?: string;
  /**
   * The fetch implementation to use.
   * @default globalThis.fetch
   */
  fetch?: typeof fetch;
  /**
   * The initial retry delay in milliseconds.
   * @default 500
   */
  initialRetryDelayMs?: number;
  /**
   * The maximum number of retries.
   * @default 3
   */
  maxRetries?: number;
  /**
   * The function to call when you want to validate the payload before sending it to Paystack.
   * @param payload - The payload to validate.
   * @returns The void or a promise.
   */
  onPayloadValidationBeforeSending?: (
    payload: Record<string, unknown>
  ) => Promise<void> | void;
  /**
   * The secret key to use for authentication.
   * @required
   */
  secretKey: string;
  /**
   * The timeout in milliseconds.
   * @default 30000
   */
  timeoutMs?: number;
}

export interface RequestOptions {
  /**
   * The body of the request.
   * @default undefined
   */
  body?: Record<string, unknown> | undefined;
  /**
   * The method of the request.
   * @required
   */
  method: HttpMethod;
  /**
   * The function to call when you want to validate the payload before sending it to Paystack.
   * @param payload - The payload to validate.
   * @returns The void or a promise.
   */
  onPayloadValidationBeforeSending?: (
    payload: Record<string, unknown>
  ) => Promise<void> | void;
  /**
   * The path of the request.
   * @required
   */
  path: string;
  /**
   * The query parameters of the request.
   * @default undefined
   */
  query?:
    | Record<string, string | number | boolean | null | undefined>
    | undefined;
}

const DEFAULT_BASE_URL = "https://api.paystack.co";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_RETRY_DELAY_MS = 500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
 *
 * @internal
 */
function stringifyParams<
  TParams extends Record<
    string,
    string | number | boolean | null | undefined | string[]
  > = Record<string, string>,
>(params: Partial<TParams>): string {
  const stringParams: Record<string, string> = {};

  const sortedEntries = Object.entries(params).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  for (const [key, value] of sortedEntries) {
    if (value == null || value === "" || value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
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

/**
 * Parses the Retry-After header value into a number of milliseconds.
 * @param header - The Retry-After header value.
 * @returns The number of milliseconds to wait before retrying the request.
 * @internal
 */
const parseRetryAfter = (header: string | null): number | undefined => {
  if (!header) {
    return;
  }

  const seconds = Number.parseInt(header, 10);
  if (!Number.isNaN(seconds)) {
    return seconds * 1000;
  }

  const date = Date.parse(header);
  if (!Number.isNaN(date)) {
    return Math.max(0, date - Date.now());
  }

  return;
};

/**
 * Checks if a status code is retryable.
 * @param status - The status code to check.
 * @returns `true` if the status code is retryable, `false` otherwise.
 * @internal
 */
const isRetryableStatus = (status: number): boolean =>
  status === 429 || status >= 500;

type QueryParams = Record<string, string | number | boolean | null | undefined>;

type HttpAttemptResult<T> =
  | { status: "success"; data: T }
  | { status: "retry"; delayMs: number };

/**
 * Builds a request URL with query parameters.
 * @param baseUrl - The base URL of the Paystack API.
 * @param path - The path of the request.
 * @param query - The query parameters to add to the URL.
 * @returns The request URL.
 * @internal
 */
const buildRequestUrl = (
  baseUrl: string,
  path: string,
  query?: QueryParams
): URL => {
  const url = new URL(path, baseUrl);

  if (query) {
    url.search = stringifyParams(query);
  }

  return url;
};

/**
 * Parses the response text into a JSON object.
 * @param text - The response text.
 * @param statusCode - The status code of the response.
 * @returns The JSON object.
 * @internal
 */
const parseResponseJson = (text: string, statusCode: number): unknown => {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new PaystackError("Invalid JSON response from Paystack", {
      code: "PAYSTACK_API_ERROR",
      statusCode,
    });
  }
};

/**
 * Gets the error message from the JSON response.
 * @param json - The JSON response.
 * @param status - The status code of the response.
 * @returns The error message.
 * @internal
 */
const getPaystackErrorMessage = (json: unknown, status: number): string => {
  if (
    typeof json === "object" &&
    json !== null &&
    "message" in json &&
    typeof json.message === "string"
  ) {
    return json.message;
  }

  return `Paystack request failed with status ${status}`;
};

/**
 * Gets the backoff delay in milliseconds.
 * @param attempt - The attempt number.
 * @param initialRetryDelayMs - The initial retry delay in milliseconds.
 * @returns The backoff delay in milliseconds.
 * @internal
 */
const getBackoffDelayMs = (
  attempt: number,
  initialRetryDelayMs: number
): number =>
  initialRetryDelayMs * 2 ** attempt + Math.floor(Math.random() * 100);

/**
 * Gets the rate limit delay in milliseconds.
 * @param retryAfterHeader - The Retry-After header value.
 * @param attempt - The attempt number.
 * @param initialRetryDelayMs - The initial retry delay in milliseconds.
 * @returns The rate limit delay in milliseconds.
 * @internal
 */
const getRateLimitDelayMs = (
  retryAfterHeader: string | null,
  attempt: number,
  initialRetryDelayMs: number
): number =>
  parseRetryAfter(retryAfterHeader) ??
  getBackoffDelayMs(attempt, initialRetryDelayMs);

/**
 * Checks if an error is an abort error.
 * @param error - The error to check.
 * @returns `true` if the error is an abort error, `false` otherwise.
 * @internal
 */
const isAbortError = (error: unknown): boolean =>
  error instanceof Error &&
  (error.name === "AbortError" || error.message.includes("aborted"));

/**
 * Processes the HTTP response.
 * @param response - The HTTP response.
 * @param json - The JSON response.
 * @param attempt - The attempt number.
 * @param maxRetries - The maximum number of retries.
 * @param retryAfterHeader - The Retry-After header value.
 * @param initialRetryDelayMs - The initial retry delay in milliseconds.
 * @returns The HTTP attempt result.
 */
const processHttpResponse = <T>(
  response: Response,
  json: unknown,
  attempt: number,
  maxRetries: number,
  retryAfterHeader: string | null,
  initialRetryDelayMs: number
): HttpAttemptResult<T> => {
  if (response.ok) {
    return { status: "success", data: json as T };
  }

  const message = getPaystackErrorMessage(json, response.status);

  if (isRetryableStatus(response.status) && attempt < maxRetries) {
    return {
      status: "retry",
      delayMs: getRateLimitDelayMs(
        retryAfterHeader,
        attempt,
        initialRetryDelayMs
      ),
    };
  }

  throw new PaystackError(message, {
    code:
      response.status === 429 ? "PAYSTACK_RATE_LIMIT" : "PAYSTACK_API_ERROR",
    statusCode: response.status,
    paystackMessage: message,
  });
};

export class PaystackHttpClient {
  readonly #secretKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly initialRetryDelayMs: number;
  private readonly onPayloadValidationBeforeSending: (
    payload: Record<string, unknown>
  ) => Promise<void> | void;

  constructor(options: PaystackHttpOptions) {
    this.#secretKey = options.secretKey;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.initialRetryDelayMs =
      options.initialRetryDelayMs ?? DEFAULT_INITIAL_RETRY_DELAY_MS;
    this.onPayloadValidationBeforeSending =
      options.onPayloadValidationBeforeSending ?? (() => undefined);
  }

  async request<T>(options: RequestOptions): Promise<T> {
    const url = buildRequestUrl(this.baseUrl, options.path, options.query);
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const validatePayload =
          options.onPayloadValidationBeforeSending ??
          this.onPayloadValidationBeforeSending;
        await validatePayload?.(options.body ?? {});

        const response = await this.fetchImpl(url, {
          method: options.method,
          headers: {
            Authorization: `Bearer ${this.#secretKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
        });

        const json = parseResponseJson(await response.text(), response.status);
        const result = processHttpResponse<T>(
          response,
          json,
          attempt,
          this.maxRetries,
          response.headers.get("Retry-After"),
          this.initialRetryDelayMs
        );

        if (result.status === "success") {
          return result.data;
        }

        await sleep(result.delayMs);
      } catch (error) {
        lastError = error;

        if (error instanceof PaystackError) {
          throw error;
        }

        if (isAbortError(error)) {
          throw new PaystackError("Paystack request timed out", {
            code: "PAYSTACK_TIMEOUT",
            cause: error,
          });
        }

        if (attempt < this.maxRetries) {
          await sleep(getBackoffDelayMs(attempt, this.initialRetryDelayMs));
          continue;
        }

        throw new PaystackError("Network error communicating with Paystack", {
          code: "PAYSTACK_NETWORK_ERROR",
          cause: error,
        });
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new PaystackError("Paystack request failed after retries", {
      code: "PAYSTACK_NETWORK_ERROR",
      cause: lastError,
    });
  }
}
