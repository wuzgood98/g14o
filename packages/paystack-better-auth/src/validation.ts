import { z } from "zod";

const planIntervalSchemaImpl = z.enum([
  "monthly",
  "annually",
  "weekly",
  "daily",
  "quarterly",
  "biannually",
]);

/**
 * The schema for the subscription plan.
 */
const autoSubscriptionPlanSchemaImpl = z.object({
  /** The name of the plan to subscribe to (Eg: 'basic', 'pro') */
  name: z
    .string()
    .meta({
      description: "The name of the plan to subscribe to (Eg: 'basic', 'pro')",
    })
    .min(1),
  /** The interval of the plan (Eg: 'monthly', 'annually') */
  interval: planIntervalSchemaImpl.meta({
    description: "The interval of the plan (Eg: 'monthly', 'annually')",
  }),
  /** The amount of the plan in the smallest currency unit (Eg: '100' for GHS 1.00) */
  amount: z
    .string()
    .meta({
      description:
        "The amount of the plan in the smallest currency unit (Eg: '100' for GHS 1.00)",
    })
    .min(1),
  /** The currency of the plan (Eg: 'GHS', 'NGN') */
  currency: z
    .string()
    .meta({
      description: "The currency of the plan (Eg: 'GHS', 'NGN')",
    })
    .length(3),
  /** The annual discounted amount of the plan in the smallest currency unit (Eg: '1000' for GHS 1.00) */
  annualDiscountedAmount: z
    .string()
    .meta({
      description:
        "The annual discounted amount of the plan in the smallest currency unit (Eg: '1000' for GHS 1.00)",
    })
    .optional(),
  /** The description of the plan */
  description: z
    .string()
    .meta({
      description: "The description of the plan",
    })
    .optional(),
});

const precreatedSubscriptionPlanSchemaImpl = z.object({
  /** The name of the plan to subscribe to (Eg: 'basic', 'pro') */
  name: z
    .string()
    .meta({
      description: "The name of the plan to subscribe to (Eg: 'basic', 'pro')",
    })
    .min(1),
  /** Pre-created Paystack plan code; billing details are fetched from Paystack */
  planCode: z
    .string()
    .meta({
      description:
        "Pre-created Paystack plan code from your dashboard. Billing details are fetched from Paystack.",
    })
    .min(1),
  /** Pre-created annual Paystack plan code; used when annual: true on upgrade */
  annualDiscountedPlanCode: z
    .string()
    .meta({
      description:
        "Pre-created annual Paystack plan code. Used when subscribing with annual: true.",
    })
    .min(1)
    .optional(),
});

const subscriptionPlanSchemaImpl = z.union([
  autoSubscriptionPlanSchemaImpl,
  precreatedSubscriptionPlanSchemaImpl,
]);

/**
 * The schema for the Paystack plugin options.
 */
const paystackPluginOptionsSchemaImpl = z
  .object({
    /** The secret key to use for authentication. */
    secretKey: z
      .string()
      .meta({
        description:
          "The secret key to use for authentication. Used for server-side requests (Eg: 'sk_test_1234567890')",
      })
      .min(1)
      .optional(),
    /** The public key to use for authentication. */
    publicKey: z
      .string()
      .meta({
        description:
          "The public key to use for authentication. Used for client-side requests (Eg: 'pk_test_1234567890')",
      })
      .optional(),
    /** The Paystack client to use for authentication. */
    paystackClient: z
      .unknown()
      .meta({
        description: "The Paystack client to use for authentication",
      })
      .optional(),
    /** Create a customer on sign up. */
    createCustomerOnSignUp: z
      .boolean()
      .meta({
        description:
          "Whether to create a customer on sign up. If true, a customer will be created for the user when they sign up.",
      })
      .optional(),
    /** Disable webhook persistence. */
    disableWebhookPersistence: z
      .boolean()
      .meta({
        description:
          "Whether to disable webhook persistence. If true, webhook payloads will not be persisted to the database.",
      })
      .default(false),
  })
  .superRefine((value, ctx) => {
    const hasSecretKey = Boolean(value.secretKey);
    const hasClient = value.paystackClient !== undefined;

    if (hasSecretKey && hasClient) {
      ctx.addIssue({
        code: "custom",
        message:
          "Provide either secretKey or paystackClient to the paystack plugin, not both",
      });
    }

    if (!(hasSecretKey || hasClient)) {
      ctx.addIssue({
        code: "custom",
        message:
          "Either secretKey or paystackClient must be provided to the paystack plugin",
      });
    }
  });

/**
 * The schema for the checkout session body.
 */
