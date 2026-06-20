import { createHmac, timingSafeEqual } from "node:crypto";
import type { z } from "zod";
import {
  type DisableSubscriptionParams,
  disableSubscriptionParamsSchema,
} from "../validation";
import {
  type PaystackWebhookEvent,
  parsePaystackWebhookEvent,
} from "../webhook-events";
import { PaystackError, WebhookVerificationError } from "./errors";
import { PaystackHttpClient } from "./http";
import {
  type PaystackCustomer,
  type PaystackInitializeTransaction,
  type PaystackPlan,
  type PaystackSubscription,
  type PaystackTransaction,
  paystackCustomerSchema,
  paystackInitializeTransactionSchema,
  paystackPlanListSchema,
  paystackPlanSchema,
  paystackResponseEnvelopeSchema,
  paystackSubscriptionSchema,
  paystackTransactionSchema,
} from "./responses";
import type {
  ChargeAuthorizationParams,
  CreateCustomerParams,
  CreatePlanParams,
  CreateSubscriptionParams,
  InitializeTransactionParams,
  PaystackClient,
  PaystackClientOptions,
} from "./types";
import {
  type ProcessWebhookDeliveryRequestOptions,
  type ProcessWebhookDeliveryResult,
  processWebhookDelivery,
} from "./webhook-delivery";

/**
 * Parses a Paystack API response envelope.
 * @internal
 */
const parseEnvelope = <T>(schema: z.ZodType<T>, response: unknown): T => {
  const envelope = paystackResponseEnvelopeSchema(schema).safeParse(response);

  if (!envelope.success) {
    throw new PaystackError("Invalid Paystack API response shape", {
      code: "PAYSTACK_VALIDATION_ERROR",
      cause: envelope.error,
    });
  }

  if (!envelope.data.status) {
    throw new PaystackError(envelope.data.message, {
      code: "PAYSTACK_API_ERROR",
      paystackMessage: envelope.data.message,
    });
  }

  return envelope.data.data;
};

/**
 * Asserts an object to a record of string keys and unknown values.
 * @internal
 */
const asBody = (value: object): Record<string, unknown> =>
  value as Record<string, unknown>;

/**
 * Paystack REST API client with retries, timeouts, and Zod-validated responses.
 *
 * @example
 * ```ts
 * const paystack = new Paystack({ secretKey: process.env.PAYSTACK_SECRET_KEY! });
 * const tx = await paystack.transactions.initialize({ email: "user@example.com", amount: 1500 });
 * ```
 */
export class Paystack implements PaystackClient {
  /**
   * Secret key used for API auth and webhook signature verification.
   * @required
   */
  readonly secretKey: string;
  /**
   * Optional public key for client-side integrations.
   * @default undefined
   */
  readonly publicKey: string | undefined;
  private readonly http: PaystackHttpClient;

