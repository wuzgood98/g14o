import type {
  Paystack,
  PaystackCustomer,
  PaystackEventName,
  PaystackSubscription,
  PaystackWebhookEvent,
} from "@g14o/paystack";
import type { GenericEndpointContext, InferOptionSchema } from "better-auth";
import type { subscriptions, user, webhookEvents } from "./schema";

/** Billing provider identifier stored on plugin records. */
export type BillingProvider = "paystack";

/** Normalized subscription status used by the plugin database layer. */
export type NormalizedSubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "cancelled"
  | "incomplete";

/** Normalized one-time payment status. */
export type NormalizedPaymentStatus = "pending" | "successful" | "failed";

/** Supported billing intervals for subscription plans. */
export type PlanInterval =
  | "monthly"
  | "annually"
  | "weekly"
  | "daily"
  | "quarterly"
  | "biannually";

/** Supported currencies for subscription plans. */
export type Currency = "GHS" | "NGN" | "ZAR" | "KES" | "USD" | "XOF";

/** Auto-created subscription plan configured in plugin options. */
export interface AutoSubscriptionPlan {
  /**
   * The amount of the plan in the smallest currency unit (Eg: '100' for GHS 1.00)
   * @required
   */
  amount: string;
  /**
   * The annual discounted amount of the plan in the smallest currency unit (Eg: '1000' for GHS 1.00)
   * @default undefined
   */
  annualDiscountedAmount?: string | undefined;
  /**
   * The currency of the plan (Eg: 'GHS', 'NGN', 'ZAR', 'KES', 'USD', 'XOF')
   * @required
   */
  currency: Currency;
  /**
   * The description of the plan
   * @default undefined
   */
  description?: string | undefined;
  /**
   * The interval of the plan (Eg: 'monthly', 'annually')
   * @required
   */
  interval: PlanInterval;
  /**
   * The name of the plan (Eg: 'basic', 'pro')
   * @required
   */
  name: string;
}

/** Pre-created Paystack subscription plan configured in plugin options. */
export interface PrecreatedSubscriptionPlan {
  annualDiscountedPlanCode?: string | undefined;
  name: string;
  planCode: string;
}

/** Forbids keys that are unique to U (relative to T) by typing them as `never`. */
export type Without<T, U> = { [P in Exclude<keyof U, keyof T>]?: never };

/** Subscription plan definition configured in plugin options. */
export type SubscriptionPlan =
  | (AutoSubscriptionPlan &
      Without<AutoSubscriptionPlan, PrecreatedSubscriptionPlan>)
  | (PrecreatedSubscriptionPlan &
      Without<PrecreatedSubscriptionPlan, AutoSubscriptionPlan>);

/** Static plan list or async loader for dynamic plan configuration. */
export type PlansInput =
  | SubscriptionPlan[]
  | (() => Promise<SubscriptionPlan[]>);

/** Plan with normalized name, hydrated billing fields, and resolved Paystack plan codes. */
export interface ResolvedPlan {
  amount: string;
  annualDiscountedAmount?: string | undefined;
  annualDiscountedPlanCode?: string | undefined;
  currency: Currency;
  description?: string | undefined;
  interval: PlanInterval;
  name: string;
  normalizedName: string;
  paystackAnnualPlanCode?: string | undefined;
  paystackPlanCode?: string | undefined;
  planCode?: string | undefined;
}

/** Paystack customer record derived from the user table. */
export interface PaystackCustomerRecord {
  customerCode: string;
  customerId?: number;
  email: string;
  provider: BillingProvider;
  userId: string;
}

/** Paystack subscription record stored in the plugin database. */
export interface PaystackSubscriptionRecord {
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  currentPeriodStart: Date;
  customerCode: string;
  emailToken: string;
  id: string;
  metadata?: Record<string, unknown> | undefined;
  planCode: string;
  planName: string;
  provider: BillingProvider;
  referenceId: string;
  status: NormalizedSubscriptionStatus;
  subscriptionCode: string;
  userId: string;
}

