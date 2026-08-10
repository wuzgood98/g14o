import { z } from "zod";

const UNSAFE_METADATA_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Safely parse JSON metadata stored in the database or received from Paystack.
 */
export const parseSafeMetadata = (
  metadata: string | Record<string, unknown> | null | undefined
): Record<string, unknown> | undefined => {
  if (!metadata) {
    return;
  }

  let parsed: Record<string, unknown>;

  if (typeof metadata === "string") {
    try {
      const value = JSON.parse(metadata) as unknown;
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return;
      }
      parsed = value as Record<string, unknown>;
    } catch {
      return;
    }
  } else {
    parsed = metadata;
  }

  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (UNSAFE_METADATA_KEYS.has(key)) {
      continue;
    }
    safe[key] = value;
  }

  return safe;
};

/** Safe metadata on Paystack resource entities (Customer, Transaction, …). */
export const paystackMetadataField = z.preprocess((value) => {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return parseSafeMetadata(value) ?? null;
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return parseSafeMetadata(value as Record<string, unknown>) ?? null;
  }

  return null;
}, z.record(z.string(), z.unknown()).nullable().optional());

/** Charge / payment-request metadata — objects, strings, numbers, or null. */
export const paystackChargeMetadataField = z.preprocess((value) => {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return parseSafeMetadata(value) ?? value;
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return parseSafeMetadata(value as Record<string, unknown>) ?? null;
  }

  return null;
}, z
  .union([z.record(z.string(), z.unknown()), z.string(), z.number(), z.null()])
  .nullish());

export const paystackReusableField = z
  .union([z.boolean(), z.number()])
  .transform((value) => Boolean(value))
  .optional();

export const paystackOpaqueRecord = z.record(z.string(), z.unknown());

/** Shared Paystack Customer fields across REST and webhooks. */
export const paystackCustomerCoreSchema = z.object({
  id: z.number(),
  customer_code: z.string(),
  email: z.string(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  metadata: paystackMetadataField,
  risk_action: z.string().optional(),
  international_format_phone: z.string().nullable().optional(),
});

/** Webhook Customer — stricter nullability on names. */
export const paystackCustomerWebhookSchema = paystackCustomerCoreSchema.extend({
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  phone: z.string().nullish(),
  risk_action: z.string().nullish(),
  international_format_phone: z.string().nullish(),
});

/** Shared Paystack Authorization fields across REST and webhooks. */
export const paystackAuthorizationCoreSchema = z.object({
  authorization_code: z.string().optional(),
  bin: z.string().optional(),
  last4: z.string().optional(),
  exp_month: z.string().optional(),
  exp_year: z.string().optional(),
  channel: z.string().optional(),
  card_type: z.string().optional(),
  bank: z.string().nullable().optional(),
  country_code: z.string().optional(),
  brand: z.string().optional(),
  reusable: paystackReusableField,
  signature: z.string().nullable().optional(),
  account_name: z.string().nullable().optional(),
});

/** Webhook Authorization — required card fields. */
export const paystackAuthorizationWebhookSchema =
  paystackAuthorizationCoreSchema.extend({
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
    signature: z.string().nullish(),
    account_name: z.string().nullish(),
  });

/** Shared Paystack Plan fields across REST and webhooks. */
export const paystackPlanCoreSchema = z.object({
  id: z.number(),
  name: z.string(),
  plan_code: z.string(),
  description: z.string().nullable().optional(),
  amount: z.number(),
  interval: z.string(),
  currency: z.string(),
});

/** Webhook Plan — required description slot (nullable). */
export const paystackPlanWebhookSchema = paystackPlanCoreSchema.extend({
  description: z.string().nullish(),
});

/** Shared Paystack Transaction fields across REST and webhooks. */
export const paystackTransactionCoreSchema = z.object({
  id: z.number(),
  status: z.string(),
  reference: z.string(),
  amount: z.number(),
  currency: z.string(),
  message: z.string().nullable().optional(),
  gateway_response: z.string().nullable().optional(),
  paid_at: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  channel: z.string().nullable().optional(),
  metadata: paystackMetadataField,
  ip_address: z.string().nullable().optional(),
  fees: z.number().nullable().optional(),
});

export type PaystackCustomerCore = z.infer<typeof paystackCustomerCoreSchema>;
export type PaystackAuthorizationCore = z.infer<
  typeof paystackAuthorizationCoreSchema
>;
export type PaystackPlanCore = z.infer<typeof paystackPlanCoreSchema>;
export type PaystackTransactionCore = z.infer<
  typeof paystackTransactionCoreSchema
>;
