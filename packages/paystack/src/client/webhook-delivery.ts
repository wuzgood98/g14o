import { createHmac, timingSafeEqual } from "node:crypto";
import {
  type PaystackWebhookEvent,
  parsePaystackWebhookEvent,
} from "../webhook-events";
import { WebhookDeliveryError, WebhookVerificationError } from "./errors";

/** Persistence port for webhook deduplication and delivery status tracking. */
export interface WebhookDeliveryStore {
  /**
   * Atomically claims a webhook delivery for processing.
   * Returns `duplicate` when the event was already processed or is in-flight.
   */
  claim: (input: {
    eventId: string;
    payload: string;
    type: string;
  }) => Promise<"claimed" | "duplicate">;
  /**
   * Marks a webhook delivery as failed.
   */
  markFailed: (eventId: string, errorMessage: string) => Promise<void>;
  /**
   * Marks a webhook delivery as processed.
   */
  markProcessed: (eventId: string) => Promise<void>;
}

/**
 * Result of processing a Paystack webhook delivery.
 */
export type ProcessWebhookDeliveryResult =
  | { duplicate: true }
  | { duplicate: false; event: PaystackWebhookEvent };

/**
 * Options for processing a pre-verified Paystack webhook delivery.
 */
export interface ProcessWebhookDeliveryOptions {
  /**
   * Whether to disable persistence of the webhook delivery.
   * @default false
   */
  disablePersistence?: boolean | undefined;
  /**
   * The webhook event to process.
   */
  event: PaystackWebhookEvent;
  /**
   * The handler to process the webhook event.
   */
  handler: (event: PaystackWebhookEvent) => Promise<void>;
  /**
   * The raw body of the webhook event.
   */
  rawBody: string;
  /**
   * The store to persist the webhook event.
   * @default undefined
   */
  store?: WebhookDeliveryStore | undefined;
}

/**
 * Options for processing a Paystack webhook delivery request.
 */
export interface ProcessWebhookDeliveryRequestOptions {
  /**
   * Whether to disable persistence of the webhook delivery.
   * @default false
   */
  disablePersistence?: boolean | undefined;
  /**
   * The handler to process the webhook event.
   */
  handler: (event: PaystackWebhookEvent) => Promise<void>;
  /**
   * The store to persist the webhook event.
   * @default undefined
   */
  store?: WebhookDeliveryStore | undefined;
}

/** Dependencies for Request-first webhook delivery. */
export interface ProcessWebhookDeliveryDeps {
  secretKey: string;
}

function isPreParsedDeliveryOptions(
  value: unknown
): value is ProcessWebhookDeliveryOptions {
  return (
    typeof value === "object" &&
    value !== null &&
    "event" in value &&
    "rawBody" in value &&
    "handler" in value
  );
}

/**
 * Verify `x-paystack-signature` for a raw webhook body.
 * Throws {@link WebhookVerificationError} on failure.
 */
export function verifyPaystackWebhookSignature(
  rawBody: string,
  signature: string | null | undefined,
  secretKey: string
): void {
  if (!signature) {
    throw new WebhookVerificationError(
      "Missing x-paystack-signature header",
      "WEBHOOK_MISSING_SIGNATURE"
    );
  }

  const hash = createHmac("sha512", secretKey).update(rawBody).digest("hex");
  const signatureBuffer = Buffer.from(signature);
  const hashBuffer = Buffer.from(hash);

  if (
    signatureBuffer.length !== hashBuffer.length ||
    !timingSafeEqual(signatureBuffer, hashBuffer)
  ) {
    throw new WebhookVerificationError(
      "Invalid webhook signature",
      "WEBHOOK_INVALID_SIGNATURE"
    );
  }
}

/**
 * Verify a Paystack webhook request and return the raw body.
 * Throws {@link WebhookVerificationError} on failure.
 */
export async function verifyWebhookRequest(
  request: Request | null | undefined,
  secretKey: string
): Promise<string> {
  if (!request?.body) {
    throw new WebhookVerificationError(
      "Request body is required",
      "WEBHOOK_INVALID_PAYLOAD"
    );
  }

  const signature = request.headers.get("x-paystack-signature");
  if (!signature) {
    throw new WebhookVerificationError(
      "Missing x-paystack-signature header",
      "WEBHOOK_MISSING_SIGNATURE"
    );
  }

  const rawBody = await request.text();
  verifyPaystackWebhookSignature(rawBody, signature, secretKey);
  return rawBody;
}

/**
 * Parse a verified Paystack webhook raw body.
 * Throws {@link WebhookDeliveryError} on failure.
 */
