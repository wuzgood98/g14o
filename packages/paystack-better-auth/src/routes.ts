import { APIError } from "@better-auth/core/error";
import {
  CheckoutError,
  type Paystack,
  PaystackError,
  SubscriptionError,
} from "@g14o/paystack";
import type { GenericEndpointContext } from "better-auth";
import { createAuthEndpoint, getSessionFromCtx } from "better-auth/api";
import {
  createCustomerForUser,
  getCustomerByUserId,
  syncCustomerForUser,
} from "./customer";
import { PAYSTACK_ERROR_CODES } from "./error-codes";
import { createAdapterWebhookStore, handlePaystackWebhookEvent } from "./hooks";
import { checkoutMetadata, subscriptionMetadata } from "./metadata";
import { getReferenceId, paystackSessionMiddleware } from "./middleware";
import type { PlanRegistry } from "./plans";
import {
  getSubscriptionRecordWithReconcile,
  reconcileSubscriptionsForUser,
} from "./subscription-sync";
import type {
  ChargeCustomerParams,
  ChargeCustomerResult,
  DbPaystackSubscription,
  PluginContext,
} from "./types";
import {
  asDbSubscription,
  generateReference,
  mapTransactionStatus,
} from "./utils";
import {
  chargeAuthorizationBodySchema,
  checkoutSessionBodySchema,
  customerActionBodySchema,
  listActiveSubscriptionsBodySchema,
  subscriptionActionBodySchema,
  upgradeBodySchema,
} from "./validation";

type Adapter = GenericEndpointContext["context"]["adapter"];

/**
 * Require a session to be present in the context.
 * @internal
 */
function requireSession(ctx: Pick<GenericEndpointContext, "context">) {
  const session = ctx.context.session;
  if (!session) {
    throw APIError.from("UNAUTHORIZED", PAYSTACK_ERROR_CODES.UNAUTHORIZED);
  }

  return session;
}

const absoluteUrlRegex = /^[a-zA-Z][a-zA-Z0-9+\-.]*:/;

/**
 * Converts a relative URL to an absolute URL using the base URL from the context.
 * @internal
 */
function getAbsoluteUrl(ctx: GenericEndpointContext, url: string) {
  if (absoluteUrlRegex.test(url)) {
    return url;
  }
  return `${ctx.context.options.baseURL}${url}`;
}

const LIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "past_due"]);

/**
 * Checks if a subscription status is live.
 * @internal
 */
function isLiveSubscription(status: string): boolean {
  return LIVE_SUBSCRIPTION_STATUSES.has(status);
}

/**
 * Resolves an upgrade from an existing subscription record.
 * @internal
 */
function resolveUpgradeFromExistingRecord(
  existingRecord: DbPaystackSubscription | null,
  userId: string,
  planCode: string
): { supersedeSubscriptionCode?: string; upgraded: boolean } {
  if (!existingRecord) {
    return { upgraded: false };
  }

  if (existingRecord.userId !== userId) {
    throw APIError.from(
      "NOT_FOUND",
      PAYSTACK_ERROR_CODES.SUBSCRIPTION_NOT_FOUND
    );
  }

  if (!isLiveSubscription(existingRecord.status)) {
    return { upgraded: false };
  }

  if (existingRecord.planCode === planCode) {
    throw APIError.from(
      "BAD_REQUEST",
      PAYSTACK_ERROR_CODES.SUBSCRIPTION_ALREADY_ON_PLAN
    );
  }

  if (!existingRecord.emailToken) {
    throw new SubscriptionError(
      "Missing email token for subscription upgrade",
      "SUBSCRIPTION_MISSING_EMAIL_TOKEN"
    );
  }

  return {
    supersedeSubscriptionCode: existingRecord.subscriptionCode,
    upgraded: true,
  };
}

/**
 * Ensures a Paystack customer exists for a user.
 * @internal
 */
async function ensurePaystackCustomer(
  ctx: GenericEndpointContext,
  pluginContext: PluginContext,
  userId: string
) {
  const existing = await getCustomerByUserId(ctx.context.adapter, userId);

  if (existing) {
    return existing;
  }

  return createCustomerForUser({
    paystackClient: pluginContext.options.paystackClient,
    adapter: ctx.context.adapter,
    userId,
    getCustomerCreateParams: pluginContext.options.getCustomerCreateParams,
    onCustomerCreate: pluginContext.options.onCustomerCreate,
    authCtx: ctx,
  });
}