const checkoutSessionBodySchemaImpl = z.object({
  /**
   * The reference ID for the checkout session.
   * @default undefined
   */
  reference: z
    .string()
    .meta({
      description:
        "The reference ID for the checkout session. Used to identify the checkout session in the database.",
    })
    .optional(),
  /**
   * The amount to charge.
   * @required
   */
  amount: z.number().int().positive().meta({
    description:
      "The amount to charge in the smallest currency unit (Eg: 100 for $1.00)",
  }),
  /**
   * The currency to charge in. (Eg: 'GHS', 'NGN', 'ZAR', 'KES', 'USD', 'XOF')
   * @required
   */
  currency: z.enum(["GHS", "NGN", "ZAR", "KES", "USD", "XOF"]).meta({
    description:
      "The currency to charge in. Used for the checkout session (Eg: 'GHS', 'NGN', 'ZAR', 'KES', 'USD', 'XOF')",
  }),
  /**
   * The email to charge.
   * @required
   */
  email: z
    .email()
    .meta({
      description:
        "The email to charge. Used for the checkout session (Eg: 'test@example.com')",
    })
    .optional(),
  /**
   * The metadata to attach to the checkout session.
   * @default undefined
   */
  metadata: z
    .record(z.string(), z.unknown())
    .meta({
      description:
        "The metadata to attach to the checkout session. Used to identify the checkout session in the database.",
    })
    .optional(),
  /**
   * The URL to redirect to after the checkout session.
   * @default undefined
   */
  callbackUrl: z
    .url()
    .meta({
      description:
        "The URL to redirect to after the checkout session. Used to redirect the user after the checkout session.",
    })
    .optional(),
  /**
   * The URL to redirect to after cancelling the authorization process.
   * @default undefined
   */
  cancelActionUrl: z
    .url()
    .meta({
      description:
        "The URL to redirect to after cancelling the authorization process.",
    })
    .optional(),
  /**
   * Disable redirect after checkout session.
   * @default false
   */
  disableRedirect: z
    .boolean()
    .meta({
      description:
        "Whether to disable redirect after the checkout session. If true, the user will not be redirected after the checkout session.",
    })
    .default(false),
  /**
   * The channels to use for the checkout session.
   * @default ["card", "mobile_money"]
   */
  channels: z
    .array(
      z.enum(["card", "bank", "mobile_money", "bank_transfer", "apple_pay"])
    )
    .meta({
      description:
        "The channels to use for the checkout session. Used to specify the channels to use for the checkout session.",
    })
    .optional()
    .default(["card", "mobile_money"]),
});

/**
 * The schema for the upgrade body.
 */
const upgradeBodySchemaImpl = z.object({
  /**
   * The plan code to upgrade to.
   * @required
   */
  plan: z.string().min(1).meta({
    description: "The plan code to upgrade to. (Eg: 'basic', 'pro')",
  }),
  /**
   * If annual plan should be applied
   * @default undefined
   */
  annual: z
    .boolean()
    .meta({
      description:
        "Whether to subscribe to an annual plan. If true, the annual plan will be applied.",
    })
    .optional(),
  /**
   * The URL to redirect to after successful subscription.
   * @required
   */
  callbackUrl: z.url().meta({
    description:
      "The URL to redirect to after successful subscription. Used to redirect the user after the subscription checkout.",
  }),
  /**
   * The URL to redirect to after cancelling the authorization process.
   * @default undefined
   */
  cancelActionUrl: z
    .url()
    .meta({
      description:
        "The URL to redirect to after cancelling the authorization process.",
    })
    .optional(),
  /**
   * The reference ID for the subscription.
   * @default undefined
   */
  reference: z
    .string()
    .meta({
      description:
        "The reference ID for the subscription. Used to identify the subscription in the database.",
    })
    .optional(),
  /**
   * The subscription code for the subscription to upgrade.
   * @default undefined
   */
  subscriptionCode: z
    .string()
    .meta({
      description:
        "The subscription code for the subscription. Used to identify the subscription in the database.",
    })
    .optional(),
  /**
   * The metadata to attach to the subscription.
   * @default undefined
   */
  metadata: z
    .record(z.string(), z.unknown())
    .meta({
      description:
        "The metadata to attach to the subscription. Used to identify the subscription in the database.",
    })
    .optional(),
  /**
   * Disable redirect after subscription checkout.
   * @default false
   */
  disableRedirect: z
    .boolean()
    .meta({
      description:
        "Whether to disable redirect after the subscription checkout. If true, the user will not be redirected after the subscription checkout.",
    })
    .default(false),
  /**
   * The channels to use for the subscription checkout.
   * @default ["card", "mobile_money"]
   */
  channels: z
    .array(
      z.enum(["card", "bank", "mobile_money", "bank_transfer", "apple_pay"])
    )
    .meta({
      description:
        "The channels to use for the subscription checkout. Used to specify the channels to use for the subscription checkout.",
    })
    .optional()
    .default(["card", "mobile_money"]),
});

/**
 * The schema for the subscription action body.
 */
const subscriptionActionBodySchemaImpl = z.object({
  /**
   * The reference ID for the subscription.
   * @default undefined
   */
  reference: z
    .string()
    .meta({
      description:
        "The reference ID for the subscription. Used to identify the subscription in the database.",
    })
    .optional(),
  /**
   * The subscription code for the subscription.
   * @default undefined
   */
  subscriptionCode: z
    .string()
    .meta({
      description:
        "The subscription code for the subscription. Used to identify the subscription in the database.",
    })
    .optional(),
});

