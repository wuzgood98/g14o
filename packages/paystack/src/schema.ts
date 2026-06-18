/* biome-ignore-all lint/complexity/noBannedTypes: subscription is a union of the subscription schema */
import type { BetterAuthPluginDBSchema } from "better-auth";
import { mergeSchema } from "better-auth/db";
import type { PaystackPluginOptions } from "./types";

export const user = {
  user: {
    fields: {
      paystackCustomerCode: {
        type: "string",
        required: false,
      },
      paystackCustomerId: {
        type: "number",
        required: false,
      },
    },
  },
} satisfies BetterAuthPluginDBSchema;

export const subscriptions = {
  subscription: {
    fields: {
      userId: {
        type: "string",
        required: true,
        references: {
          model: "user",
          field: "id",
          onDelete: "cascade",
        },
      },
      referenceId: {
        type: "string",
        required: true,
      },
      provider: {
        type: "string",
        required: true,
        defaultValue: "paystack",
      },
      subscriptionCode: {
        type: "string",
        required: true,
        unique: true,
      },
      customerId: {
        type: "number",
        required: true,
      },
      customerCode: {
        type: "string",
        required: true,
      },
      planCode: {
        type: "string",
        required: true,
      },
      planName: {
        type: "string",
        required: true,
      },
      emailToken: {
        type: "string",
        required: true,
      },
      status: {
        type: "string",
        required: true,
      },
      currentPeriodStart: {
        type: "date",
        required: true,
      },
      currentPeriodEnd: {
        type: "date",
        required: false,
      },
      cancelAtPeriodEnd: {
        type: "boolean",
        required: true,
        defaultValue: false,
      },
      metadata: {
        type: "string",
        required: false,
      },
    },
  },
} satisfies BetterAuthPluginDBSchema;

export const webhookEvents = {
  webhookEvent: {
    fields: {
      eventId: {
        type: "string",
        required: true,
        unique: true,
      },
      type: {
        type: "string",
        required: true,
      },
      payload: {
        type: "string",
        required: true,
      },
      status: {
        type: "string",
        required: true,
        defaultValue: "pending",
      },
      processedAt: {
        type: "date",
        required: false,
      },
      errorMessage: {
        type: "string",
        required: false,
      },
    },
  },
} satisfies BetterAuthPluginDBSchema;

type GetSchemaResult<O extends PaystackPluginOptions> = typeof user &
  (O["subscription"] extends { enabled: true } ? typeof subscriptions : {}) &
  (O["disableWebhookPersistence"] extends true ? {} : typeof webhookEvents);

export const getSchema = <O extends PaystackPluginOptions>(
  options: O
): GetSchemaResult<O> => {
  let baseSchema: BetterAuthPluginDBSchema = {};

  if (options.subscription?.enabled) {
    baseSchema = {
      ...subscriptions,
      ...user,
    };
  } else {
    baseSchema = {
      ...user,
    };
  }

  if (!options.disableWebhookPersistence) {
    baseSchema = {
      ...baseSchema,
      ...webhookEvents,
    };
  }

  if (
    options.schema &&
    !options.subscription?.enabled &&
    "subscription" in options.schema
  ) {
    const { subscription: _subscription, ...restSchema } = options.schema;
    return mergeSchema(baseSchema, restSchema) as GetSchemaResult<O>;
  }

  return mergeSchema(baseSchema, options.schema) as GetSchemaResult<O>;
};