/** Persisted webhook event for deduplication and audit. */
export interface PaystackWebhookEventRecord {
  errorMessage?: string | undefined;
  eventId: string;
  id: string;
  payload: string;
  processedAt: Date | null;
  status: "pending" | "processed" | "failed";
  type: PaystackEventName;
}

/** Context passed to subscription lifecycle hooks. */
export interface SubscriptionLifecycleContext {
  event: PaystackWebhookEvent;
  paystackSubscription: PaystackSubscription;
  plan?: ResolvedPlan | undefined;
  subscription: PaystackSubscriptionRecord;
}

/** Context passed to {@link PaystackSubscriptionOptions.onSubscriptionCancel}. */
export interface SubscriptionCancelContext
  extends SubscriptionLifecycleContext {
  cancellationDetails?: {
    reason?: string | undefined;
    cancelAtPeriodEnd?: boolean | undefined;
  };
}

/** Context passed to customer creation hooks. */
export interface CustomerCreateContext {
  customer: PaystackCustomer;
  user: {
    id: string;
    email: string;
    name?: string | null | undefined;
    [key: string]: unknown;
  };
}

/** @deprecated Use PaystackEventName from `@g14o/paystack`. */
export type PaystackWebhookEventType = PaystackEventName;

export type {
  ChargeSuccessData,
  InvoiceData,
  PaystackEventDataMap,
  PaystackEventName,
  PaystackWebhookEvent,
  SubscriptionCreateData,
  SubscriptionDisableData,
  SubscriptionNotRenewData,
} from "@g14o/paystack";

/** Subscription billing configuration and lifecycle hooks. */
export interface PaystackSubscriptionOptions {
  /** Enable subscription billing.
   * @default false
   */
  enabled?: boolean | undefined;
  /** Fires when a subscription is cancelled (including at period end).
   * @param ctx - The subscription cancel context
   * @returns The void or a promise
   */
  onSubscriptionCancel?: (
    ctx: SubscriptionCancelContext
  ) => Promise<void> | void;
  /** Fires after the first successful payment completes a subscription checkout.
   * @param ctx - The subscription lifecycle context
   * @returns The void or a promise
   */
  onSubscriptionComplete?: (
    ctx: SubscriptionLifecycleContext
  ) => Promise<void> | void;
  /** Fires when Paystack sends `subscription.create`.
   * @param ctx - The subscription lifecycle context
   * @returns The void or a promise
   */
  onSubscriptionCreated?: (
    ctx: SubscriptionLifecycleContext
  ) => Promise<void> | void;
  /** Fires when a subscription is permanently deleted/disabled.
   * @param ctx - The subscription lifecycle context
   * @returns The void or a promise
   */
  onSubscriptionDeleted?: (
    ctx: SubscriptionLifecycleContext
  ) => Promise<void> | void;
  /** Fires on subscription status changes from webhooks or API sync.
   * @param ctx - The subscription lifecycle context
   * @returns The void or a promise
   */
  onSubscriptionUpdate?: (
    ctx: SubscriptionLifecycleContext
  ) => Promise<void> | void;
  plans?: PlansInput | undefined;
}

/**
 * Configuration for the Paystack Better Auth plugin.
 *
 * Provide a pre-built `paystackClient` — not both. Webhook signature verification always uses the
 * resolved secret key.
 *
 * @example Custom client setup
 * ```ts
 * paystack({
 *   paystackClient: new Paystack({
 *     secretKey: process.env.PAYSTACK_SECRET_KEY!,
 *     fetch: customFetch,
 *   }),
 * })
 * ```
 */