/**
 * The schema for the list active subscriptions body.
 * Get the user's active subscriptions.
 * @required
 */
const listActiveSubscriptionsBodySchemaImpl = z.object({
  /**
   * The page number to return.
   * @default 1
   */
  page: z
    .number()
    .int()
    .positive()
    .meta({
      description:
        "The page number to return. Used to paginate the subscriptions.",
    })
    .optional()
    .default(1),
  /**
   * The number of subscriptions to return per page.
   * @default 10
   */
  perPage: z
    .number()
    .int()
    .positive()
    .meta({
      description:
        "The number of subscriptions to return per page. Used to paginate the subscriptions.",
    })
    .optional()
    .default(10),
  /**
   * The customer ID to filter subscriptions by.
   * @default undefined
   */
  customer: z
    .number()
    .int()
    .positive()
    .meta({
      description:
        "The customer ID to filter subscriptions by. Used to filter the subscriptions.",
    })
    .optional()
    .nullable(),
  /**
   * The plan ID to filter subscriptions by.
   * @default undefined
   */
  plan: z
    .number()
    .int()
    .positive()
    .meta({
      description:
        "The plan ID to filter subscriptions by. Used to filter the subscriptions.",
    })
    .optional()
    .nullable(),
});

/**
 * The schema for the charge authorization body.
 */
const chargeAuthorizationBodySchemaImpl = z.object({
  /**
   * The user ID to charge.
   * @default undefined
   */
  userId: z
    .string()
    .meta({
      description:
        "The user ID to charge. Used to identify the user in the database.",
    })
    .optional(),
  /**
   * The amount to charge.
   * @required
   */
  amount: z.number().int().positive().meta({
    description:
      "The amount to charge in the smallest currency unit (Eg: 100 for $1.00)",
  }),
  /**
   * The currency to charge in. Used for the charge authorization (Eg: 'GHS', 'NGN')
   * @default undefined
   */
  currency: z
    .string()
    .length(3)
    .meta({
      description:
        "The currency to charge in. Used for the charge authorization (Eg: 'GHS', 'NGN')",
    })
    .optional(),
  /**
   * The reference ID for the charge authorization.
   * @default undefined
   */
  reference: z
    .string()
    .meta({
      description:
        "The reference ID for the charge authorization. Used to identify the charge authorization in the database.",
    })
    .optional(),
  /**
   * The metadata to attach to the charge authorization.
   * @default undefined
   */
  metadata: z
    .record(z.string(), z.unknown())
    .meta({
      description:
        "The metadata to attach to the charge authorization. Used to identify the charge authorization in the database.",
    })
    .optional(),
});

/**
 * The schema for the customer action body.
 */
const customerActionBodySchemaImpl = z.object({
  /**
   * The user ID to perform the action on.
   * @default undefined
   */
  userId: z
    .string()
    .meta({
      description:
        "The user ID to perform the action on. Used to identify the user in the database.",
    })
    .optional(),
});

/**
 * The schema for the Paystack webhook payload.
 */
const paystackWebhookPayloadSchemaImpl = z.object({
  /**
   * The event that occurred. eg: 'charge.success'
   * @required
   */
  event: z
    .string()
    .meta({
      description:
        "The event that occurred. Used to identify the event in the database. eg: 'charge.success'",
    })
    .min(1),
  /**
   * The data associated with the event.
   * @required
   */
  data: z.record(z.string(), z.unknown()).meta({
    description:
      "The data associated with the event. Used to identify the data in the database.",
  }),
});

export type PaystackWebhookPayload = z.infer<
  typeof paystackWebhookPayloadSchemaImpl
>;

/**
 * The schema for the disable subscription params.
 */
export const disableSubscriptionParamsSchema = z.object({
  /**
   * The code of the subscription to disable.
   * @required
   */
  code: z
    .string()
    .meta({
      description: "The code of the subscription to disable.",
    })
    .min(1),
  /**
   * The token of the subscription to disable.
   * @required
   */
  token: z
    .string()
    .meta({
      description: "The token of the subscription to disable.",
    })
    .min(1),
});

export type DisableSubscriptionParams = z.infer<
  typeof disableSubscriptionParamsSchema
>;

export const planIntervalSchema = planIntervalSchemaImpl;
export const subscriptionPlanSchema = subscriptionPlanSchemaImpl;
export const paystackPluginOptionsSchema = paystackPluginOptionsSchemaImpl;
export const checkoutSessionBodySchema = checkoutSessionBodySchemaImpl;
export const upgradeBodySchema = upgradeBodySchemaImpl;
export const subscriptionActionBodySchema = subscriptionActionBodySchemaImpl;
export const listActiveSubscriptionsBodySchema =
  listActiveSubscriptionsBodySchemaImpl;
export const chargeAuthorizationBodySchema = chargeAuthorizationBodySchemaImpl;
export const customerActionBodySchema = customerActionBodySchemaImpl;
export const paystackWebhookPayloadSchema = paystackWebhookPayloadSchemaImpl;