  /**
   * Customer management endpoints (`/customer`).
   */
  readonly customers: {
    /**
     * Create a new customer.
     * @param params - The parameters for creating a customer.
     * @param params.email - The email address of the customer.
     * @param params.first_name - The first name of the customer.
     * @param params.last_name - The last name of the customer.
     * @param params.metadata - Additional metadata about the customer.
     * @param params.phone - The phone number of the customer.
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
     * @param query.perPage - The number of customers to return per page.
     * @param query.page - The page number to return.
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
   * Transaction endpoints (`/transaction`).
   */
  readonly transactions: {
    /**
     * Initialize a transaction.
     * @param params - The parameters for initializing a transaction.
     * @param params.amount - The amount to charge in the subunit of the currency (Eg: 100 for GHS1.00).
     * @param params.callback_url - The callback URL to be called after the transaction is completed.
     * @param params.channels - The channels to be used for the transaction. eg: ["card", "bank", "mobile_money", "bank_transfer", "apple_pay"]
     * @param params.currency - The currency of the transaction.
     * @param params.email - The email address of the customer.
     * @param params.metadata - Additional metadata about the transaction.
     * @param params.plan - The plan to be used for the transaction.
     * @param params.reference - The reference to be used for the transaction.
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
     * @param params.amount - The amount to charge.
     * @param params.authorization_code - The authorization code to be used for the transaction.
     * @param params.currency - The currency of the transaction.
     * @param params.email - The email address of the customer.
     * @param params.metadata - Additional metadata about the transaction.
     * @param params.reference - The reference to be used for the transaction.
     * @returns The charged transaction.
     */
    chargeAuthorization: (
      params: ChargeAuthorizationParams
    ) => Promise<PaystackTransaction>;
  };

  /**
   * Plan endpoints (`/plan`). Annual billing uses separate plan codes.
   */
  readonly plans: {
    /**
     * Create a new plan.
     * @param params - The parameters for creating a plan.
     * @param params.amount - The amount to charge.
     * @param params.currency - The currency of the transaction.
     * @param params.description - The description of the plan.
     * @param params.interval - The interval of the plan.
     * @param params.invoice_limit - The invoice limit of the plan.
     * @param params.name - The name of the plan.
     * @param params.send_invoices - Whether to send invoices for the plan.
     * @param params.send_sms - Whether to send SMS for the plan.
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
     * @param query.perPage - The number of plans to return per page.
     * @param query.page - The page number to return.
     * @returns The list of plans.
     */
    list: (query?: {
      perPage?: number;
      page?: number;
    }) => Promise<PaystackPlan[]>;
  };

  /**
   * Subscription endpoints (`/subscription`). Cancel/resume require stored `emailToken`.
   */
  readonly subscriptions: {
    /**
     * Create a new subscription.
     * @param params - The parameters for creating a subscription.
     * @param params.authorization - The authorization code to be used for the subscription.
     * @param params.customer - The customer code to be used for the subscription.
     * @param params.plan - The plan code to be used for the subscription.
     * @param params.start_date - The start date of the subscription.
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
     * @param params.code - The code of the subscription to disable.
     * @param params.token - The token of the subscription to disable.
     * @returns The disabled subscription.
     */
    disable: (params: DisableSubscriptionParams) => Promise<unknown>;
    /**
     * Enable a subscription.
     * @param params - The parameters for enabling a subscription.
     * @param params.code - The code of the subscription to enable.
     * @param params.token - The token of the subscription to enable.
     * @returns The enabled subscription.
     */
    enable: (params: DisableSubscriptionParams) => Promise<unknown>;
    /**
     * List all subscriptions.
     * @param query - The query parameters for listing subscriptions.
     * @param query.perPage - The number of subscriptions to return per page.
     * @param query.page - The page number to return.
     * @param query.customer - The customer ID to filter subscriptions by.
     * @param query.plan - The plan ID to filter subscriptions by.
     * @returns The list of subscriptions.
     */
    list: (query?: {
      perPage?: number | undefined | null;
      page?: number | undefined | null;
      customer?: number | null | undefined;
      plan?: number | null | undefined;
    }) => Promise<PaystackSubscription[]>;
  };

  /**
   * Webhook verification helpers.
   */
  readonly webhook: {
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

  constructor(options: PaystackClientOptions) {
    this.secretKey = options.secretKey;
    this.publicKey = options.publicKey;
    this.http = new PaystackHttpClient({
      secretKey: options.secretKey,
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      timeoutMs: options.timeoutMs,
      maxRetries: options.maxRetries,
    });

    this.customers = {
      create: async (params) => {
        const response = await this.http.request({
          method: "POST",
          path: "/customer",
          body: asBody(params),
        });
        return parseEnvelope(paystackCustomerSchema, response);
      },
      fetch: async (emailOrCode) => {
        const response = await this.http.request({
          method: "GET",
          path: `/customer/${encodeURIComponent(emailOrCode)}`,
        });
        return parseEnvelope(paystackCustomerSchema, response);
      },
      list: async (query) => {
        const response = await this.http.request({
          method: "GET",
          path: "/customer",
          query: {
            perPage: query?.perPage,
            page: query?.page,
          },
        });
        return parseEnvelope(paystackCustomerSchema.array(), response);
      },
      update: async (customerCode, params) => {
        const response = await this.http.request({
          method: "PUT",
          path: `/customer/${encodeURIComponent(customerCode)}`,
          body: asBody(params),
        });
        return parseEnvelope(paystackCustomerSchema, response);
      },
    };

    this.transactions = {
      initialize: async (params) => {
        const response = await this.http.request({
          method: "POST",
          path: "/transaction/initialize",
          body: asBody(params),
        });
        return parseEnvelope(paystackInitializeTransactionSchema, response);
      },
      verify: async (reference) => {
        const response = await this.http.request({
          method: "GET",
          path: `/transaction/verify/${encodeURIComponent(reference)}`,
        });
        return parseEnvelope(paystackTransactionSchema, response);
      },
      chargeAuthorization: async (params) => {
        const response = await this.http.request({
          method: "POST",
          path: "/transaction/charge_authorization",
          body: asBody(params),
        });
        return parseEnvelope(paystackTransactionSchema, response);
      },
    };

    this.plans = {
      create: async (params) => {
        const response = await this.http.request({
          method: "POST",
          path: "/plan",
          body: asBody(params),
        });
        return parseEnvelope(paystackPlanSchema, response);
      },
      fetch: async (idOrCode) => {
        const response = await this.http.request({
          method: "GET",
          path: `/plan/${encodeURIComponent(String(idOrCode))}`,
        });
        return parseEnvelope(paystackPlanSchema, response);
      },
      list: async (query) => {
        const response = await this.http.request({
          method: "GET",
          path: "/plan",
          query: {
            perPage: query?.perPage,
            page: query?.page,
          },
        });
        const parsed = paystackPlanListSchema.safeParse(response);
        if (!parsed.success) {
          throw new PaystackError("Invalid Paystack API response shape", {
            code: "PAYSTACK_VALIDATION_ERROR",
            cause: parsed.error,
          });
        }
        return parsed.data.data;
      },
    };

    this.subscriptions = {
      create: async (params) => {
        const response = await this.http.request({
          method: "POST",
          path: "/subscription",
          body: asBody(params),
        });
        return parseEnvelope(paystackSubscriptionSchema, response);
      },
      fetch: async (code) => {
        const response = await this.http.request({
          method: "GET",
          path: `/subscription/${encodeURIComponent(code)}`,
        });
        return parseEnvelope(paystackSubscriptionSchema, response);
      },
      disable: async (params) =>
        this.http.request({
          method: "POST",
          path: "/subscription/disable",
          body: asBody(params),
          onPayloadValidationBeforeSending: (payload) => {
            const result = disableSubscriptionParamsSchema.safeParse(payload);
            if (!result.success) {
              throw new PaystackError("Invalid payload", {
                code: "PAYSTACK_VALIDATION_ERROR",
                cause: result.error,
                statusCode: 400,
              });
            }
          },
        }),
      enable: async (params) =>
        this.http.request({
          method: "POST",
          path: "/subscription/enable",
          body: asBody(params),
          onPayloadValidationBeforeSending: (payload) => {
            const result = disableSubscriptionParamsSchema.safeParse(payload);
            if (!result.success) {
              throw new PaystackError("Invalid payload", {
                code: "PAYSTACK_VALIDATION_ERROR",
                cause: result.error,
                statusCode: 400,
              });
            }
          },
        }),
      list: async (query) => {
        const response = await this.http.request({
          method: "GET",
          path: "/subscription",
          query: {
            perPage: query?.perPage,
            page: query?.page,
            customer: query?.customer,
            plan: query?.plan,
          },
        });
        return parseEnvelope(paystackSubscriptionSchema.array(), response);
      },
    };

    this.webhook = {
      verifyPaystackWebhookSignature: (rawBody, signature) => {
        if (!signature) {
          throw new WebhookVerificationError(
            "Missing x-paystack-signature header",
            "WEBHOOK_MISSING_SIGNATURE"
          );
        }

        const hash = createHmac("sha512", this.secretKey)
          .update(rawBody)
          .digest("hex");

        const signatureBuffer = Buffer.from(signature);
        const hashBuffer = Buffer.from(hash);

        if (
          signatureBuffer.length !== hashBuffer.length ||
          !timingSafeEqual(signatureBuffer, hashBuffer)
        ) {
          throw new WebhookVerificationError(
            "Invalid webhook signature",
            "WEBHOOK_INVALID_SIGNATURE"
          );
        }
      },
      verifyWebhookRequest: async (request) => {
        if (!request?.body) {
          throw new PaystackError("Invalid request body", {
            code: "PAYSTACK_VALIDATION_ERROR",
            cause: new Error("Request body is required"),
            statusCode: 400,
          });
        }

        const signature = request.headers.get("x-paystack-signature");
        if (!signature) {
          throw new PaystackError("Webhook signature not found", {
            code: "PAYSTACK_VALIDATION_ERROR",
            cause: new Error("Webhook signature is required"),
            statusCode: 400,
          });
        }

        const rawBody = await request.text();

        try {
          this.webhook.verifyPaystackWebhookSignature(rawBody, signature);
        } catch (error) {
          if (error instanceof WebhookVerificationError) {
            throw new PaystackError("Webhook verification failed", {
              code: "PAYSTACK_VALIDATION_ERROR",
              cause: error,
              statusCode: 400,
            });
          }
          throw error;
        }

        return rawBody;
      },
      parseWebhookPayload: (rawBody) => {
        let parsedBody: unknown;

        try {
          parsedBody = JSON.parse(rawBody);
        } catch (error) {
          throw new PaystackError("Invalid webhook payload", {
            code: "PAYSTACK_VALIDATION_ERROR",
            cause: error,
            statusCode: 400,
          });
        }

        try {
          return parsePaystackWebhookEvent(parsedBody);
        } catch (error) {
          throw new PaystackError("Invalid webhook payload", {
            code: "PAYSTACK_VALIDATION_ERROR",
            cause: error,
            statusCode: 400,
          });
        }
      },
      processWebhookDelivery: async (request, options) => {
        const rawBody = await this.webhook.verifyWebhookRequest(request);
        const event = this.webhook.parseWebhookPayload(rawBody);
        return processWebhookDelivery({ event, rawBody, ...options });
      },
      processWebhookRequest: async (request) => {
        const rawBody = await this.webhook.verifyWebhookRequest(request);
        return this.webhook.parseWebhookPayload(rawBody);
      },
    };
  }
}

export type {
  ChargeAuthorizationParams,
  CreateCustomerParams,
  CreatePlanParams,
  CreateSubscriptionParams,
  DisableSubscriptionParams,
  InitializeTransactionParams,
  PaystackClient,
  PaystackClientOptions,
} from "./types";
export type {
  ProcessWebhookDeliveryOptions,
  ProcessWebhookDeliveryRequestOptions,
  ProcessWebhookDeliveryResult,
  WebhookDeliveryStore,
} from "./webhook-delivery";
// biome-ignore lint/performance/noBarrelFile: re-export for convenience
export {
  createWebhookEventId,
  processWebhookDelivery,
} from "./webhook-delivery";
