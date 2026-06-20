import type { PaystackWebhookEvent } from "../webhook-events";
import type {
  PaystackCustomer,
  PaystackInitializeTransaction,
  PaystackPlan,
  PaystackSubscription,
  PaystackTransaction,
} from "./responses";
import type {
  ProcessWebhookDeliveryRequestOptions,
  ProcessWebhookDeliveryResult,
} from "./webhook-delivery";

/** Paystack client interface. */
export interface PaystackClient {
  /**
   * Customer management endpoints.
   */
  customers: {
    /**
     * Create a new customer.
     * @param params - The parameters for creating a customer.
     * @returns The created customer.
     */
    create: (params: CreateCustomerParams) => Promise<PaystackCustomer>;
    /**
     * Fetch a customer by email or code.
     * @param emailOrCode - The email or code of the customer.
     * @returns The customer.
     */
    fetch: (emailOrCode: string) => Promise<PaystackCustomer>;
    /**
     * List all customers.
     * @param query - The query parameters for listing customers.
     * @returns The list of customers.
     */
    list: (query?: {
      perPage?: number;
      page?: number;
    }) => Promise<PaystackCustomer[]>;
    /**
     * Update a customer.
     * @param customerCode - The code of the customer to update.
     * @param params - The parameters for updating the customer.
     * @returns The updated customer.
     */
    update: (
      customerCode: string,
      params: Partial<CreateCustomerParams>
    ) => Promise<PaystackCustomer>;
  };
  /**
   * Plan management endpoints.
   */
  plans: {
    /**
     * Create a new plan.
     * @param params - The parameters for creating a plan.
     * @returns The created plan.
     */
    create: (params: CreatePlanParams) => Promise<PaystackPlan>;
    /**
     * Fetch a plan by ID or code.
     * @param idOrCode - The ID or code of the plan.
     * @returns The plan.
     */
    fetch: (idOrCode: string | number) => Promise<PaystackPlan>;
    /**
     * List all plans.
     * @param query - The query parameters for listing plans.
     * @returns The list of plans.
     */
    list: (query?: {
      perPage?: number;
      page?: number;
    }) => Promise<PaystackPlan[]>;
  };
  /**
   * Subscription management endpoints.
   */
  subscriptions: {
    /**
     * Create a new subscription.
     * @param params - The parameters for creating a subscription.
     * @returns The created subscription.
     */
    create: (params: CreateSubscriptionParams) => Promise<PaystackSubscription>;
    /**
     * Fetch a subscription by code.
     * @param code - The code of the subscription.
     * @returns The subscription.
     */
    fetch: (code: string | number) => Promise<PaystackSubscription>;
    /**
     * Disable a subscription.
     * @param params - The parameters for disabling a subscription.
     * @returns The disabled subscription.
     */
    disable: (params: DisableSubscriptionParams) => Promise<unknown>;
    /**
     * Enable a subscription.
     * @param params - The parameters for enabling a subscription.
     * @returns The enabled subscription.
     */
    enable: (params: DisableSubscriptionParams) => Promise<unknown>;
    /**
     * List all subscriptions.
     * @param query - The query parameters for listing subscriptions.
     * @returns The list of subscriptions.
     */
    list: (query?: {
      perPage?: number;
      page?: number;
      customer?: number;
      plan?: number;
    }) => Promise<PaystackSubscription[]>;
  };
  /**
   * Transaction management endpoints.
   */
  transactions: {
    /**
     * Initialize a transaction.
     * @param params - The parameters for initializing a transaction.
     * @returns The initialized transaction.
     */
    initialize: (
      params: InitializeTransactionParams
    ) => Promise<PaystackInitializeTransaction>;
    /**
     * Verify a transaction.
     * @param reference - The reference of the transaction.
     * @returns The verified transaction.
     */
    verify: (reference: string) => Promise<PaystackTransaction>;
    /**
     * Charge an authorization code.
     * @param params - The parameters for charging an authorization code.
     * @returns The charged transaction.
     */
    chargeAuthorization: (
      params: ChargeAuthorizationParams
    ) => Promise<PaystackTransaction>;
  };
  /**
   * Webhook verification helpers.
   */
  webhook: {
    /**
     * Verify `x-paystack-signature` for a raw webhook body.
     * Uses the client's secretKey. Throws WebhookVerificationError on failure.
     */
    verifyPaystackWebhookSignature: (
      rawBody: string,
      signature: string | null | undefined
    ) => void;
    /**
     * Verify a Paystack webhook request.
     * @param request - The request to verify.
     * @returns The parsed webhook payload from the verified request body.
     */
    verifyWebhookRequest: (
      request: Request | null | undefined
    ) => Promise<string>;
    /**
     * Parse a Paystack webhook payload.
     * @param rawBody - The raw body of the webhook request.
     * @returns The parsed webhook payload.
     */
    parseWebhookPayload: (rawBody: string) => PaystackWebhookEvent;
    /**
     * Verify, parse, and process a Paystack webhook request with deduplication.
     * @param request - The request to process.
     * @param options - Handler and optional persistence store.
     * @returns Whether the delivery was a duplicate and the parsed event.
     */
    processWebhookDelivery: (
      request: Request | null | undefined,
      options: ProcessWebhookDeliveryRequestOptions
    ) => Promise<ProcessWebhookDeliveryResult>;
    /**
     * Process a Paystack webhook request.
     * @param request - The request to process.
     * @returns The processed webhook payload.
     */
    processWebhookRequest: (
      request: Request | null | undefined
    ) => Promise<PaystackWebhookEvent>;
  };
}