/**
 * Charges a customer using a reusable authorization.
 * @internal
 */
async function chargeCustomer(options: {
  paystackClient: Paystack;
  adapter: Adapter;
  params: ChargeCustomerParams;
}): Promise<ChargeCustomerResult> {
  const paystackCustomer = await getCustomerByUserId(
    options.adapter,
    options.params.userId
  );

  if (!paystackCustomer) {
    throw new CheckoutError(
      "Paystack customer not found for user",
      "CHECKOUT_INITIALIZATION_FAILED"
    );
  }

  let customer: Awaited<ReturnType<Paystack["customers"]["fetch"]>>;

  try {
    customer = await options.paystackClient.customers.fetch(
      paystackCustomer.customerCode
    );
  } catch (error) {
    throw new CheckoutError(
      "Failed to fetch Paystack customer",
      "CHECKOUT_INITIALIZATION_FAILED",
      error
    );
  }

  const authorizations = customer.authorizations ?? [];

  const reusableAuthorization = [...authorizations]
    .reverse()
    .find((authorization) => authorization.reusable !== false);

  if (!reusableAuthorization?.authorization_code) {
    throw new CheckoutError(
      "No reusable authorization found for customer",
      "CHECKOUT_INITIALIZATION_FAILED"
    );
  }

  const reference = options.params.reference ?? generateReference("charge");
  const currency = options.params.currency ?? "NGN";

  try {
    const transaction =
      await options.paystackClient.transactions.chargeAuthorization({
        email: customer.email,
        amount: options.params.amount,
        authorization_code: reusableAuthorization.authorization_code,
        currency,
        reference,
        metadata: options.params.metadata,
      });

    const status = mapTransactionStatus(transaction.status);

    return {
      reference: transaction.reference,
      status,
      amount: transaction.amount,
      currency: transaction.currency,
    };
  } catch (error) {
    throw new CheckoutError(
      "Failed to charge authorization",
      "CHECKOUT_INITIALIZATION_FAILED",
      error
    );
  }
}

export const createPaystackCustomer = (pluginContext: PluginContext) =>
  createAuthEndpoint(
    "/paystack/customer/create",
    {
      method: "POST",
      body: customerActionBodySchema,
      use: [paystackSessionMiddleware],
    },
    async (ctx) => {
      const session = requireSession(ctx);
      const userId = ctx.body.userId ?? session.user.id;
      const customer = await createCustomerForUser({
        paystackClient: pluginContext.options.paystackClient,
        adapter: ctx.context.adapter,
        userId,
        getCustomerCreateParams: pluginContext.options.getCustomerCreateParams,
        onCustomerCreate: pluginContext.options.onCustomerCreate,
        authCtx: ctx,
      });

      return ctx.json(customer);
    }
  );

export const getPaystackCustomer = (_pluginContext: PluginContext) =>
  createAuthEndpoint(
    "/paystack/customer/get",
    {
      method: "GET",
      query: customerActionBodySchema.partial(),
      use: [paystackSessionMiddleware],
    },
    async (ctx) => {
      const session = requireSession(ctx);
      const userId = ctx.query.userId ?? session.user.id;
      const customer = await getCustomerByUserId(ctx.context.adapter, userId);

      if (!customer) {
        throw APIError.from(
          "NOT_FOUND",
          PAYSTACK_ERROR_CODES.CUSTOMER_NOT_FOUND
        );
      }

      return ctx.json(customer);
    }
  );

/**
 * ### Endpoint
 *
 * POST `/paystack/customer/sync`
 *
 * ### API Methods
 *
 * **server**
 * `auth.api.syncPaystackCustomer`
 */
export const syncPaystackCustomer = (pluginContext: PluginContext) =>
  createAuthEndpoint(
    "/paystack/customer/sync",
    {
      method: "POST",
      body: customerActionBodySchema,
      use: [paystackSessionMiddleware],
    },
    async (ctx) => {
      const session = requireSession(ctx);
      const userId = ctx.body.userId ?? session.user.id;
      const customer = await syncCustomerForUser({
        paystackClient: pluginContext.options.paystackClient,
        adapter: ctx.context.adapter,
        userId,
      });

      return ctx.json(customer);
    }
  );

