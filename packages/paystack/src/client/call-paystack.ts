import type { z } from "zod";

import { PaystackError } from "./errors";
import type { HttpMethod, PaystackHttpClient, RequestOptions } from "./http";
import { paystackResponseEnvelopeSchema } from "./responses";

export interface CallPaystackOptions<T> {
  body?: Record<string, unknown> | undefined;
  bodySchema?: z.ZodType | undefined;
  dataSchema: z.ZodType<T>;
  method: HttpMethod;
  path: string;
  query?: RequestOptions["query"];
  /**
   * When true, return the envelope `message` instead of parsed `data`.
   * Used for Paystack endpoints that succeed with status + message only.
   */
  returnMessage?: boolean | undefined;
}

const asBody = (value: object): Record<string, unknown> =>
  value as Record<string, unknown>;

function parseResponseEnvelope<T>(
  schema: z.ZodType<T>,
  response: unknown
): { data: T; message: string } {
  const envelope = paystackResponseEnvelopeSchema(schema).safeParse(response);

  if (!envelope.success) {
    throw new PaystackError("Invalid Paystack API response shape", {
      code: "PAYSTACK_VALIDATION_ERROR",
      cause: envelope.error,
    });
  }

  if (!envelope.data.status) {
    throw new PaystackError(envelope.data.message, {
      code: "PAYSTACK_API_ERROR",
      paystackMessage: envelope.data.message,
    });
  }

  return {
    data: envelope.data.data,
    message: envelope.data.message,
  };
}

/**
 * Deep Paystack API call: outbound validation, transport, response envelope.
 */
export async function callPaystack<T>(
  http: PaystackHttpClient,
  options: CallPaystackOptions<T> & { returnMessage: true }
): Promise<string>;
export async function callPaystack<T>(
  http: PaystackHttpClient,
  options: CallPaystackOptions<T> & { returnMessage?: false | undefined }
): Promise<T>;
export async function callPaystack<T>(
  http: PaystackHttpClient,
  options: CallPaystackOptions<T>
): Promise<T | string> {
  const body = options.body;

  if (body !== undefined && options.bodySchema) {
    const parsedBody = options.bodySchema.safeParse(body);
    if (!parsedBody.success) {
      throw new PaystackError("Invalid payload", {
        code: "PAYSTACK_VALIDATION_ERROR",
        cause: parsedBody.error,
        statusCode: 400,
      });
    }
  }

  const response = await http.request<unknown>({
    method: options.method,
    path: options.path,
    body,
    query: options.query,
  });

  const envelope = parseResponseEnvelope(options.dataSchema, response);
  return options.returnMessage ? envelope.message : envelope.data;
}

export { asBody };
