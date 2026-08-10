import { z } from "zod";
import { disableSubscriptionParamsSchema } from "../validation";
import { asBody, callPaystack } from "./call-paystack";
import { PaystackHttpClient } from "./http";
import {
  paystackCustomerSchema,
  paystackInitializeTransactionSchema,
  paystackPlanSchema,
  paystackSubscriptionSchema,
  paystackTransactionSchema,
} from "./responses";
import type { PaystackClient, PaystackClientOptions } from "./types";
import {
  parseWebhookPayload,
  processWebhookDeliveryFromRequest,
  processWebhookRequest,
  verifyPaystackWebhookSignature,
  verifyWebhookRequest,
} from "./webhook-delivery";

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
   * Optional public key for client-side integrations.
   * @default undefined
   */
  readonly publicKey: string | undefined;
  readonly #secretKey: string;
  private readonly http: PaystackHttpClient;

  /**
   * Customer management endpoints (`/customer`).
   */
  readonly customers: PaystackClient["customers"];

  /**
   * Transaction endpoints (`/transaction`).
   */
  readonly transactions: PaystackClient["transactions"];

  /**
   * Plan endpoints (`/plan`). Annual billing uses separate plan codes.
   */
  readonly plans: PaystackClient["plans"];

  /**
   * Subscription endpoints (`/subscription`). Cancel/resume require stored `emailToken`.
   */
  readonly subscriptions: PaystackClient["subscriptions"];

  /**
   * Webhook verification helpers.
   */
  readonly webhook: PaystackClient["webhook"];

  constructor(options: PaystackClientOptions) {
    this.#secretKey = options.secretKey;
    this.publicKey = options.publicKey;
    this.http = new PaystackHttpClient({
      secretKey: options.secretKey,
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      timeoutMs: options.timeoutMs,
      maxRetries: options.maxRetries,
    });

    this.customers = {
      create: (params) =>
        callPaystack(this.http, {
          method: "POST",
          path: "/customer",
          body: asBody(params),
          dataSchema: paystackCustomerSchema,
        }),
      fetch: (emailOrCode) =>
        callPaystack(this.http, {
          method: "GET",
          path: `/customer/${encodeURIComponent(emailOrCode)}`,
          dataSchema: paystackCustomerSchema,
        }),
      list: (query) =>
        callPaystack(this.http, {
          method: "GET",
          path: "/customer",
          query: {
            perPage: query?.perPage,
            page: query?.page,
          },
          dataSchema: paystackCustomerSchema.array(),
        }),
      update: (customerCode, params) =>
        callPaystack(this.http, {
          method: "PUT",
          path: `/customer/${encodeURIComponent(customerCode)}`,
          body: asBody(params),
          dataSchema: paystackCustomerSchema,
        }),
    };

    this.transactions = {
      initialize: (params) =>
        callPaystack(this.http, {
          method: "POST",
          path: "/transaction/initialize",
          body: asBody(params),
          dataSchema: paystackInitializeTransactionSchema,
        }),
      verify: (reference) =>
        callPaystack(this.http, {
          method: "GET",
          path: `/transaction/verify/${encodeURIComponent(reference)}`,
          dataSchema: paystackTransactionSchema,
        }),
      chargeAuthorization: (params) =>
        callPaystack(this.http, {
          method: "POST",
          path: "/transaction/charge_authorization",
          body: asBody(params),
          dataSchema: paystackTransactionSchema,
        }),
    };

    this.plans = {
      create: (params) =>
        callPaystack(this.http, {
          method: "POST",
          path: "/plan",
          body: asBody(params),
          dataSchema: paystackPlanSchema,
        }),
      fetch: (idOrCode) =>
        callPaystack(this.http, {
          method: "GET",
          path: `/plan/${encodeURIComponent(String(idOrCode))}`,
          dataSchema: paystackPlanSchema,
        }),
      list: (query) =>
        callPaystack(this.http, {
          method: "GET",
          path: "/plan",
          query: {
            perPage: query?.perPage,
            page: query?.page,
          },
          dataSchema: paystackPlanSchema.array(),
        }),
    };

    this.subscriptions = {
      create: (params) =>
        callPaystack(this.http, {
          method: "POST",
          path: "/subscription",
          body: asBody(params),
          dataSchema: paystackSubscriptionSchema,
        }),
      fetch: (code) =>
        callPaystack(this.http, {
          method: "GET",
          path: `/subscription/${encodeURIComponent(code)}`,
          dataSchema: paystackSubscriptionSchema,
        }),
      disable: (params) =>
        callPaystack(this.http, {
          method: "POST",
          path: "/subscription/disable",
          body: asBody(params),
          bodySchema: disableSubscriptionParamsSchema,
          dataSchema: z.unknown().optional(),
        }),
      enable: (params) =>
        callPaystack(this.http, {
          method: "POST",
          path: "/subscription/enable",
          body: asBody(params),
          bodySchema: disableSubscriptionParamsSchema,
          dataSchema: z.unknown().optional(),
        }),
      list: (query) =>
        callPaystack(this.http, {
          method: "GET",
          path: "/subscription",
          query: {
            perPage: query?.perPage,
            page: query?.page,
            customer: query?.customer,
            plan: query?.plan,
          },
          dataSchema: paystackSubscriptionSchema.array(),
        }),
    };

    this.webhook = {
      verifyPaystackWebhookSignature: (rawBody, signature) =>
        verifyPaystackWebhookSignature(rawBody, signature, this.#secretKey),
      verifyWebhookRequest: (request) =>
        verifyWebhookRequest(request, this.#secretKey),
      parseWebhookPayload,
      processWebhookDelivery: (request, options) =>
        processWebhookDeliveryFromRequest(request, options, {
          secretKey: this.#secretKey,
        }),
      processWebhookRequest: (request) =>
        processWebhookRequest(request, this.#secretKey),
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
  parseWebhookPayload,
  processVerifiedWebhookDelivery,
  processWebhookDelivery,
  processWebhookDeliveryFromRequest,
  processWebhookRequest,
  verifyPaystackWebhookSignature,
  verifyWebhookRequest,
} from "./webhook-delivery";
