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

const isRetryableStatus = (status: number): boolean =>
  status === 429 || status >= 500;

type QueryParams = Record<string, string | number | boolean | null | undefined>;

type HttpAttemptResult<T> =
  | { status: "success"; data: T }
  | { status: "retry"; delayMs: number };

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
const getBackoffDelayMs = (
  attempt: number,
  initialRetryDelayMs: number
): number =>
  initialRetryDelayMs * 2 ** attempt + Math.floor(Math.random() * 100);

const getRateLimitDelayMs = (
  retryAfterHeader: string | null,
  attempt: number,
  initialRetryDelayMs: number
): number =>
  parseRetryAfter(retryAfterHeader) ??
  getBackoffDelayMs(attempt, initialRetryDelayMs);

const isAbortError = (error: unknown): boolean =>
  error instanceof Error &&
  (error.name === "AbortError" || error.message.includes("aborted"));

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

  constructor(options: PaystackHttpOptions) {
    this.#secretKey = options.secretKey;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.initialRetryDelayMs =
      options.initialRetryDelayMs ?? DEFAULT_INITIAL_RETRY_DELAY_MS;
  }

  async request<T>(options: RequestOptions): Promise<T> {
    const url = buildRequestUrl(this.baseUrl, options.path, options.query);
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
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