export interface PaystackPluginOptions {
  /**
   * Create a Paystack customer automatically when a user signs up.
   * @default undefined (optional)
   */
  createCustomerOnSignUp?: boolean | undefined;
  /**
   * Skip persisting webhook payloads to the database (useful for tests).
   * @default undefined (optional)
   */
  disableWebhookPersistence?: boolean | undefined;
  /**
   * Customize Paystack customer fields before creation.
   * @param user - The user to create a customer for
   * @param authCtx - The authentication context
   * @returns The customer create params
   */
  getCustomerCreateParams?: (
    user: CustomerCreateContext["user"],
    authCtx: GenericEndpointContext
  ) =>
    | Promise<
        Partial<{
          first_name: string;
          last_name: string;
          phone: string;
          metadata: Record<string, unknown>;
        }>
      >
    | Partial<{
        first_name: string;
        last_name: string;
        phone: string;
        metadata: Record<string, unknown>;
      }>;
  /**
   * Called after a Paystack customer is created for a user.
   * @param ctx - The customer create context
   * @param authCtx - The authentication context
   * @returns The void or a promise
   */
  onCustomerCreate?: (
    ctx: CustomerCreateContext,
    authCtx: GenericEndpointContext
  ) => Promise<void> | void;
  /**
   * Called for every verified Paystack webhook event.
   * @param event - The webhook event
   * @returns The void or a promise
   */
  onEvent?: (event: PaystackWebhookEvent) => Promise<void> | void;
  /**
   * The Paystack client to use for authentication.
   * @required
   */
  paystackClient: Paystack;

  /**
   * The schema for the Paystack plugin.
   * @default undefined
   * @example
   * ```ts
   * paystack({
   *   //... other options,
   *   schema: {
   *      user: {
   *        fields: {
   *          paystackCustomerCode: "customerCode", // map paystackCustomerCode to customerCode
   *        },
   *      },
   *      subscription: {
   *        modelName: "paystackSubscription", // map the subscription table to paystackSubscription
   *        fields: {
   *          subscriptionCode: "paystackSubscriptionCode", // map subscriptionCode to paystackSubscriptionCode
   *        },
   *      },
   *   },
   * })
   * ```
   */
  schema?:
    | InferOptionSchema<
        typeof user & typeof subscriptions & typeof webhookEvents
      >
    | undefined;
  /**
   * Subscription billing configuration and lifecycle hooks.
   * @default undefined
   */
  subscription?:
    | {
        enabled: false;
      }
    | ({
        enabled: true;
      } & PaystackSubscriptionOptions)
    | undefined;
}

/** Parameters for server-side authorization charges. */
export interface ChargeCustomerParams {
  /**
   * The amount to charge the customer
   * @required
   */
  amount: number;
  /**
   * The currency to charge the customer
   * @default "GHS"
   */
  currency?: string | undefined;
  /**
   * The metadata to attach to the charge
   * @default undefined
   */
  metadata?: Record<string, unknown> | undefined;
  /**
   * The reference to attach to the charge
   * @default undefined
   */
  reference?: string | undefined;
  /**
   * The user ID to charge
   * @required
   */
  userId: string;
}

/** Result of a server-side authorization charge. */
export interface ChargeCustomerResult {
  /**
   * The amount charged
   * @required
   */
  amount: number;
  /**
   * The currency charged
   * @required
   */
  currency: string;
  /**
   * The reference of the charge
   * @required
   */
  reference: string;
  /**
   * The status of the charge
   * @required
   */
  status: NormalizedPaymentStatus;
}

/** Resolved plugin context after validating and normalizing options. */
export interface PluginContext {
  options: Required<
    Pick<
      PaystackPluginOptions,
      "createCustomerOnSignUp" | "disableWebhookPersistence"
    >
  > &
    PaystackPluginOptions;
}

/** Composite key for plan lookup: `{name}:{interval}`. */
export type PaystackPlanKey = `${string}:${PlanInterval}`;

/** Paystack subscription record stored in the plugin database. */
export interface DbPaystackSubscription {
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd?: Date | string | null;
  currentPeriodStart: Date | string;
  customerCode: string;
  customerId: number;
  emailToken: string;
  id: string;
  metadata?: string | null;
  planCode: string;
  planName: string;
  provider: string;
  referenceId: string;
  status: string;
  subscriptionCode: string;
  userId: string;
}

/** Persisted webhook event for deduplication and audit. */
export interface DbPaystackWebhookEvent {
  errorMessage?: string | null;
  eventId: string;
  id: string;
  payload: string;
  processedAt?: Date | string | null;
  status: string;
  type: string;
}
