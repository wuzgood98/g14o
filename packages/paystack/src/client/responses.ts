import { z } from "zod";

import {
  paystackAuthorizationCoreSchema,
  paystackCustomerCoreSchema,
  paystackOpaqueRecord,
  paystackPlanCoreSchema,
  paystackTransactionCoreSchema,
} from "../resources";

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

const paystackAuthorizationSchemaImpl = paystackAuthorizationCoreSchema;

const paystackCustomerSchemaImpl = paystackCustomerCoreSchema.extend({
  email: z.email(),
  domain: z.string().optional(),
  integration: z.number().optional(),
  identified: z.boolean().optional(),
  identifications: z.unknown().nullable().optional(),
  dedicated_account: z.unknown().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  transactions: z.array(z.unknown()).optional(),
  subscriptions: z.array(z.unknown()).optional(),
  total_transactions: z.number().optional(),
  total_transaction_value: z.array(z.unknown()).optional(),
  authorizations: z
    .array(paystackAuthorizationSchemaImpl)
    .optional()
    .default([]),
});

const paystackPlanSchemaImpl = paystackPlanCoreSchema.extend({
  send_invoices: z.boolean().nullable().optional(),
  send_sms: z.boolean().nullable().optional(),
  invoice_limit: z.number().nullable().optional(),
  domain: z.string().nullable().optional(),
  integration: z.number().nullable().optional(),
  hosted_page: z.boolean().nullable().optional(),
  hosted_page_url: z.string().nullable().optional(),
  hosted_page_summary: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
  subscriptions: z.array(z.unknown()).nullable().optional(),
});

const paystackTransactionSchemaImpl = paystackTransactionCoreSchema.extend({
  domain: z.string().nullable().optional(),
  receipt_number: z.string().nullable().optional(),
  fees_split: z.unknown().nullable().optional(),
  order_id: z.string().nullable().optional(),
  pos_transaction_data: z.unknown().nullable().optional(),
  source: z.unknown().nullable().optional(),
  fees_breakdown: z.unknown().nullable().optional(),
  connect: z.unknown().nullable().optional(),
  transaction_date: z.string().nullable().optional(),
  paidAt: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  requested_amount: z.number().nullable().optional(),
  log: z.union([paystackOpaqueRecord, z.null()]).optional(),
  split: paystackOpaqueRecord.nullable().optional(),
  subaccount: paystackOpaqueRecord.nullable().optional(),
  plan_object: paystackOpaqueRecord.nullable().optional(),
  authorization: paystackAuthorizationSchemaImpl.nullable().optional(),
  customer: paystackCustomerSchemaImpl.nullable().optional(),
  plan: z.unknown().nullable().optional(),
});

const paystackSubscriptionSchemaImpl = z.object({
  id: z.number(),
  domain: z.string().optional(),
  status: z.string(),
  subscription_code: z.string(),
  email_token: z.string().optional(),
  amount: z.number(),
  integration: z.number().optional(),
  start: z.number().optional(),
  quantity: z.number().optional(),
  cron_expression: z.string().optional(),
  next_payment_date: z.string().nullable().optional(),
  open_invoice: z.string().nullable().optional(),
  easy_cron_id: z.union([z.string(), z.null()]).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  invoices: z.array(z.unknown()).optional(),
  plan: z.union([z.number(), paystackPlanSchemaImpl]).optional(),
  customer: z.union([z.number(), paystackCustomerSchemaImpl]).optional(),
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
  meta: z
    .object({
      next: z.string().nullable().optional(),
      previous: z.string().nullable().optional(),
      perPage: z.number(),
    })
    .optional(),
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