/** Options for constructing a {@link Paystack} API client. */
export interface PaystackClientOptions {
  /**
   * Override the Paystack API base URL (defaults to `https://api.paystack.co`).
   * @default https://api.paystack.co
   */
  baseUrl?: string | undefined;
  /**
   * Custom fetch implementation (useful for tests or proxies).
   * @default fetch
   */
  fetch?: typeof fetch | undefined;
  /**
   * Maximum retry attempts on transient failures (default: 3).
   * @default 3
   */
  maxRetries?: number | undefined;
  /**
   * Public key for client-side Paystack Popup integrations.
   * @default undefined
   */
  publicKey?: string | undefined;
  /**
   * Secret key used for API authentication and webhook HMAC verification.
   * @required
   */
  secretKey: string;
  /**
   * Request timeout in milliseconds.
   * @default 30000
   */
  timeoutMs?: number | undefined;
}

/** Parameters for creating a Paystack customer. */
export interface CreateCustomerParams {
  /**
   * The email address of the customer.
   * @required
   */
  email: string;
  /**
   * The first name of the customer.
   * @default undefined
   */
  first_name?: string | undefined;
  /**
   * The last name of the customer.
   * @default undefined
   */
  last_name?: string | undefined;
  /**
   * Additional metadata about the customer.
   * @default undefined
   */
  metadata?: Record<string, unknown> | undefined;
  /**
   * The phone number of the customer.
   * @default undefined
   */
  phone?: string | undefined;
}

/** Parameters for initializing a hosted checkout transaction. */
export interface InitializeTransactionParams {
  /**
   * The amount to charge.
   * @required
   */
  amount: number;
  /**
   * The callback URL to be called after the transaction is completed.
   * @default undefined
   */
  callback_url?: string | undefined;
  /**
   * The channels to be used for the transaction.
   * @default undefined
   */
  channels?:
    | Array<"card" | "bank" | "mobile_money" | "bank_transfer" | "apple_pay">
    | undefined;
  /**
   * The currency of the transaction.
   * @default undefined
   */
  currency?: string | undefined;
  /**
   * The email address of the customer.
   * @required
   */
  email: string;
  /**
   * Additional metadata about the transaction.
   * @default undefined
   */
  metadata?: Record<string, unknown> | undefined;
  /**
   * The plan to be used for the transaction.
   * @default undefined
   */
  plan?: string | undefined;
  /**
   * The reference to be used for the transaction.
   * @default undefined
   */
  reference?: string | undefined;
}

/** Parameters for charging a saved authorization code. */
export interface ChargeAuthorizationParams {
  /**
   * The amount to charge.
   * @required
   */
  amount: number;
  /**
   * The authorization code to be used for the transaction.
   * @required
   */
  authorization_code: string;
  /**
   * The currency of the transaction.
   * @default undefined
   */
  currency?: string | undefined;
  /**
   * The email address of the customer.
   * @required
   */
  email: string;
  /**
   * Additional metadata about the transaction.
   * @default undefined
   */
  metadata?: Record<string, unknown> | undefined;
  /**
   * The reference to be used for the transaction.
   * @default undefined
   */
  reference?: string | undefined;
}

/** Parameters for creating a Paystack subscription plan. */
export interface CreatePlanParams {
  /**
   * The amount to charge.
   * @required
   */
  amount: number;
  /**
   * The currency of the transaction.
   * @default undefined
   */
  currency?: string | undefined;
  /**
   * The description of the plan.
   * @default undefined
   */
  description?: string | undefined;
  /**
   * The interval of the plan.
   * @required
   */
  interval: string;
  /**
   * The invoice limit of the plan.
   * @default undefined
   */
  invoice_limit?: number | undefined;
  /**
   * The name of the plan.
   * @required
   */
  name: string;
  /**
   * Whether to send invoices for the plan.
   * @default undefined
   */
  send_invoices?: boolean | undefined;
  /**
   * Whether to send SMS for the plan.
   * @default undefined
   */
  send_sms?: boolean | undefined;
}

/** Parameters for creating a Paystack subscription. */
export interface CreateSubscriptionParams {
  /**
   * The authorization code to be used for the subscription.
   * @default undefined
   */
  authorization?: string | undefined;
  /**
   * The customer code to be used for the subscription.
   * @required
   */
  customer: string;
  /**
   * The plan code to be used for the subscription.
   * @required
   */
  plan: string;
  /**
   * The start date of the subscription.
   * @default undefined
   */
  start_date?: string | undefined;
}

/** Parameters for disabling or re-enabling a subscription (requires `emailToken`). */
export interface DisableSubscriptionParams {
  /**
   * The code of the subscription to disable.
   * @required
   */
  code: string;
  /**
   * The token of the subscription to disable.
   * @required
   */
  token: string;
}
