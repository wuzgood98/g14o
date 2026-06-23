import type { PaystackSubscription } from "@g14o/paystack";
import { parseSafeMetadata } from "@g14o/paystack";
import { PAYSTACK_ERROR_CODES } from "./error-codes";
import type {
  DbPaystackPayment,
  DbPaystackSubscription,
  DbPaystackWebhookEvent,
  NormalizedPaymentStatus,
  NormalizedSubscriptionStatus,
  PaystackPaymentRecord,
  PaystackPluginOptions,
  PluginContext,
} from "./types";

/**
 * Converts a record to a Paystack subscription record.
 * @internal
 */
export function asDbSubscription(record: unknown): DbPaystackSubscription {
  return record as DbPaystackSubscription;
}

/**
 * Converts a record to a Paystack webhook event record.
 * @internal
 */
export function asDbWebhookEvent(record: unknown): DbPaystackWebhookEvent {
  return record as DbPaystackWebhookEvent;
}

/**
 * Converts a record to a Paystack payment record.
 * @internal
 */
export function asDbPayment(record: unknown): DbPaystackPayment {
  return record as DbPaystackPayment;
}

/**
 * Serializes metadata to a JSON string.
 * @internal
 */
export function serializeMetadata(
  metadata: Record<string, unknown> | undefined
): string | undefined {
  if (!metadata) {
    return;
  }

  return JSON.stringify(metadata);
}

/**
 * Parses metadata from a JSON string.
 * @internal
 */
export function parseMetadata(
  metadata: string | null | undefined
): Record<string, unknown> | undefined {
  return parseSafeMetadata(metadata);
}

/**
 * Generates a reference for a Paystack subscription.
 * @internal
 */
export function generateReference(prefix = "g14o"): string {
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  return `${prefix}_${random}`;
}

/**
 * Normalizes a plan name to lowercase and trimmed.
 * @internal
 */
export function normalizePlanName(name: string): string {
  return name.trim().toLowerCase();
}

const splitNameRegex = /\s+/;
/**
 * Splits a user name into first and last names.
 * @internal
 */
export function splitUserName(name: string | null | undefined): {
  first_name?: string;
  last_name?: string;
} {
  if (!name?.trim()) {
    return {};
  }

  const parts = name.trim().split(splitNameRegex);
  const first_name = parts[0];
  const last_name = parts.length > 1 ? parts.slice(1).join(" ") : undefined;

  return { first_name, last_name };
}

interface DbSubscriptionInsert {
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  currentPeriodStart: Date;
  customerCode: string;
  customerId: number;
  emailToken: string;
  id?: string;
  metadata: string | undefined;
  planCode: string;
  planName: string;
  provider: "paystack";
  referenceId: string;
  status: string;
  subscriptionCode: string;
  userId: string;
}

interface DbWebhookEventInsert {
  errorMessage: string | undefined;
  eventId: string;
  id?: string;
  payload: string;
  processedAt: Date | null;
  status: "pending" | "processed" | "failed";
  type: string;
}

interface DbPaymentInsert {
  amount: number;
  channel: string | undefined;
  currency: string;
  customerCode: string;
  customerId: number;
  id?: string;
  metadata: string | undefined;
  paidAt: Date;
  provider: "paystack";
  reference: string;
  referenceId: string | undefined;
  status: string;
  transactionId: number;
  userId: string | undefined;
}

export const toDbSubscription = (input: {
  id?: string;
  userId: string;
  referenceId: string;
  subscriptionCode: string;
  customerCode: string;
  customerId: number;
  planCode: string;
  planName: string;
  emailToken: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  metadata?: Record<string, unknown>;
}): DbSubscriptionInsert => ({
  ...(input.id ? { id: input.id } : {}),
  userId: input.userId,
  referenceId: input.referenceId,
  provider: "paystack",
  subscriptionCode: input.subscriptionCode,
  customerCode: input.customerCode,
  customerId: input.customerId,
  planCode: input.planCode,
  planName: input.planName,
  emailToken: input.emailToken,
  status: input.status,
  currentPeriodStart: input.currentPeriodStart,
  currentPeriodEnd: input.currentPeriodEnd,
  cancelAtPeriodEnd: input.cancelAtPeriodEnd,
  metadata: serializeMetadata(input.metadata),
});

export const toDbPayment = (input: {
  id?: string;
  reference: string;
  transactionId: number;
  userId?: string | undefined;
  referenceId?: string | undefined;
  customerCode: string;
  customerId: number;
  amount: number;
  currency: string;
  status: NormalizedPaymentStatus;
  channel?: string | undefined;
  paidAt: Date;
  metadata?: Record<string, unknown>;
}): DbPaymentInsert => ({
  ...(input.id ? { id: input.id } : {}),
  reference: input.reference,
  transactionId: input.transactionId,
  userId: input.userId,
  referenceId: input.referenceId,
  provider: "paystack",
  customerCode: input.customerCode,
  customerId: input.customerId,
  amount: input.amount,
  currency: input.currency,
  status: input.status,
  channel: input.channel,
  paidAt: input.paidAt,
  metadata: serializeMetadata(input.metadata),
});