export function parseWebhookPayload(rawBody: string): PaystackWebhookEvent {
  let parsedBody: unknown;

  try {
    parsedBody = JSON.parse(rawBody);
  } catch (error) {
    throw new WebhookDeliveryError("Invalid webhook payload", {
      code: "WEBHOOK_INVALID_PAYLOAD",
      statusCode: 400,
      cause: error,
    });
  }

  try {
    return parsePaystackWebhookEvent(parsedBody);
  } catch (error) {
    throw new WebhookDeliveryError("Invalid webhook payload", {
      code: "WEBHOOK_INVALID_PAYLOAD",
      statusCode: 400,
      cause: error,
    });
  }
}

/**
 * Verify and parse a Paystack webhook request.
 * Advanced escape — prefer {@link processWebhookDelivery} for production routes.
 */
export async function processWebhookRequest(
  request: Request | null | undefined,
  secretKey: string
): Promise<PaystackWebhookEvent> {
  const rawBody = await verifyWebhookRequest(request, secretKey);
  return parseWebhookPayload(rawBody);
}

/**
 * Creates a stable identifier for deduplicating webhook deliveries.
 * Advanced escape — identity is owned by Webhook Delivery.
 */
export function createWebhookEventId(event: PaystackWebhookEvent): string {
  const { event: eventType, data } = event;

  if (Array.isArray(data)) {
    return `${eventType}:${JSON.stringify(data)}`;
  }

  const reference =
    ("reference" in data &&
      typeof data.reference === "string" &&
      data.reference) ||
    ("subscription_code" in data &&
      typeof data.subscription_code === "string" &&
      data.subscription_code) ||
    ("id" in data && typeof data.id === "number" && String(data.id)) ||
    ("id" in data && typeof data.id === "string" && data.id) ||
    JSON.stringify(data);

  return `${eventType}:${reference}`;
}

/**
 * Processes a pre-verified Paystack webhook delivery with optional deduplication.
 * Advanced escape when verification/parsing happens elsewhere.
 */
export async function processVerifiedWebhookDelivery(
  options: ProcessWebhookDeliveryOptions
): Promise<ProcessWebhookDeliveryResult> {
  const { event, rawBody, handler, store, disablePersistence } = options;
  const eventId = createWebhookEventId(event);

  if (!disablePersistence && store) {
    const claimResult = await store.claim({
      eventId,
      type: event.event,
      payload: rawBody,
    });

    if (claimResult === "duplicate") {
      return { duplicate: true };
    }
  }

  try {
    await handler(event);

    if (!disablePersistence && store) {
      await store.markProcessed(eventId);
    }
  } catch (error) {
    if (!disablePersistence && store) {
      await store.markFailed(
        eventId,
        error instanceof Error ? error.message : "Unknown webhook error"
      );
    }

    throw new WebhookDeliveryError("Webhook processing failed", {
      code: "WEBHOOK_PROCESSING_ERROR",
      statusCode: 400,
      cause: error,
    });
  }

  return { duplicate: false, event };
}

/**
 * Request-first webhook delivery: verify, parse, and process with optional deduplication.
 */
export async function processWebhookDeliveryFromRequest(
  request: Request | null | undefined,
  options: ProcessWebhookDeliveryRequestOptions,
  deps: ProcessWebhookDeliveryDeps
): Promise<ProcessWebhookDeliveryResult> {
  const rawBody = await verifyWebhookRequest(request, deps.secretKey);
  const event = parseWebhookPayload(rawBody);
  return processVerifiedWebhookDelivery({ event, rawBody, ...options });
}

/**
 * Process a Paystack webhook delivery.
 *
 * - Request-first (primary): `processWebhookDelivery(request, options, { secretKey })`
 * - Pre-verified (advanced): `processWebhookDelivery({ event, rawBody, handler, ... })`
 */
export async function processWebhookDelivery(
  request: Request | null | undefined,
  options: ProcessWebhookDeliveryRequestOptions,
  deps: ProcessWebhookDeliveryDeps
): Promise<ProcessWebhookDeliveryResult>;
export async function processWebhookDelivery(
  options: ProcessWebhookDeliveryOptions
): Promise<ProcessWebhookDeliveryResult>;
export function processWebhookDelivery(
  requestOrOptions: Request | null | undefined | ProcessWebhookDeliveryOptions,
  options?: ProcessWebhookDeliveryRequestOptions,
  deps?: ProcessWebhookDeliveryDeps
): Promise<ProcessWebhookDeliveryResult> {
  if (isPreParsedDeliveryOptions(requestOrOptions)) {
    return processVerifiedWebhookDelivery(requestOrOptions);
  }

  if (options === undefined) {
    throw new WebhookDeliveryError(
      "Request-first webhook delivery requires options and secretKey deps",
      { code: "WEBHOOK_PROCESSING_ERROR", statusCode: 400 }
    );
  }

  if (deps === undefined) {
    throw new WebhookDeliveryError(
      "Request-first webhook delivery requires options and secretKey deps",
      { code: "WEBHOOK_PROCESSING_ERROR", statusCode: 400 }
    );
  }

  return processWebhookDeliveryFromRequest(requestOrOptions, options, deps);
}
