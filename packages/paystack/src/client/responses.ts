import { z } from "zod";

import { parseSafeMetadata } from "../metadata";

const paystackMetadataField = z.preprocess((value) => {
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

const paystackReusableField = z
  .union([z.boolean(), z.number()])
  .transform((value) => Boolean(value))
  .optional();

export function paystackResponseEnvelopeSchema<T extends z.ZodType>(
  dataSchema: T
): z.ZodObject<{
  status: z.ZodBoolean;
  message: z.ZodString;
  data: T;
}> {
  return z.object({
    status: z.boolean(),
    message: z.string(),
    data: dataSchema,
  }) as z.ZodObject<{
    status: z.ZodBoolean;
    message: z.ZodString;
    data: T;
  }>;
}

const paystackAuthorizationSchemaImpl = z.object({
  authorization_code: z.string().optional(),
  bin: z.string().optional(),
  last4: z.string().optional(),
  exp_month: z.string().optional(),
  exp_year: z.string().optional(),
  channel: z.string().optional(),
  card_type: z.string().optional(),
  bank: z.string().optional(),
  country_code: z.string().optional(),
  brand: z.string().optional(),
  reusable: paystackReusableField,
  signature: z.string().optional(),
});

const paystackCustomerSchemaImpl = z.object({
  id: z.number(),
  customer_code: z.string(),
  email: z.email(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  metadata: paystackMetadataField,
  risk_action: z.string().optional(),
  authorizations: z
    .array(paystackAuthorizationSchemaImpl)
    .optional()
    .default([]),
});

const paystackPlanSchemaImpl = z.object({
  id: z.number(),
  name: z.string(),
  plan_code: z.string(),
  description: z.string().nullable().optional(),
  amount: z.number(),
  interval: z.string(),
  send_invoices: z.boolean().optional(),
  send_sms: z.boolean().optional(),
  currency: z.string(),
  invoice_limit: z.number().optional(),
});

const paystackTransactionSchemaImpl = z.object({
  id: z.number(),
  domain: z.string().optional(),
  status: z.string(),
  reference: z.string(),
  amount: z.number(),
  message: z.string().nullable().optional(),
  gateway_response: z.string().optional(),
  paid_at: z.string().nullable().optional(),
  created_at: z.string().optional(),
  channel: z.string().optional(),
  currency: z.string(),
  authorization: paystackAuthorizationSchemaImpl.optional(),
  customer: paystackCustomerSchemaImpl.optional(),
  metadata: paystackMetadataField,
  plan: z.unknown().nullable().optional(),
});

const paystackSubscriptionSchemaImpl = z.object({
  id: z.number(),
  domain: z.string().optional(),
  status: z.string(),
  subscription_code: z.string(),
  email_token: z.string().optional(),
  amount: z.number(),
  cron_expression: z.string().optional(),
  next_payment_date: z.string().nullable().optional(),
  open_invoice: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  plan: paystackPlanSchemaImpl.optional(),
  customer: paystackCustomerSchemaImpl.optional(),
  authorization: paystackAuthorizationSchemaImpl.optional(),
});

const paystackInitializeTransactionSchemaImpl = z.object({
  authorization_url: z.string(),
  access_code: z.string(),
  reference: z.string(),
});

const paystackListMetaSchemaImpl = z.object({
  total: z.number(),
  skipped: z.number(),
  perPage: z.number(),
  page: z.number(),
  pageCount: z.number(),
});

const paystackPlanListSchemaImpl = paystackResponseEnvelopeSchema(
  z.array(paystackPlanSchemaImpl)
).extend({
  meta: paystackListMetaSchemaImpl.optional(),
});

const paystackCustomerListSchemaImpl = paystackResponseEnvelopeSchema(
  z.array(paystackCustomerSchemaImpl)
).extend({
  meta: paystackListMetaSchemaImpl.optional(),
});

/** Paystack customer resource. */
export type PaystackCustomer = z.infer<typeof paystackCustomerSchemaImpl>;
/** Saved card authorization returned on successful charges. */
export type PaystackAuthorization = z.infer<
  typeof paystackAuthorizationSchemaImpl
>;
/** Paystack transaction resource. */
export type PaystackTransaction = z.infer<typeof paystackTransactionSchemaImpl>;
/** Paystack subscription plan resource. */
export type PaystackPlan = z.infer<typeof paystackPlanSchemaImpl>;
/** Paystack subscription resource (includes `email_token` for cancel/resume). */
export type PaystackSubscription = z.infer<
  typeof paystackSubscriptionSchemaImpl
>;
/** Response from `transaction/initialize` with hosted checkout URL. */
export type PaystackInitializeTransaction = z.infer<
  typeof paystackInitializeTransactionSchemaImpl
>;

export const paystackCustomerSchema: z.ZodType<PaystackCustomer> =
  paystackCustomerSchemaImpl;
export const paystackAuthorizationSchema: z.ZodType<PaystackAuthorization> =
  paystackAuthorizationSchemaImpl;
export const paystackTransactionSchema: z.ZodType<PaystackTransaction> =
  paystackTransactionSchemaImpl;
export const paystackPlanSchema: z.ZodType<PaystackPlan> =
  paystackPlanSchemaImpl;
export const paystackSubscriptionSchema: z.ZodType<PaystackSubscription> =
  paystackSubscriptionSchemaImpl;
export const paystackInitializeTransactionSchema: z.ZodType<PaystackInitializeTransaction> =
  paystackInitializeTransactionSchemaImpl;
export const paystackListMetaSchema: z.ZodType<
  z.infer<typeof paystackListMetaSchemaImpl>
> = paystackListMetaSchemaImpl;
export const paystackPlanListSchema: z.ZodType<
  z.infer<typeof paystackPlanListSchemaImpl>
> = paystackPlanListSchemaImpl;
export const paystackCustomerListSchema: z.ZodType<
  z.infer<typeof paystackCustomerListSchemaImpl>
> = paystackCustomerListSchemaImpl;
