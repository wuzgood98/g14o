import type { TypeNode } from "fumadocs-ui/components/type-table";
import {
  payments,
  subscriptions,
  user,
  webhookEvents,
} from "../../../packages/paystack-better-auth/src/schema";

interface SchemaFieldAttribute {
  bigint?: boolean;
  defaultValue?: string | number | boolean;
  references?: {
    model: string;
    field: string;
    onDelete?: string;
  };
  required?: boolean;
  type: string;
  unique?: boolean;
}

const BETTER_AUTH_ID_FIELD: TypeNode = {
  type: "string",
  description:
    "Unique identifier (primary key, added automatically by Better Auth)",
  required: true,
};

const fieldDescriptions: Record<string, string> = {
  "user.paystackCustomerCode": "Paystack customer code (e.g. CUS_xxx)",
  "user.paystackCustomerId": "Paystack customer ID",

  "subscription.userId": "The ID of the user",
  "subscription.referenceId":
    "Reference ID for the subscription (typically the user or organization ID)",
  "subscription.provider": "Billing provider identifier",
  "subscription.subscriptionCode": "Paystack subscription code",
  "subscription.customerId": "Paystack customer ID",
  "subscription.customerCode": "Paystack customer code",
  "subscription.planCode": "Paystack plan code",
  "subscription.planName": "Display name of the plan",
  "subscription.emailToken":
    "Paystack email token used for cancel and resume actions",
  "subscription.status": "Normalized subscription status",
  "subscription.currentPeriodStart": "Start of the current billing period",
  "subscription.currentPeriodEnd": "End of the current billing period",
  "subscription.cancelAtPeriodEnd":
    "Whether the subscription cancels at period end",
  "subscription.metadata": "JSON metadata stored as a string",

  "payment.reference": "Paystack transaction reference",
  "payment.transactionId": "Paystack transaction ID",
  "payment.userId": "The ID of the user (if linked)",
  "payment.referenceId": "Optional reference ID for the payment",
  "payment.provider": "Billing provider identifier",
  "payment.customerCode": "Paystack customer code",
  "payment.customerId": "Paystack customer ID",
  "payment.amount":
    "Amount in the smallest currency unit (kobo, pesewas, cents, etc.)",
  "payment.currency": "ISO currency code (e.g. GHS, NGN)",
  "payment.status": "Normalized payment status",
  "payment.channel": "Payment channel (e.g. card, mobile_money)",
  "payment.paidAt": "When the payment was completed",
  "payment.metadata": "JSON metadata stored as a string",

  "webhookEvent.eventId": "Unique Paystack event ID for deduplication",
  "webhookEvent.type": "Paystack event type (e.g. charge.success)",
  "webhookEvent.payload": "Raw webhook payload as JSON string",
  "webhookEvent.status": "Processing status (pending, processed, failed)",
  "webhookEvent.processedAt": "When the event was processed",
  "webhookEvent.errorMessage": "Error message if processing failed",
};

function formatFieldType(field: SchemaFieldAttribute): string {
  if (field.type === "date") {
    return "Date";
  }
  if (field.type === "number" && field.bigint) {
    return "number (bigint)";
  }
  return field.type;
}

function buildDescription(
  tableName: string,
  fieldName: string,
  field: SchemaFieldAttribute
): string {
  const parts: string[] = [];
  const key = `${tableName}.${fieldName}`;
  const base = fieldDescriptions[key];
  if (base) {
    parts.push(base);
  }
  if (field.unique) {
    parts.push("Unique");
  }
  if (field.references) {
    parts.push(
      `References ${field.references.model}.${field.references.field}`
    );
  }
  return parts.join(". ");
}

function schemaFieldsToTypeTable(
  tableName: string,
  fields: Record<string, SchemaFieldAttribute>,
  options?: { includeId?: boolean }
): Record<string, TypeNode> {
  const result: Record<string, TypeNode> = {};

  if (options?.includeId) {
    result.id = BETTER_AUTH_ID_FIELD;
  }

  for (const [fieldName, field] of Object.entries(fields)) {
    const node: TypeNode = {
      type: formatFieldType(field),
      description: buildDescription(tableName, fieldName, field),
    };

    if (field.required === false) {
      node.required = false;
    }

    if (
      field.defaultValue !== undefined &&
      typeof field.defaultValue !== "function"
    ) {
      node.default = String(field.defaultValue);
    }

    result[fieldName] = node;
  }

  return result;
}

export const paystackSchemaTables = {
  user: {
    name: "user",
    extendsCore: true,
    when: undefined,
    type: schemaFieldsToTypeTable("user", user.user.fields),
  },
  subscription: {
    name: "subscription",
    extendsCore: false,
    when: "only when `subscription.enabled` is `true`",
    type: schemaFieldsToTypeTable(
      "subscription",
      subscriptions.subscription.fields,
      { includeId: true }
    ),
  },
  payment: {
    name: "payment",
    extendsCore: false,
    when: "omit when `disablePaymentPersistence: true`",
    type: schemaFieldsToTypeTable("payment", payments.payment.fields, {
      includeId: true,
    }),
  },
  webhookEvent: {
    name: "webhookEvent",
    extendsCore: false,
    when: "omit when `disableWebhookPersistence: true`",
    type: schemaFieldsToTypeTable(
      "webhookEvent",
      webhookEvents.webhookEvent.fields,
      { includeId: true }
    ),
  },
} as const;

export type PaystackSchemaTableKey = keyof typeof paystackSchemaTables;