export const mapPaymentRecord = (
  record: DbPaystackPayment
): PaystackPaymentRecord => ({
  id: record.id,
  reference: record.reference,
  transactionId: record.transactionId,
  userId: record.userId ?? undefined,
  referenceId: record.referenceId ?? undefined,
  provider: "paystack",
  customerCode: record.customerCode,
  customerId: record.customerId,
  amount: record.amount,
  currency: record.currency,
  status: record.status as NormalizedPaymentStatus,
  channel: record.channel ?? undefined,
  paidAt: new Date(record.paidAt),
  metadata: parseMetadata(record.metadata),
});

/**
 * Converts a webhook event input to a database webhook event record.
 * @internal
 */
export function toDbWebhookEvent(input: {
  id?: string;
  eventId: string;
  type: string;
  payload: string;
  status: "pending" | "processed" | "failed";
  processedAt?: Date | null;
  errorMessage?: string;
}): DbWebhookEventInsert {
  return {
    ...(input.id ? { id: input.id } : {}),
    eventId: input.eventId,
    type: input.type,
    payload: input.payload,
    status: input.status,
    processedAt: input.processedAt ?? null,
    errorMessage: input.errorMessage,
  };
}

/**
 * Normalized subscription status mapping from Paystack states/events.
 * @internal
 */
export function mapPaystackSubscriptionStatus(
  paystackStatus: string
): NormalizedSubscriptionStatus {
  const normalized = paystackStatus.toLowerCase();

  switch (normalized) {
    case "active":
    case "non-renewing":
      return "active";
    case "attention":
      return "past_due";
    case "cancelled":
    case "completed":
      return "cancelled";
    case "pending":
    case "incomplete":
      return "incomplete";
    default:
      return "incomplete";
  }
}

/**
 * Maps a webhook event to a normalized subscription status.
 * @internal
 */
export function mapWebhookEventToStatus(
  eventType: string,
  currentStatus?: NormalizedSubscriptionStatus
): NormalizedSubscriptionStatus | undefined {
  switch (eventType) {
    case "charge.success":
    case "subscription.create":
      return "active";
    case "invoice.payment_failed":
      return "past_due";
    case "subscription.disable":
      return "cancelled";
    case "subscription.not_renew":
      return currentStatus ?? "active";
    default:
      return;
  }
}

/**
 * Determines if a subscription should cancel at period end.
 * @internal
 */
export function shouldCancelAtPeriodEnd(
  eventType: string,
  paystackStatus?: string
): boolean {
  if (eventType === "subscription.not_renew") {
    return true;
  }

  return paystackStatus?.toLowerCase() === "non-renewing";
}

/**
 * Parses a subscription period.
 * @internal
 */
export function parseSubscriptionPeriod(subscription: PaystackSubscription): {
  currentPeriodStart: Date;
  currentPeriodEnd: Date | null;
} {
  const start = subscription.createdAt
    ? new Date(subscription.createdAt)
    : new Date();

  const end = subscription.next_payment_date
    ? new Date(subscription.next_payment_date)
    : null;

  return {
    currentPeriodStart: start,
    currentPeriodEnd: end,
  };
}

/**
 * Maps a transaction status to a normalized transaction status.
 * @internal
 */
export function mapTransactionStatus(
  status: string
): "pending" | "successful" | "failed" {
  const normalized = status.toLowerCase();

  if (normalized === "success" || normalized === "successful") {
    return "successful";
  }

  if (normalized === "failed" || normalized === "abandoned") {
    return "failed";
  }

  return "pending";
}

export const STATUS_MAPPING_DOCUMENTATION: string = `
Paystack -> Normalized status mapping:
- active, non-renewing -> active (non-renewing sets cancelAtPeriodEnd)
- attention -> past_due
- cancelled, completed -> cancelled
- pending, incomplete -> incomplete
- charge.success -> active
- invoice.payment_failed -> past_due
- subscription.disable -> cancelled
- subscription.not_renew -> active with cancelAtPeriodEnd=true
`.trim();

/**
 * Determines if a subscription is active or trialing.
 * @internal
 */
export function isActiveOrTrialing(sub: { status: string }): boolean {
  return sub.status === "active" || sub.status === "trialing";
}

/**
 * Determines if a subscription is pending cancel.
 * @internal
 */
export function isPendingCancel(sub: {
  cancelAtPeriodEnd?: boolean | null;
}): boolean {
  return !!sub.cancelAtPeriodEnd;
}

/**
 * Validates plugin options and returns a normalized context with a Paystack client
 * for API calls and webhook verification.
 */
export const resolvePluginContext = (
  options: PaystackPluginOptions
): PluginContext => {
  const hasClient = options.paystackClient !== undefined;
  if (!hasClient) {
    throw new Error(PAYSTACK_ERROR_CODES.MISSING_PLUGIN_CREDENTIALS.message);
  }

  return {
    options: {
      ...options,
      paystackClient: options.paystackClient,
      createCustomerOnSignUp: options.createCustomerOnSignUp ?? false,
      disablePaymentPersistence: options.disablePaymentPersistence ?? false,
      disableWebhookPersistence: options.disableWebhookPersistence ?? false,
    },
  };
};
