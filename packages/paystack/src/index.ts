/** biome-ignore-all lint/performance/noBarrelFile: published package entry */
import type { BetterAuthPlugin } from "better-auth";
import { createCustomerForUser } from "./customer";
import { PAYSTACK_ERROR_CODES } from "./error-codes";
import { PlanRegistry } from "./plans";
import {
  cancelSubscription,
  chargeAuthorization,
  createCheckoutSession,
  createPaystackCustomer,
  getPaystackCustomer,
  getSubscription,
  listActiveSubscriptions,
  paystackWebhook,
  resumeSubscription,
  syncPaystackCustomer,
  upgrade,
} from "./routes";
import { getSchema } from "./schema";
import type { PaystackPluginOptions } from "./types";
import { resolvePluginContext } from "./utils";
import { PACKAGE_VERSION } from "./version";

/**
 * Better Auth server plugin for Paystack billing.
 *
 * Exposes customer sync, hosted checkout, subscriptions, authorization charges,
 * and webhook endpoints under `/paystack/*`.
 */
export const paystack = <O extends PaystackPluginOptions>(options: O) => {
  const pluginContext = resolvePluginContext(options);
  const planRegistry =
    options.subscription?.enabled && options.subscription.plans
      ? new PlanRegistry(
          pluginContext.options.paystackClient,
          options.subscription.plans
        )
      : undefined;

  const subscriptionEndpoints = {
    upgradeSubscription: upgrade(pluginContext, planRegistry),
    cancelSubscription: cancelSubscription(pluginContext),
    resumeSubscription: resumeSubscription(pluginContext),
    getSubscription: getSubscription(pluginContext),
    listActiveSubscriptions: listActiveSubscriptions(pluginContext),
  };

  return {
    id: "paystack",
    version: PACKAGE_VERSION,
    $ERROR_CODES: PAYSTACK_ERROR_CODES,
    schema: getSchema(options),
    options: options as NoInfer<O>,
    init(ctx) {
      return {
        options: {
          databaseHooks: {
            user: {
              create: {
                async after(user, hookCtx) {
                  if (
                    !(
                      hookCtx &&
                      pluginContext.options.createCustomerOnSignUp &&
                      user.email
                    )
                  ) {
                    return;
                  }

                  try {
                    await createCustomerForUser({
                      paystackClient: pluginContext.options.paystackClient,
                      adapter: hookCtx.context.adapter,
                      userId: user.id,
                      getCustomerCreateParams:
                        pluginContext.options.getCustomerCreateParams,
                      onCustomerCreate: pluginContext.options.onCustomerCreate,
                      authCtx: hookCtx,
                    });
                  } catch (error) {
                    ctx.logger.error(
                      `Failed to create Paystack customer on sign-up: ${
                        error instanceof Error ? error.message : "Unknown error"
                      }`
                    );
                  }
                },
              },
            },
          },
        },
      };
    },
    endpoints: {
      createPaystackCustomer: createPaystackCustomer(pluginContext),
      getPaystackCustomer: getPaystackCustomer(pluginContext),
      syncPaystackCustomer: syncPaystackCustomer(pluginContext),
      createCheckoutSession: createCheckoutSession(pluginContext),
      chargeAuthorization: chargeAuthorization(pluginContext),
      paystackWebhook: paystackWebhook(pluginContext, planRegistry),
      ...((options.subscription?.enabled
        ? subscriptionEndpoints
        : {}) as O["subscription"] extends {
        enabled: true;
      }
        ? typeof subscriptionEndpoints
        : // biome-ignore lint/complexity/noBannedTypes: subscriptionEndpoints is a union of the subscription endpoints
          {}),
    },
    rateLimit: [
      {
        pathMatcher: (path) => path.startsWith("/paystack/checkout"),
        max: 30,
        window: 60,
      },
      {
        pathMatcher: (path) =>
          path.startsWith("/paystack/subscription/upgrade"),
        max: 20,
        window: 60,
      },
      {
        pathMatcher: (path) => path === "/paystack/webhook",
        max: 300,
        window: 60,
      },
    ],
  } satisfies BetterAuthPlugin;
};

/** Type of the {@link paystack} plugin factory. */
export type PaystackPlugin<O extends PaystackPluginOptions> = ReturnType<
  typeof paystack<O>
>;

export type { RawError } from "./error-codes";
export { PAYSTACK_ERROR_CODES } from "./error-codes";
export type PaystackErrorCodes = typeof PAYSTACK_ERROR_CODES;

export {
  CheckoutError,
  CustomerSyncError,
  PaystackError,
  SubscriptionError,
  WebhookVerificationError,
} from "./client/errors";
export type {
  ChargeAuthorizationParams,
  CreateCustomerParams,
  CreatePlanParams,
  CreateSubscriptionParams,
  DisableSubscriptionParams,
  InitializeTransactionParams,
  PaystackClientOptions,
} from "./client/paystack-client";
export { Paystack } from "./client/paystack-client";
export type * from "./types";
