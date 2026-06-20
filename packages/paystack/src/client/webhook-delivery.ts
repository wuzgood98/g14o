import type { PaystackWebhookEvent } from "../webhook-events";
import { PaystackError } from "./errors";

/** Persistence port for webhook deduplication and delivery status tracking. */
export interface WebhookDeliveryStore {
  /**
   * Marks a webhook delivery as failed.
   */
  markFailed: (eventId: string, errorMessage: string) => Promise<void>;
  /**
   * Marks a webhook delivery as processed.
   */
  markProcessed: (eventId: string) => Promise<void>;
  /**
   * Persists a webhook delivery.
   */
  persist: (input: {
    eventId: string;
    payload: string;
    type: string;
  }) => Promise<void>;
  /**
   * Checks if a webhook delivery should be processed.
   */
  shouldProcess: (eventId: string) => Promise<boolean>;
}

/**
 * Result of processing a Paystack webhook delivery.
 */
export type ProcessWebhookDeliveryResult =
  | { duplicate: true }
  | { duplicate: false; event: PaystackWebhookEvent };

/**
 * Options for processing a Paystack webhook delivery.
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

/**
 * Creates a stable identifier for deduplicating webhook deliveries.
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
 * Processes a verified Paystack webhook delivery with optional deduplication.
 */
export async function processWebhookDelivery(
  options: ProcessWebhookDeliveryOptions
): Promise<ProcessWebhookDeliveryResult> {
  const { event, rawBody, handler, store, disablePersistence } = options;
  const eventId = createWebhookEventId(event);

  if (!disablePersistence && store) {
    const shouldProcess = await store.shouldProcess(eventId);

    if (!shouldProcess) {
      return { duplicate: true };
    }

    await store.persist({
      eventId,
      type: event.event,
      payload: rawBody,
    });
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

    throw new PaystackError("Webhook processing failed", {
      code: "WEBHOOK_PROCESSING_ERROR",
      statusCode: 400,
      cause: error,
    });
  }

  return { duplicate: false, event };
}