/**
 * ### Endpoint
 * POST `/paystack/checkout/create-session`
 *
 * ### API Methods
 *
 * **server**
 * `auth.api.createCheckoutSession`
 *
 * **client**
 * `authClient.subscription.createCheckoutSession`
 */
export const createCheckoutSession = (pluginContext: PluginContext) =>
  createAuthEndpoint(
    "/paystack/checkout/create-session",
    {
      method: "POST",
      body: checkoutSessionBodySchema,
    },
    async (ctx) => {
      const session = await getSessionFromCtx(ctx);
      const userId = session?.user.id;
      const email =
        ctx.body.email ??
        session?.user.email ??
        (typeof ctx.body.metadata?.email === "string"
          ? ctx.body.metadata.email
          : undefined);

      if (!email) {
        throw APIError.from("BAD_REQUEST", PAYSTACK_ERROR_CODES.EMAIL_REQUIRED);
      }

      const reference = ctx.body.reference
        ? String(ctx.body.reference)
        : generateReference("checkout");
      const metadata = checkoutMetadata.set(
        userId
          ? {
              userId,
              referenceId: getReferenceId(userId, ctx.body.reference),
              ...(ctx.body.cancelActionUrl
                ? { cancel_action: ctx.body.cancelActionUrl }
                : {}),
            }
          : {},
        ctx.body.metadata
      );

      const initialized =
        await pluginContext.options.paystackClient.transactions.initialize({
          email,
          amount: ctx.body.amount,
          currency: ctx.body.currency,
          reference,
          callback_url: ctx.body.callbackUrl,
          channels: ctx.body.channels,
          metadata,
        });

      if (ctx.body.disableRedirect) {
        return ctx.json({
          authorizationUrl: initialized.authorization_url,
          reference: initialized.reference,
        });
      }

      throw ctx.redirect(getAbsoluteUrl(ctx, initialized.authorization_url));
    }
  );

/**
 * ### Endpoint
 * POST `/paystack/subscription/upgrade`
 *
 * ### API Methods
 *
 * **server**
 * `auth.api.upgradeSubscription`
 *
 * **client**
 * `authClient.subscription.upgrade`
 */
export const upgrade = (
  pluginContext: PluginContext,
  planRegistry: PlanRegistry | undefined
) =>
  createAuthEndpoint(
    "/paystack/subscription/upgrade",
    {
      method: "POST",
      body: upgradeBodySchema,
      use: [paystackSessionMiddleware],
    },
    async (ctx) => {
      if (!planRegistry) {
        throw APIError.from(
          "BAD_REQUEST",
          PAYSTACK_ERROR_CODES.SUBSCRIPTION_PLANS_NOT_ENABLED
        );
      }

      const session = requireSession(ctx);
      const userId = session.user.id;
      const referenceId = getReferenceId(userId, ctx.body.reference);
      const customer = await ensurePaystackCustomer(ctx, pluginContext, userId);

      const { plan, planCode } = await planRegistry.resolvePaystackPlanCode(
        ctx.body.plan,
        ctx.body.annual ?? false
      );

      const existingRecord = await getSubscriptionRecordWithReconcile({
        adapter: ctx.context.adapter,
        pluginContext,
        userId,
        reference: ctx.body.reference,
        subscriptionCode: ctx.body.subscriptionCode,
        query: {
          customer: customer.customerId,
        },
      });

      const { supersedeSubscriptionCode, upgraded } =
        resolveUpgradeFromExistingRecord(existingRecord, userId, planCode);

      const reference = generateReference("sub");
      const metadata = subscriptionMetadata.set(
        {
          userId,
          referenceId,
          planName: plan.normalizedName,
          ...(supersedeSubscriptionCode ? { supersedeSubscriptionCode } : {}),
          ...(ctx.body.cancelActionUrl
            ? { cancel_action: ctx.body.cancelActionUrl }
            : {}),
        },
        ctx.body.metadata,
        {
          callbackUrl: ctx.body.callbackUrl,
        }
      );

      const initialized =
        await pluginContext.options.paystackClient.transactions.initialize({
          email: customer.email,
          amount: Number.parseInt(plan.amount, 10),
          currency: plan.currency,
          plan: planCode,
          reference,
          callback_url: ctx.body.callbackUrl,
          channels: ctx.body.channels,
          metadata,
        });

      if (ctx.body.disableRedirect) {
        return ctx.json({
          authorizationUrl: initialized.authorization_url,
          reference: initialized.reference,
          plan: plan.normalizedName,
          upgraded,
          disableRedirect: ctx.body.disableRedirect,
        });
      }

      throw ctx.redirect(getAbsoluteUrl(ctx, initialized.authorization_url));
    }
  );

