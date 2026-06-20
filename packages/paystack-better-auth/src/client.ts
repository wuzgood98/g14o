/* biome-ignore lint/style/noExportedImports: it resolves the type inference of the plugin type */
import type { ClientFetchOption as PaystackClientFetchOption } from "@better-auth/core";
import { PAYSTACK_ERROR_CODES } from "./error-codes";
import type { paystack } from "./index";
import type {
  CheckoutSessionData,
  CheckoutSessionInput,
  DbPaystackSubscription,
  Exactly,
  PaystackClientPluginOptions,
  UpgradeSubscriptionData,
  UpgradeSubscriptionInput,
} from "./types";
import { PACKAGE_VERSION } from "./version";

type PluginFetch = <T = unknown>(
  url: string,
  options?: PaystackClientFetchOption
) => Promise<
  | { data: T; error: null }
  | {
      data: null;
      error: { message?: string; status: number; statusText: string };
    }
>;

/**
 * Better Auth client plugin exposing typed Paystack billing actions on `authClient.subscription`.
 *
 * @example
 * ```ts
 * const authClient = createAuthClient({
 *   plugins: [paystackClientPlugin()],
 * });
 *
 * const { data, error } = await authClient.subscription.createCheckoutSession({
 *   amount: 1500,
 *   currency: "GHS",
 * });
 * ```
 */
export const paystackClientPlugin = <
  const GlobalDisableRedirect extends boolean = false,
>(
  options?: PaystackClientPluginOptions & {
    disableRedirect?: GlobalDisableRedirect;
  }
) => {
  const globalDisableRedirect = options?.disableRedirect ?? false;
  return {
    id: "paystack-client",
    version: PACKAGE_VERSION,
    $ERROR_CODES: PAYSTACK_ERROR_CODES,
    $InferServerPlugin: {} as ReturnType<typeof paystack>,
    getActions: ($fetch: PluginFetch) => ({
      subscription: {
        /** Initialize a hosted checkout for a one-time payment.
         * Returns `{ data, error }`.
         * @param input - The input for the create checkout session endpoint.
         * @param fetchOptions - The fetch options for the create checkout session endpoint.
         * @returns The result of the create checkout session endpoint.
         */
        createCheckoutSession: async <const T extends CheckoutSessionInput>(
          input: Exactly<CheckoutSessionInput, T>,
          fetchOptions?: PaystackClientFetchOption
        ) => {
          const res = await $fetch<
            CheckoutSessionData<GlobalDisableRedirect, T>
          >("/paystack/checkout/create-session", {
            method: "POST",
            body: {
              ...input,
              disableRedirect: input.disableRedirect ?? globalDisableRedirect,
            },
            ...fetchOptions,
          });
          return res;
        },
        /**
         * Upgrade or start a subscription checkout for a plan.
         * Set `annual: true` for annual billing.
         * Returns `{ data, error }`.
         * @param input - The input for the upgrade endpoint.
         * @param fetchOptions - The fetch options for the upgrade endpoint.
         * @returns The result of the upgrade endpoint.
         */
        upgrade: async <const T extends UpgradeSubscriptionInput>(
          input: Exactly<UpgradeSubscriptionInput, T>,
          fetchOptions?: PaystackClientFetchOption
        ) => {
          const res = await $fetch<
            UpgradeSubscriptionData<GlobalDisableRedirect, T>
          >("/paystack/subscription/upgrade", {
            method: "POST",
            body: {
              ...input,
              disableRedirect: input.disableRedirect ?? globalDisableRedirect,
            },
            ...fetchOptions,
          });
          return res;
        },
        /**
         * Cancel an active subscription (requires stored `emailToken`).
         * Returns `{ data, error }`.
         * @param input - The input for the cancel endpoint.
         * @param fetchOptions - The fetch options for the cancel endpoint.
         * @returns The result of the cancel endpoint.
         */
        cancel: async (
          input: {
            /**
             * The reference ID for the subscription.
             * @default undefined
             */
            reference?: string | undefined;
            /**
             * The subscription code for the subscription.
             * @default undefined
             */
            subscriptionCode?: string | undefined;
          } = {},
          fetchOptions?: PaystackClientFetchOption
        ) => {
          const res = await $fetch<DbPaystackSubscription>(
            "/paystack/subscription/cancel",
            {
              method: "POST",
              body: input,
              ...fetchOptions,
            }
          );
          return res;
        },
        /** Resume a cancelled subscription. Returns `{ data, error }`.
         * @param input - The input for the resume endpoint.
         * @param fetchOptions - The fetch options for the resume endpoint.
         * @returns The result of the resume endpoint.
         */
        resume: async (
          input: {
            /**
             * The reference ID for the subscription.
             * @default undefined
             */
            reference?: string | undefined;
            /**
             * The subscription code for the subscription.
             * @default undefined
             */
            subscriptionCode?: string | undefined;
          } = {},
          fetchOptions?: PaystackClientFetchOption
        ) => {
          const res = await $fetch<DbPaystackSubscription>(
            "/paystack/subscription/resume",
            {
              method: "POST",
              body: input,
              ...fetchOptions,
            }
          );
          return res;
        },
        /** Fetch the current user's subscription. Returns `{ data, error }`.
         * @param input - The input for the get subscription endpoint.
         * @param fetchOptions - The fetch options for the get subscription endpoint.
         * @returns The result of the get subscription endpoint.
         */
        getSubscription: async (
          input: {
            /**
             * The reference ID for the subscription.
             * @default undefined
             */
            reference?: string | undefined;
            /**
             * The subscription code for the subscription.
             * @default undefined
             */
            subscriptionCode?: string | undefined;
          } = {},
          fetchOptions?: PaystackClientFetchOption
        ) => {
          const res = await $fetch<DbPaystackSubscription>(
            "/paystack/subscription/get",
            {
              method: "GET",
              query: input,
              ...fetchOptions,
            }
          );
          return res;
        },

        /** List active subscriptions for the current user. Returns `{ data, error }`.
         * @param input - The input for the list subscriptions endpoint.
         * @param input.page - The page number to return.
         * @param input.perPage - The number of subscriptions to return per page.
         * @param input.customer - The customer ID to filter subscriptions by.
         * @param input.plan - The plan ID to filter subscriptions by.
         * @param fetchOptions - The fetch options for the list subscriptions endpoint.
         * @returns The result of the list subscriptions endpoint.
         */
        list: async (
          input: {
            /**
             * The page number to return.
             * @default 1
             */
            page?: number | undefined;
            /**
             * The number of subscriptions to return per page.
             * @default 10
             */
            perPage?: number | undefined;
            /**
             * The customer ID to filter subscriptions by.
             * @default undefined
             */
            customer?: number | undefined;
            /**
             * The plan ID to filter subscriptions by.
             * @default undefined
             */
            plan?: number | undefined;
          } = {},
          fetchOptions?: PaystackClientFetchOption
        ) => {
          const res = await $fetch<DbPaystackSubscription[]>(
            "/paystack/subscription/list",
            {
              method: "GET",
              query: input,
              ...fetchOptions,
            }
          );
          return res;
        },
      },
    }),
  };
};

export type { PaystackClientFetchOption };
