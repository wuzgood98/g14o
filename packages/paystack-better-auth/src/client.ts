import type { Paystack } from "@g14o/paystack";
import type { BetterAuthClientPlugin } from "better-auth/client";
import { PAYSTACK_ERROR_CODES } from "./error-codes";
import type { paystack, SubscriptionPlan } from "./index";
import { PACKAGE_VERSION } from "./version";

/**
 * Better Auth client plugin exposing typed Paystack billing actions on `authClient.subscription`.
 *
 * @example
 * ```ts
 * const authClient = createAuthClient({
 *   plugins: [paystackClient()],
 * });
 *
 * const { data, error } = await authClient.paystack.createCheckoutSession({
 *   amount: 1500,
 *   currency: "GHS",
 * });
 * ```
 */
export const paystackClient = () =>
  ({
    id: "paystack-client",
    version: PACKAGE_VERSION,
    $ERROR_CODES: PAYSTACK_ERROR_CODES,
    $InferServerPlugin: {} as ReturnType<
      typeof paystack<{
        subscription: {
          enabled: true;
          plans: SubscriptionPlan[];
        };
        paystackClient: Paystack;
      }>
    >,
    pathMethods: {
      "/paystack/create-checkout-session": "POST",
      "/paystack/subscription/upgrade": "POST",
      "/paystack/subscription/cancel": "POST",
      "/paystack/subscription/resume": "POST",
      "/paystack/subscription/get": "GET",
      "/paystack/subscription/list": "GET",
    },
  }) satisfies BetterAuthClientPlugin;

// biome-ignore lint/performance/noBarrelFile: it is a re-export of the error codes
export * from "./error-codes";