/**
 * ### Endpoint
 * POST `/paystack/subscription/cancel`
 *
 * ### API Methods
 *
 * **server**
 * `auth.api.cancelSubscription`
 *
 * **client**
 * `authClient.subscription.cancel`
 */
export const cancelSubscription = (pluginContext: PluginContext) =>
  createAuthEndpoint(
    "/paystack/subscription/cancel",
    {
      method: "POST",
      body: subscriptionActionBodySchema,
      use: [paystackSessionMiddleware],
    },
    async (ctx) => {
      const session = requireSession(ctx);
      const userId = session.user.id;
      const record = await getSubscriptionRecordWithReconcile({
        adapter: ctx.context.adapter,
        pluginContext,
        userId,
        reference: ctx.body.reference,
        subscriptionCode: ctx.body.subscriptionCode,
      });

      if (!record) {
        throw APIError.from(
          "NOT_FOUND",
          PAYSTACK_ERROR_CODES.SUBSCRIPTION_NOT_FOUND
        );
      }

      const emailToken = record.emailToken;

      if (!emailToken) {
        throw new SubscriptionError(
          "Missing email token for subscription cancellation",
          "SUBSCRIPTION_MISSING_EMAIL_TOKEN"
        );
      }

      await pluginContext.options.paystackClient.subscriptions.disable({
        code: record.subscriptionCode,
        token: emailToken,
      });

      const updated = await ctx.context.adapter.update({
        model: "subscription",
        where: [{ field: "id", value: record.id }],
        update: {
          status: "cancelled",
          cancelAtPeriodEnd: false,
        },
      });

      return ctx.json(asDbSubscription(updated));
    }
  );

/**
 * ### Endpoint
 * POST `/paystack/subscription/resume`
 *
 * ### API Methods
 *
 * **server**
 * `auth.api.resumeSubscription`
 *
 * **client**
 * `authClient.subscription.resume`
 */
export const resumeSubscription = (pluginContext: PluginContext) =>
  createAuthEndpoint(
    "/paystack/subscription/resume",
    {
      method: "POST",
      body: subscriptionActionBodySchema,
      use: [paystackSessionMiddleware],
    },
    async (ctx) => {
      const session = requireSession(ctx);
      const userId = session.user.id;
      const record = await getSubscriptionRecordWithReconcile({
        adapter: ctx.context.adapter,
        pluginContext,
        userId,
        reference: ctx.body.reference,
        subscriptionCode: ctx.body.subscriptionCode,
      });

      if (!record) {
        throw APIError.from(
          "NOT_FOUND",
          PAYSTACK_ERROR_CODES.SUBSCRIPTION_NOT_FOUND
        );
      }

      const emailToken = record.emailToken;

      if (!emailToken) {
        throw new SubscriptionError(
          "Missing email token for subscription resumption",
          "SUBSCRIPTION_MISSING_EMAIL_TOKEN"
        );
      }

      await pluginContext.options.paystackClient.subscriptions.enable({
        code: record.subscriptionCode,
        token: emailToken,
      });

      const updated = await ctx.context.adapter.update({
        model: "subscription",
        where: [{ field: "id", value: record.id }],
        update: {
          status: "active",
          cancelAtPeriodEnd: false,
        },
      });

      return ctx.json(asDbSubscription(updated));
    }
  );

/**
 * ### Endpoint
 * GET `/paystack/subscription/get`
 *
 * ### API Methods
 *
 * **server**
 * `auth.api.getSubscription`
 *
 * **client**
 * `authClient.subscription.getSubscription`
 */
