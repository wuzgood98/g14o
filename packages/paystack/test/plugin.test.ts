import type { Auth } from "better-auth";
import { getTestInstance } from "better-auth/test";
import { describe, expect, expectTypeOf, it } from "vitest";
import { Paystack } from "../src/client/paystack-client";
import { PAYSTACK_ERROR_CODES } from "../src/error-codes";
import { type PaystackPlugin, paystack } from "../src/index";
import type {
  CheckoutSessionData,
  CheckoutSessionResult,
  PaystackPluginOptions,
  RedirectResult,
  SubscriptionPlan,
  UpgradeSubscriptionData,
  UpgradeSubscriptionResult,
} from "../src/types";
import { normalizePlanName, resolvePluginContext } from "../src/utils";
import { paystackPluginOptionsSchema } from "../src/validation";
import { test } from "./_fixtures";

describe("paystack type", () => {
  it("should api endpoint exists", () => {
    type Plugins = [
      PaystackPlugin<{
        paystackClient: Paystack;
        subscription: {
          enabled: false;
        };
      }>,
    ];
    type MyAuth = Auth<{
      plugins: Plugins;
    }>;
    expectTypeOf<MyAuth["api"]["createCheckoutSession"]>().toBeFunction();
    expectTypeOf<Plugins[0]["endpoints"]["paystackWebhook"]>().toBeFunction();
  });

  it("should have subscription endpoints", () => {
    type Plugins = [
      PaystackPlugin<{
        paystackClient: Paystack;
        subscription: {
          enabled: true;
          plans: [];
        };
      }>,
    ];
    type MyAuth = Auth<{
      plugins: Plugins;
    }>;
    expectTypeOf<MyAuth["api"]["upgradeSubscription"]>().toBeFunction();
    expectTypeOf<MyAuth["api"]["cancelSubscription"]>().toBeFunction();
    expectTypeOf<MyAuth["api"]["resumeSubscription"]>().toBeFunction();
    expectTypeOf<MyAuth["api"]["getSubscription"]>().toBeFunction();
    expectTypeOf<MyAuth["api"]["listActiveSubscriptions"]>().toBeFunction();
  });
});

describe("client plugin return types", () => {
  it("narrows checkout return type when disableRedirect is true", () => {
    type Data = CheckoutSessionData<
      false,
      { amount: number; currency: "GHS"; disableRedirect: true }
    >;
    expectTypeOf<Data>().toEqualTypeOf<CheckoutSessionResult>();
  });

  it("returns redirect result when disableRedirect is omitted", () => {
    type Data = CheckoutSessionData<
      false,
      { amount: number; currency: "GHS"; disableRedirect?: undefined }
    >;
    expectTypeOf<Data>().toEqualTypeOf<RedirectResult>();
  });

  it("narrows upgrade return type when disableRedirect is true", () => {
    type Data = UpgradeSubscriptionData<
      false,
      { plan: string; disableRedirect: true }
    >;
    expectTypeOf<Data>().toEqualTypeOf<UpgradeSubscriptionResult>();
  });

  it("returns redirect result for upgrade when disableRedirect is omitted", () => {
    type Data = UpgradeSubscriptionData<
      false,
      { plan: string; disableRedirect?: undefined }
    >;
    expectTypeOf<Data>().toEqualTypeOf<RedirectResult>();
  });
});

describe("plugin options types", () => {
  it("accepts paystackClient path", () => {
    const options = {
      paystackClient: new Paystack({ secretKey: "sk_test" }),
      createCustomerOnSignUp: true,
      subscription: {
        enabled: true,
        plans: [
          {
            name: "pro",
            interval: "monthly",
            amount: "800",
            currency: "GHS",
          },
        ] satisfies SubscriptionPlan[],
      },
    } satisfies PaystackPluginOptions;

    expectTypeOf(options.paystackClient).toEqualTypeOf<Paystack>();
    expectTypeOf(paystack).toBeFunction();
  });
});

describe("validation schemas", () => {
  it("rejects empty plugin options schema", () => {
    const result = paystackPluginOptionsSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts paystackClient plugin options", () => {
    const result = paystackPluginOptionsSchema.safeParse({
      paystackClient: {},
    });
    expect(result.success).toBe(true);
  });

  it("normalizes plan names", () => {
    expect(normalizePlanName(" Pro ")).toBe("pro");
  });
});

describe("resolvePluginContext", () => {
  it("throws when paystackClient is not provided", () => {
    expect(() => resolvePluginContext({} as never)).toThrow(
      PAYSTACK_ERROR_CODES.MISSING_PLUGIN_CREDENTIALS.message
    );
  });

  it("resolves secretKey path with internal client", () => {
    const context = resolvePluginContext({
      paystackClient: new Paystack({ secretKey: "sk_test" }),
    });
    expect(context.options.paystackClient.secretKey).toBe("sk_test");
  });

  it("resolves paystackClient path with derived secretKey", () => {
    const paystackClient = new Paystack({ secretKey: "sk_test_custom" });
    const context = resolvePluginContext({ paystackClient });
    expect(context.options.paystackClient).toBe(paystackClient);
  });
});

describe("paystack plugin", () => {
  test("infers plugin with paystackClient options", async ({
    paystackOptions,
  }) => {
    const { auth } = await getTestInstance({
      plugins: [paystack(paystackOptions)],
    });

    expect(auth).toBeDefined();
  });
});
