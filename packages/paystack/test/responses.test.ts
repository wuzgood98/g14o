import { describe, expect, it } from "vitest";
import {
  paystackResponseEnvelopeSchema,
  paystackSubscriptionSchema,
  paystackTransactionSchema,
} from "../src/client/responses";

const DEMO_PAYSTACK_CUSTOMER_CODE = "CUS_mkf7p9e3rtyahnz";
const DEMO_PAYSTACK_SUBSCRIPTION_CODES = [
  "SUB_ga4snx1n36kituq",
  "SUB_aops53nsdklcs2h",
] as const;

describe("Paystack response schemas", () => {
  it("parses demo customer subscription list payloads with string metadata and numeric reusable", () => {
    const payload = {
      status: true,
      message: "Subscriptions retrieved",
      data: [
        {
          id: 4192,
          status: "active",
          subscription_code: DEMO_PAYSTACK_SUBSCRIPTION_CODES[0],
          email_token: "email_token_demo_1",
          amount: 800,
          customer: {
            id: 374_466_993,
            customer_code: DEMO_PAYSTACK_CUSTOMER_CODE,
            email: "demo+paystack@example.com",
            metadata: JSON.stringify({ userId: "user_1" }),
          },
          plan: {
            id: 1716,
            name: "Pro",
            plan_code: "PLN_pro",
            amount: 800,
            interval: "monthly",
            currency: "GHS",
          },
          authorization: {
            authorization_code: "AUTH_test",
            reusable: 1,
          },
        },
        {
          id: 4193,
          status: "active",
          subscription_code: DEMO_PAYSTACK_SUBSCRIPTION_CODES[1],
          email_token: "email_token_demo_2",
          amount: 500,
          customer: {
            id: 374_466_993,
            customer_code: DEMO_PAYSTACK_CUSTOMER_CODE,
            email: "demo+paystack@example.com",
            metadata: JSON.stringify({ userId: "user_1" }),
          },
          plan: {
            id: 1717,
            name: "Basic",
            plan_code: "PLN_basic",
            amount: 500,
            interval: "monthly",
            currency: "GHS",
          },
          authorization: {
            authorization_code: "AUTH_test_2",
            reusable: 1,
          },
        },
      ],
    };

    const parsed = paystackResponseEnvelopeSchema(
      paystackSubscriptionSchema.array()
    ).parse(payload);

    expect(parsed.data).toHaveLength(2);
    expect(parsed.data[0]?.customer?.metadata).toEqual({ userId: "user_1" });
    expect(parsed.data[0]?.authorization?.reusable).toBe(true);
    expect(parsed.data.map((sub) => sub.subscription_code)).toEqual([
      DEMO_PAYSTACK_SUBSCRIPTION_CODES[0],
      DEMO_PAYSTACK_SUBSCRIPTION_CODES[1],
    ]);
  });

  it("accepts subscriptions missing email_token on list responses", () => {
    const payload = {
      status: true,
      message: "Subscriptions retrieved",
      data: [
        {
          id: 4193,
          status: "active",
          subscription_code: DEMO_PAYSTACK_SUBSCRIPTION_CODES[1],
          amount: 500,
          customer: {
            id: 374_466_993,
            customer_code: DEMO_PAYSTACK_CUSTOMER_CODE,
            email: "demo+paystack@example.com",
            metadata: null,
          },
        },
      ],
    };

    const parsed = paystackResponseEnvelopeSchema(
      paystackSubscriptionSchema.array()
    ).parse(payload);

    expect(parsed.data[0]?.email_token).toBeUndefined();
  });

  it("coerces reusable 0 to false", () => {
    const parsed = paystackSubscriptionSchema.parse({
      id: 1,
      status: "active",
      subscription_code: DEMO_PAYSTACK_SUBSCRIPTION_CODES[0],
      amount: 100,
      authorization: {
        authorization_code: "AUTH_test",
        reusable: 0,
      },
    });

    expect(parsed.authorization?.reusable).toBe(false);
  });

  it("accepts abandoned transaction verify payloads with partial authorization", () => {
    const payload = {
      status: true,
      message: "Verification successful",
      data: {
        id: 1001,
        status: "abandoned",
        reference: "ref_abandoned_1",
        amount: 1000,
        currency: "GHS",
        authorization: {
          reusable: false,
        },
      },
    };

    const parsed = paystackResponseEnvelopeSchema(
      paystackTransactionSchema
    ).parse(payload);

    expect(parsed.data.status).toBe("abandoned");
    expect(parsed.data.authorization?.authorization_code).toBeUndefined();
    expect(parsed.data.authorization?.reusable).toBe(false);
  });
});