export const getSubscription = (pluginContext: PluginContext) =>
  createAuthEndpoint(
    "/paystack/subscription/get",
    {
      method: "GET",
      query: subscriptionActionBodySchema.partial(),
      use: [paystackSessionMiddleware],
    },
    async (ctx) => {
      const session = requireSession(ctx);
      const userId = session.user.id;
      const record = await getSubscriptionRecordWithReconcile({
        adapter: ctx.context.adapter,
        pluginContext,
        userId,
        reference: ctx.query.reference,
        subscriptionCode: ctx.query.subscriptionCode,
      });

      if (!record) {
        throw APIError.from(
          "NOT_FOUND",
          PAYSTACK_ERROR_CODES.SUBSCRIPTION_NOT_FOUND
        );
      }

      return ctx.json(record);
    }
  );

/**
 * ### Endpoint
 * GET `/paystack/subscription/list`
 *
 * ### API Methods
 *
 * **server**
 * `auth.api.listSubscriptions`
 *
 * **client**
 * `authClient.subscription.list`
 */
export const listActiveSubscriptions = (pluginContext: PluginContext) =>
  createAuthEndpoint(
    "/paystack/subscription/list",
    {
      method: "GET",
      query: listActiveSubscriptionsBodySchema,
      use: [paystackSessionMiddleware],
    },
    async (ctx) => {
      const session = requireSession(ctx);
      await reconcileSubscriptionsForUser({
        adapter: ctx.context.adapter,
        pluginContext,
        userId: session.user.id,
        query: ctx.query,
      });
      const records =
        await ctx.context.adapter.findMany<DbPaystackSubscription>({
          model: "subscription",
          where: [{ field: "userId", value: session.user.id }],
        });

      return ctx.json(records);
    }
  );

/**
 * ### Endpoint
 * POST `/paystack/charge-authorization`
 *
 * ### API Methods
 *
 * **server**
 * `auth.api.chargeAuthorization`
 */
export const chargeAuthorization = (pluginContext: PluginContext) =>
  createAuthEndpoint(
    "/paystack/charge-authorization",
    {
      method: "POST",
      body: chargeAuthorizationBodySchema,
      use: [paystackSessionMiddleware],
    },
    async (ctx) => {
      const session = requireSession(ctx);
      const userId = ctx.body.userId ?? session.user.id;
      const result = await chargeCustomer({
        paystackClient: pluginContext.options.paystackClient,
        adapter: ctx.context.adapter,
        params: {
          userId,
          amount: ctx.body.amount,
          currency: ctx.body.currency,
          reference: ctx.body.reference,
          metadata: ctx.body.metadata,
        },
      });

      return ctx.json(result);
    }
  );

/**
 * Handles a Paystack webhook delivery.
 * @internal
 */
export const paystackWebhook = (
  pluginContext: PluginContext,
  planRegistry: PlanRegistry | undefined
) =>
  createAuthEndpoint(
    "/paystack/webhook",
    {
      method: "POST",
      metadata: {
        isAction: false,
      },
      cloneRequest: true,
      disableBody: true,
    },
    async (ctx) => {
      const paystackClient = pluginContext.options.paystackClient;
      if (!paystackClient.secretKey) {
        throw APIError.from(
          "INTERNAL_SERVER_ERROR",
          PAYSTACK_ERROR_CODES.WEBHOOK_SECRET_NOT_FOUND
        );
      }

      try {
        const result = await paystackClient.webhook.processWebhookDelivery(
          ctx.request,
          {
            disablePersistence: pluginContext.options.disableWebhookPersistence,
            store: createAdapterWebhookStore(ctx.context.adapter),
            handler: (event) =>
              handlePaystackWebhookEvent({
                event,
                adapter: ctx.context.adapter,
                pluginContext,
                planRegistry,
              }),
          }
        );

        if (result.duplicate) {
          return ctx.json({ received: true, duplicate: true });
        }

        return ctx.json({ received: true });
      } catch (error) {
        if (
          error instanceof PaystackError &&
          error.code === "WEBHOOK_PROCESSING_ERROR"
        ) {
          throw APIError.from(
            "BAD_REQUEST",
            PAYSTACK_ERROR_CODES.WEBHOOK_PROCESSING_ERROR
          );
        }

        throw error;
      }
    }
  );
