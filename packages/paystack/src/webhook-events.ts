/**
 * Paystack Webhook Event Validation
 * ----------------------------------
 * Strongly-typed Zod schemas for every event Paystack can send to a
 * webhook URL, as documented at:
 * https://paystack.com/docs/payments/webhooks/
 *
 * Usage:
 *
 *   import { paystackWebhookEventSchema, isPaystackEvent } from "./validation";
 *
 *   app.post("/webhook", (req, res) => {
 *     const parsed = paystackWebhookEventSchema.safeParse(req.body);
 *     if (!parsed.success) return res.sendStatus(400);
 *
 *     const event = parsed.data; // fully typed, discriminated by `event`
 *
 *     if (isPaystackEvent(event, "charge.success")) {
 *       // event.data is typed as ChargeSuccessData
 *     }
 *
 *     res.sendStatus(200);
 *   });
 */

import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Shared / reusable primitives                                       */
/* ------------------------------------------------------------------ */

/** Paystack timestamps are ISO-8601 strings. */
const isoDateString = z.string();

/** Paystack amounts are always in the lowest currency subunit (kobo, cents, pesewas). */
const amount = z.number();

const currency = z.string();

const customerSchema = z.object({
  id: z.number(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  email: z.string(),
  customer_code: z.string(),
  phone: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  risk_action: z.string().optional(),
  international_format_phone: z.string().nullable().optional(),
});

const authorizationSchema = z.object({
  authorization_code: z.string(),
  bin: z.string(),
  last4: z.string(),
  exp_month: z.string(),
  exp_year: z.string(),
  channel: z.string(),
  card_type: z.string(),
  bank: z.string().nullable(),
  country_code: z.string(),
  brand: z.string(),
  reusable: z.boolean(),
  signature: z.string().nullable().optional(),
  account_name: z.string().nullable().optional(),
});

const planSchema = z.object({
  id: z.number(),
  name: z.string(),
  plan_code: z.string(),
  description: z.string().nullable().optional(),
  amount,
  interval: z.string(),
  currency,
});

const subscriptionRefSchema = z.object({
  id: z.number(),
  subscription_code: z.string(),
  email_token: z.string().optional(),
  amount,
  cron_expression: z.string().optional(),
  next_payment_date: isoDateString.nullable().optional(),
  status: z.string(),
});

const metadataSchema = z.union([
  z.record(z.string(), z.unknown()),
  z.string(),
  z.number(),
  z.null(),
]);

/* ------------------------------------------------------------------ */
/* charge.success                                                      */
/* ------------------------------------------------------------------ */

const chargeSuccessDataSchema = z.object({
  id: z.number(),
  domain: z.string(),
  status: z.literal("success"),
  reference: z.string(),
  amount,
  message: z.string().nullable(),
  gateway_response: z.string(),
  paid_at: isoDateString,
  created_at: isoDateString,
  channel: z.string(),
  currency,
  ip_address: z.string().nullable().optional(),
  metadata: metadataSchema.optional(),
  fees: z.number().nullable().optional(),
  customer: customerSchema,
  authorization: authorizationSchema.optional(),
  subscription_code: z.string().optional(),
  plan: z
    .union([planSchema, z.string(), z.record(z.string(), z.unknown())])
    .nullable()
    .optional(),
});

/* ------------------------------------------------------------------ */
/* charge.dispute.create / .remind / .resolve                          */
/* ------------------------------------------------------------------ */

const disputeHistoryEntrySchema = z.object({
  status: z.string(),
  by: z.string(),
  createdAt: isoDateString,
});

const disputeMessageSchema = z.object({
  sender: z.string(),
  body: z.string(),
  createdAt: isoDateString,
});

const disputeTransactionSchema = z.object({
  id: z.number(),
  domain: z.string(),
  status: z.string(),
  reference: z.string(),
  amount,
  currency,
  gateway_response: z.string().nullable().optional(),
  paid_at: isoDateString.nullable().optional(),
  created_at: isoDateString.nullable().optional(),
  channel: z.string().nullable().optional(),
  customer: customerSchema.optional(),
});

const disputeDataSchema = z.object({
  id: z.number(),
  refund_amount: amount.nullable().optional(),
  currency,
  status: z.string(),
  resolution: z.string().nullable().optional(),
  domain: z.string(),
  transaction: disputeTransactionSchema,
  transaction_reference: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  customer: customerSchema.optional(),
  bin: z.string().nullable().optional(),
  last4: z.string().nullable().optional(),
  dueAt: isoDateString.nullable().optional(),
  resolvedAt: isoDateString.nullable().optional(),
  evidence: z.unknown().nullable().optional(),
  attachments: z.unknown().nullable().optional(),
  note: z.string().nullable().optional(),
  history: z.array(disputeHistoryEntrySchema).optional(),
  messages: z.array(disputeMessageSchema).optional(),
  createdAt: isoDateString.optional(),
});

/* ------------------------------------------------------------------ */
/* customeridentification.failed / .success                           */
/* ------------------------------------------------------------------ */

const identificationSchema = z.object({
  country: z.string(),
  type: z.string(),
  bvn: z.string().optional(),
  account_number: z.string().optional(),
  bank_code: z.string().optional(),
  number: z.string().optional(),
});

const customerIdentificationFailedDataSchema = z.object({
  customer_id: z.number(),
  customer_code: z.string(),
  email: z.string(),
  identification: identificationSchema,
  reason: z.string(),
});

const customerIdentificationSuccessDataSchema = z.object({
  customer_id: z.number(),
  customer_code: z.string(),
  email: z.string(),
  identification: identificationSchema,
});

/* ------------------------------------------------------------------ */
/* dedicatedaccount.assign.failed / .success                           */
/* ------------------------------------------------------------------ */

const dedicatedAccountBankSchema = z.object({
  name: z.string(),
  id: z.number(),
  slug: z.string(),
});

const dedicatedAccountSchema = z.object({
  bank: dedicatedAccountBankSchema,
  account_name: z.string(),
  account_number: z.string(),
  assigned: z.boolean().optional(),
  currency: currency.optional(),
  active: z.boolean().optional(),
  id: z.number().optional(),
});

const dedicatedAccountAssignSuccessDataSchema = z.object({
  customer: customerSchema,
  dedicated_account: dedicatedAccountSchema,
});

const dedicatedAccountAssignFailedDataSchema = z.object({
  customer: customerSchema,
  account_number: z.string().nullable().optional(),
  bank: dedicatedAccountBankSchema.nullable().optional(),
  reason: z.string().optional(),
});

/* ------------------------------------------------------------------ */
/* invoice.create / .payment_failed / .update                          */
/* ------------------------------------------------------------------ */

const invoiceDataSchema = z.object({
  id: z.number(),
  domain: z.string().optional(),
  subscription: subscriptionRefSchema,
  invoice_code: z.string().optional(),
  customer: customerSchema,
  transaction: z
    .object({
      id: z.number(),
      reference: z.string(),
      status: z.string(),
      amount,
      currency,
    })
    .nullable()
    .optional(),
  amount,
  period_start: isoDateString.optional(),
  period_end: isoDateString.optional(),
  status: z.string(),
  paid: z.boolean().optional(),
  paid_at: isoDateString.nullable().optional(),
  description: z.string().nullable().optional(),
  created_at: isoDateString.optional(),
});

/* ------------------------------------------------------------------ */
/* paymentrequest.pending / .success                                   */
/* ------------------------------------------------------------------ */

const paymentRequestDataSchema = z.object({
  id: z.number(),
  domain: z.string().optional(),
  amount,
  currency,
  due_date: isoDateString.nullable().optional(),
  has_invoice: z.boolean().optional(),
  invoice_number: z.number().nullable().optional(),
  description: z.string().nullable().optional(),
  pdf_url: z.string().nullable().optional(),
  line_items: z.array(z.record(z.string(), z.unknown())).optional(),
  tax: z.array(z.record(z.string(), z.unknown())).optional(),
  request_code: z.string(),
  status: z.string(),
  paid: z.boolean().optional(),
  paid_at: isoDateString.nullable().optional(),
  metadata: metadataSchema.optional(),
  customer: customerSchema,
  created_at: isoDateString.optional(),
});

/* ------------------------------------------------------------------ */
/* refund.failed / .pending / .processed / .processing                 */
/* ------------------------------------------------------------------ */

const refundDataSchema = z.object({
  id: z.number(),
  domain: z.string().optional(),
  transaction_reference: z.string().optional(),
  amount,
  currency,
  status: z.string(),
  refunded_at: isoDateString.nullable().optional(),
  refunded_by: z.string().nullable().optional(),
  customer_note: z.string().nullable().optional(),
  merchant_note: z.string().nullable().optional(),
  deducted_amount: amount.nullable().optional(),
  fully_deducted: z.boolean().optional(),
  transaction: z
    .object({
      id: z.number(),
      reference: z.string(),
      amount,
      currency,
      status: z.string(),
    })
    .optional(),
  customer: customerSchema.optional(),
  created_at: isoDateString.optional(),
});

/* ------------------------------------------------------------------ */
/* subscription.create / .disable / .not_renew / .expiring_cards       */
/* ------------------------------------------------------------------ */

const subscriptionCreateDataSchema = z.object({
  id: z.number(),
  domain: z.string().optional(),
  status: z.string(),
  subscription_code: z.string(),
  email_token: z.string(),
  amount,
  cron_expression: z.string(),
  next_payment_date: isoDateString.nullable(),
  open_invoice: z.string().nullable().optional(),
  createdAt: isoDateString.optional(),
  plan: planSchema,
  authorization: authorizationSchema,
  customer: customerSchema,
});

const subscriptionDisableDataSchema = z.object({
  id: z.number(),
  domain: z.string().optional(),
  status: z.string(),
  subscription_code: z.string(),
  email_token: z.string(),
  amount,
  cron_expression: z.string(),
  next_payment_date: isoDateString.nullable(),
  plan: planSchema,
  authorization: authorizationSchema.optional(),
  customer: customerSchema,
});

const subscriptionNotRenewDataSchema = z.object({
  id: z.number(),
  domain: z.string().optional(),
  status: z.string(),
  subscription_code: z.string(),
  email_token: z.string(),
  amount,
  cron_expression: z.string(),
  next_payment_date: isoDateString.nullable(),
  open_invoice: z.string().nullable().optional(),
  plan: planSchema,
  authorization: authorizationSchema.optional(),
  customer: customerSchema,
  invoice_limit: z.number().optional(),
});

const expiringCardSchema = z.object({
  expiry_date: z.string(),
  subscription: subscriptionRefSchema,
  customer: customerSchema,
  authorization: authorizationSchema,
});

const subscriptionExpiringCardsDataSchema = z.array(expiringCardSchema);

/* ------------------------------------------------------------------ */
/* transfer.failed / .success / .reversed                              */
/* ------------------------------------------------------------------ */

const transferRecipientSchema = z.object({
  id: z.number(),
  domain: z.string().optional(),
  type: z.string(),
  currency,
  name: z.string().nullable().optional(),
  details: z
    .object({
      account_number: z.string(),
      account_name: z.string().nullable().optional(),
      bank_code: z.string(),
      bank_name: z.string(),
    })
    .optional(),
  recipient_code: z.string(),
  active: z.boolean().optional(),
});

const transferDataSchema = z.object({
  id: z.number(),
  domain: z.string().optional(),
  amount,
  currency,
  source: z.string(),
  source_details: z.unknown().nullable().optional(),
  reason: z.string().nullable().optional(),
  status: z.string(),
  failures: z.unknown().nullable().optional(),
  transfer_code: z.string(),
  titan_code: z.string().nullable().optional(),
  transferred_at: isoDateString.nullable().optional(),
  reference: z.string().nullable().optional(),
  recipient: transferRecipientSchema,
  created_at: isoDateString.optional(),
  updated_at: isoDateString.optional(),
});

/* ------------------------------------------------------------------ */
/* Event name <-> data schema map                                      */
/* ------------------------------------------------------------------ */

const eventSchemaMap = {
  "charge.success": chargeSuccessDataSchema,

  "charge.dispute.create": disputeDataSchema,
  "charge.dispute.remind": disputeDataSchema,
  "charge.dispute.resolve": disputeDataSchema,

  "customeridentification.failed": customerIdentificationFailedDataSchema,
  "customeridentification.success": customerIdentificationSuccessDataSchema,

  "dedicatedaccount.assign.failed": dedicatedAccountAssignFailedDataSchema,
  "dedicatedaccount.assign.success": dedicatedAccountAssignSuccessDataSchema,

  "invoice.create": invoiceDataSchema,
  "invoice.payment_failed": invoiceDataSchema,
  "invoice.update": invoiceDataSchema,

  "paymentrequest.pending": paymentRequestDataSchema,
  "paymentrequest.success": paymentRequestDataSchema,

  "refund.failed": refundDataSchema,
  "refund.pending": refundDataSchema,
  "refund.processed": refundDataSchema,
  "refund.processing": refundDataSchema,

  "subscription.create": subscriptionCreateDataSchema,
  "subscription.disable": subscriptionDisableDataSchema,
  "subscription.not_renew": subscriptionNotRenewDataSchema,
  "subscription.expiring_cards": subscriptionExpiringCardsDataSchema,

  "transfer.failed": transferDataSchema,
  "transfer.success": transferDataSchema,
  "transfer.reversed": transferDataSchema,
} as const;

export type PaystackEventName = keyof typeof eventSchemaMap;

/* ------------------------------------------------------------------ */
/* Per-event envelope schemas ( { event, data } )                      */
/* ------------------------------------------------------------------ */

const chargeSuccessEventSchema = z.object({
  event: z.literal("charge.success"),
  data: chargeSuccessDataSchema,
});

const chargeDisputeCreateEventSchema = z.object({
  event: z.literal("charge.dispute.create"),
  data: disputeDataSchema,
});

const chargeDisputeRemindEventSchema = z.object({
  event: z.literal("charge.dispute.remind"),
  data: disputeDataSchema,
});

const chargeDisputeResolveEventSchema = z.object({
  event: z.literal("charge.dispute.resolve"),
  data: disputeDataSchema,
});

const customerIdentificationFailedEventSchema = z.object({
  event: z.literal("customeridentification.failed"),
  data: customerIdentificationFailedDataSchema,
});

const customerIdentificationSuccessEventSchema = z.object({
  event: z.literal("customeridentification.success"),
  data: customerIdentificationSuccessDataSchema,
});

const dedicatedAccountAssignFailedEventSchema = z.object({
  event: z.literal("dedicatedaccount.assign.failed"),
  data: dedicatedAccountAssignFailedDataSchema,
});

const dedicatedAccountAssignSuccessEventSchema = z.object({
  event: z.literal("dedicatedaccount.assign.success"),
  data: dedicatedAccountAssignSuccessDataSchema,
});

const invoiceCreateEventSchema = z.object({
  event: z.literal("invoice.create"),
  data: invoiceDataSchema,
});

const invoicePaymentFailedEventSchema = z.object({
  event: z.literal("invoice.payment_failed"),
  data: invoiceDataSchema,
});

const invoiceUpdateEventSchema = z.object({
  event: z.literal("invoice.update"),
  data: invoiceDataSchema,
});

const paymentRequestPendingEventSchema = z.object({
  event: z.literal("paymentrequest.pending"),
  data: paymentRequestDataSchema,
});

const paymentRequestSuccessEventSchema = z.object({
  event: z.literal("paymentrequest.success"),
  data: paymentRequestDataSchema,
});

const refundFailedEventSchema = z.object({
  event: z.literal("refund.failed"),
  data: refundDataSchema,
});

const refundPendingEventSchema = z.object({
  event: z.literal("refund.pending"),
  data: refundDataSchema,
});

const refundProcessedEventSchema = z.object({
  event: z.literal("refund.processed"),
  data: refundDataSchema,
});

const refundProcessingEventSchema = z.object({
  event: z.literal("refund.processing"),
  data: refundDataSchema,
});

const subscriptionCreateEventSchema = z.object({
  event: z.literal("subscription.create"),
  data: subscriptionCreateDataSchema,
});

const subscriptionDisableEventSchema = z.object({
  event: z.literal("subscription.disable"),
  data: subscriptionDisableDataSchema,
});

const subscriptionNotRenewEventSchema = z.object({
  event: z.literal("subscription.not_renew"),
  data: subscriptionNotRenewDataSchema,
});

const subscriptionExpiringCardsEventSchema = z.object({
  event: z.literal("subscription.expiring_cards"),
  data: subscriptionExpiringCardsDataSchema,
});

const transferFailedEventSchema = z.object({
  event: z.literal("transfer.failed"),
  data: transferDataSchema,
});

const transferSuccessEventSchema = z.object({
  event: z.literal("transfer.success"),
  data: transferDataSchema,
});

const transferReversedEventSchema = z.object({
  event: z.literal("transfer.reversed"),
  data: transferDataSchema,
});

/* ------------------------------------------------------------------ */
/* Discriminated union of every supported webhook event                */
/* ------------------------------------------------------------------ */

export const paystackWebhookEventSchema = z.discriminatedUnion("event", [
  chargeSuccessEventSchema,
  chargeDisputeCreateEventSchema,
  chargeDisputeRemindEventSchema,
  chargeDisputeResolveEventSchema,
  customerIdentificationFailedEventSchema,
  customerIdentificationSuccessEventSchema,
  dedicatedAccountAssignFailedEventSchema,
  dedicatedAccountAssignSuccessEventSchema,
  invoiceCreateEventSchema,
  invoicePaymentFailedEventSchema,
  invoiceUpdateEventSchema,
  paymentRequestPendingEventSchema,
  paymentRequestSuccessEventSchema,
  refundFailedEventSchema,
  refundPendingEventSchema,
  refundProcessedEventSchema,
  refundProcessingEventSchema,
  subscriptionCreateEventSchema,
  subscriptionDisableEventSchema,
  subscriptionNotRenewEventSchema,
  subscriptionExpiringCardsEventSchema,
  transferFailedEventSchema,
  transferSuccessEventSchema,
  transferReversedEventSchema,
]);

export type PaystackWebhookEvent = z.infer<typeof paystackWebhookEventSchema>;

/* ------------------------------------------------------------------ */
/* Per-event exported types (data payloads)                            */
/* ------------------------------------------------------------------ */

export type ChargeSuccessData = z.infer<typeof chargeSuccessDataSchema>;
export type ChargeDisputeData = z.infer<typeof disputeDataSchema>;
export type CustomerIdentificationFailedData = z.infer<
  typeof customerIdentificationFailedDataSchema
>;
export type CustomerIdentificationSuccessData = z.infer<
  typeof customerIdentificationSuccessDataSchema
>;
export type DedicatedAccountAssignFailedData = z.infer<
  typeof dedicatedAccountAssignFailedDataSchema
>;
export type DedicatedAccountAssignSuccessData = z.infer<
  typeof dedicatedAccountAssignSuccessDataSchema
>;
export type InvoiceData = z.infer<typeof invoiceDataSchema>;
export type PaymentRequestData = z.infer<typeof paymentRequestDataSchema>;
export type RefundData = z.infer<typeof refundDataSchema>;
export type SubscriptionCreateData = z.infer<
  typeof subscriptionCreateDataSchema
>;
export type SubscriptionDisableData = z.infer<
  typeof subscriptionDisableDataSchema
>;
export type SubscriptionNotRenewData = z.infer<
  typeof subscriptionNotRenewDataSchema
>;
export type SubscriptionExpiringCardsData = z.infer<
  typeof subscriptionExpiringCardsDataSchema
>;
export type TransferData = z.infer<typeof transferDataSchema>;

/**
 * Maps each event name to the TS type of its `data` payload.
 * Useful for generic helpers: `PaystackEventDataMap["charge.success"]`
 * or `PaystackEventDataMap["charge.dispute.create"]`.
 */
export interface PaystackEventDataMap {
  "charge.dispute.create": ChargeDisputeData;
  "charge.dispute.remind": ChargeDisputeData;
  "charge.dispute.resolve": ChargeDisputeData;
  "charge.success": ChargeSuccessData;
  "customeridentification.failed": CustomerIdentificationFailedData;
  "customeridentification.success": CustomerIdentificationSuccessData;
  "dedicatedaccount.assign.failed": DedicatedAccountAssignFailedData;
  "dedicatedaccount.assign.success": DedicatedAccountAssignSuccessData;
  "invoice.create": InvoiceData;
  "invoice.payment_failed": InvoiceData;
  "invoice.update": InvoiceData;
  "paymentrequest.pending": PaymentRequestData;
  "paymentrequest.success": PaymentRequestData;
  "refund.failed": RefundData;
  "refund.pending": RefundData;
  "refund.processed": RefundData;
  "refund.processing": RefundData;
  "subscription.create": SubscriptionCreateData;
  "subscription.disable": SubscriptionDisableData;
  "subscription.expiring_cards": SubscriptionExpiringCardsData;
  "subscription.not_renew": SubscriptionNotRenewData;
  "transfer.failed": TransferData;
  "transfer.reversed": TransferData;
  "transfer.success": TransferData;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Narrows a parsed PaystackWebhookEvent to a specific event type,
 * giving you a strongly-typed `data` payload.
 *
 * @example
 * const result = paystackWebhookEventSchema.safeParse(req.body);
 * if (result.success && isPaystackEvent(result.data, "transfer.success")) {
 *   result.data.data.recipient.recipient_code; // fully typed
 * }
 */
export function isPaystackEvent<E extends PaystackEventName>(
  event: PaystackWebhookEvent,
  name: E
): event is Extract<PaystackWebhookEvent, { event: E }> {
  return event.event === name;
}

/**
 * Parses and validates a raw webhook request body.
 * Throws a ZodError if the payload doesn't match any known event schema.
 */
export function parsePaystackWebhookEvent(
  payload: unknown
): PaystackWebhookEvent {
  return paystackWebhookEventSchema.parse(payload);
}

/**
 * Safe variant of `parsePaystackWebhookEvent` — never throws.
 */
export function safeParsePaystackWebhookEvent(payload: unknown) {
  return paystackWebhookEventSchema.safeParse(payload);
}

/** Runtime list of every event name this file supports — handy for logging/validation. */
export const SUPPORTED_PAYSTACK_EVENTS = Object.keys(
  eventSchemaMap
) as PaystackEventName[];
