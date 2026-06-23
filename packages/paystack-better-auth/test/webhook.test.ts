import type { PaystackWebhookEvent } from "@g14o/paystack";
import { createWebhookEventId } from "@g14o/paystack";
import { getTestInstance } from "better-auth/test";
import { describe, expect, it, vi } from "vitest";
import { paystack } from "../src/index";
import {
  createChargeSuccessPayload,
  createOneTimeChargeSuccessPayload,
  createSubscriptionExpiringCardsPayload,
  createSubscriptionRecord,
  createTransferSuccessPayload,
} from "./_factories";
import {
  createMockFetch,
  createPaystackClient,
  createPaystackOptions,
  setupAuthenticatedUpgradeTest,
  signPaystackWebhook,
  TEST_SECRET_KEY,
  test,
} from "./_fixtures";

describe("webhook utilities", () => {
  it("creates stable event ids", () => {
    const event = createChargeSuccessPayload({ reference: "ref_1" });
    const id = createWebhookEventId(event);
    expect(id).toBe("charge.success:ref_1");
  });
});

describe("paystack webhook", () => {
  test("processes webhook with valid signature", async ({
    memory,
    paystackOptions,
  }) => {
    const { auth } = await getTestInstance({
      database: memory,
      plugins: [paystack(paystackOptions)],
    });

    const payload = createChargeSuccessPayload();
    const rawBody = JSON.stringify(payload);
    const signature = signPaystackWebhook(rawBody, TEST_SECRET_KEY);

    const response = await auth.handler(
      new Request("http://localhost:3000/api/auth/paystack/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-paystack-signature": signature,
        },
        body: rawBody,
      })
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as { received: boolean };
    expect(json.received).toBe(true);
  });

  test("deduplicates webhook deliveries", async ({
    memory,
    paystackOptions,
  }) => {
    const { auth } = await getTestInstance({
      database: memory,
      plugins: [paystack(paystackOptions)],
    });

    const payload = createChargeSuccessPayload({
      reference: "ref_dup_test",
      metadata: { userId: "user_dup" },
    });
    const rawBody = JSON.stringify(payload);
    const signature = signPaystackWebhook(rawBody, TEST_SECRET_KEY);

    const request = () =>
      auth.handler(
        new Request("http://localhost:3000/api/auth/paystack/webhook", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-paystack-signature": signature,
          },
          body: rawBody,
        })
      );

    const first = await request();
    expect(first.status).toBe(200);

    const second = await request();
    expect(second.status).toBe(200);
    const secondJson = (await second.json()) as { duplicate?: boolean };
    expect(secondJson.duplicate).toBe(true);
  });

  test("disables superseded subscription after successful upgrade payment", async ({
    memory,
    paystackOptions,
    mockFetch,
  }) => {
    const { auth } = await getTestInstance({
      database: memory,
      plugins: [paystack(paystackOptions)],
    });
    const ctx = await auth.$context;

    await ctx.adapter.create({
      model: "subscription",
      data: createSubscriptionRecord({
        userId: "user_1",
        referenceId: "user_1",
      }),
    });

    const payload = createChargeSuccessPayload({
      reference: "ref_upgrade_1",
      subscription_code: "SUB_new",
      plan: { plan_code: "PLN_basic", name: "Basic" },
      metadata: {
        userId: "user_1",
        supersedeSubscriptionCode: "SUB_old",
      },
    });
    const rawBody = JSON.stringify(payload);
    const signature = signPaystackWebhook(rawBody, TEST_SECRET_KEY);

    const response = await auth.handler(
      new Request("http://localhost:3000/api/auth/paystack/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-paystack-signature": signature,
        },
        body: rawBody,
      })
    );

    expect(response.status).toBe(200);

    const disableCall = mockFetch.mock.calls.find(
      ([url, init]) =>
        String(url).includes("/subscription/disable") && init?.method === "POST"
    );
    expect(disableCall).toBeDefined();
    const disableBody = JSON.parse(String(disableCall?.[1]?.body)) as {
      code: string;
      token: string;
    };
    expect(disableBody.code).toBe("SUB_old");
    expect(disableBody.token).toBe("email_token_old");

    const subscriptions = await ctx.adapter.findMany({
      model: "subscription",
      where: [{ field: "userId", value: "user_1" }],
    });
    expect(
      subscriptions.some(
        (record) =>
          (record as { subscriptionCode?: string }).subscriptionCode ===
          "SUB_new"
      )
    ).toBe(true);
  });

  test("does not disable when supersede code matches new subscription code", async ({
    memory,
    paystackOptions,
    mockFetch,
  }) => {
    const { auth } = await getTestInstance({
      database: memory,
      plugins: [paystack(paystackOptions)],
    });
    const ctx = await auth.$context;

    await ctx.adapter.create({
      model: "subscription",
      data: createSubscriptionRecord({
        userId: "user_1",
        referenceId: "user_1",
        subscriptionCode: "SUB_same",
      }),
    });

    const payload = createChargeSuccessPayload({
      reference: "ref_same_sub",
      subscription_code: "SUB_same",
      plan: { plan_code: "PLN_pro", name: "Pro" },
      metadata: {
        userId: "user_1",
        supersedeSubscriptionCode: "SUB_same",
      },
    });
    const rawBody = JSON.stringify(payload);
    const signature = signPaystackWebhook(rawBody, TEST_SECRET_KEY);

    const response = await auth.handler(
      new Request("http://localhost:3000/api/auth/paystack/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-paystack-signature": signature,
        },
        body: rawBody,
      })
    );

    expect(response.status).toBe(200);

    const disableCall = mockFetch.mock.calls.find(([url]) =>
      String(url).includes("/subscription/disable")
    );
    expect(disableCall).toBeUndefined();
  });

  test("swallows disable failures and still persists the new subscription", async ({
    memory,
  }) => {
    const baseFetch = createMockFetch();
    const failingFetch = vi.fn(
      (
        input: string | URL | Request,
        init?: RequestInit
      ): Promise<Response> => {
        const url = typeof input === "string" ? input : input.toString();
        const method = init?.method ?? "GET";

        if (url.includes("/subscription/disable") && method === "POST") {
          return Promise.reject(new Error("disable failed"));
        }

        return baseFetch(input, init);
      }
    ) as typeof fetch;

    const paystackClient = createPaystackClient({ fetch: failingFetch });
    const { auth } = await getTestInstance({
      database: memory,
      plugins: [paystack(createPaystackOptions(paystackClient))],
    });
    const ctx = await auth.$context;

    await ctx.adapter.create({
      model: "subscription",
      data: createSubscriptionRecord({
        userId: "user_1",
        referenceId: "user_1",
      }),
    });

    const payload = createChargeSuccessPayload({
      reference: "ref_disable_fail",
      subscription_code: "SUB_new",
      plan: { plan_code: "PLN_basic", name: "Basic" },
      metadata: {
        userId: "user_1",
        supersedeSubscriptionCode: "SUB_old",
      },
    });
    const rawBody = JSON.stringify(payload);
    const signature = signPaystackWebhook(rawBody, TEST_SECRET_KEY);

    const response = await auth.handler(
      new Request("http://localhost:3000/api/auth/paystack/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-paystack-signature": signature,
        },
        body: rawBody,
      })
    );

    expect(response.status).toBe(200);

    const subscriptions = await ctx.adapter.findMany({
      model: "subscription",
      where: [{ field: "userId", value: "user_1" }],
    });
    expect(
      subscriptions.some(
        (record) =>
          (record as { subscriptionCode?: string }).subscriptionCode ===
          "SUB_new"
      )
    ).toBe(true);
  });

  test("does not disable when supersede metadata is absent", async ({
    memory,
    paystackOptions,
    mockFetch,
  }) => {
    const { auth } = await getTestInstance({
      database: memory,
      plugins: [paystack(paystackOptions)],
    });

    const payload = createChargeSuccessPayload({
      reference: "ref_no_supersede",
      metadata: { userId: "user_1" },
    });
    const rawBody = JSON.stringify(payload);
    const signature = signPaystackWebhook(rawBody, TEST_SECRET_KEY);

    const response = await auth.handler(
      new Request("http://localhost:3000/api/auth/paystack/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-paystack-signature": signature,
        },
        body: rawBody,
      })
    );

    expect(response.status).toBe(200);

    const disableCall = mockFetch.mock.calls.find(([url]) =>
      String(url).includes("/subscription/disable")
    );
    expect(disableCall).toBeUndefined();
  });

  test("invokes onEvent with typed charge.success payload", async ({
    memory,
    paystackOptions,
  }) => {
    const onEvent = vi.fn();
    const { auth } = await getTestInstance({
      database: memory,
      plugins: [
        paystack({
          ...paystackOptions,
          onEvent,
        }),
      ],
    });

    const payload = createChargeSuccessPayload({ reference: "ref_on_event" });
    const rawBody = JSON.stringify(payload);
    const signature = signPaystackWebhook(rawBody, TEST_SECRET_KEY);

    const response = await auth.handler(
      new Request("http://localhost:3000/api/auth/paystack/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-paystack-signature": signature,
        },
        body: rawBody,
      })
    );

    expect(response.status).toBe(200);
    expect(onEvent).toHaveBeenCalledOnce();
    expect(onEvent).toHaveBeenCalledWith(payload);
    expect(onEvent.mock.calls[0]?.[0]?.data.customer.customer_code).toBe(
      "CUS_test123"
    );
  });

  test("accepts non-billing events without subscription mutations", async ({
    memory,
    paystackOptions,
  }) => {
    const onEvent = vi.fn();
    const { auth } = await getTestInstance({
      database: memory,
      plugins: [
        paystack({
          ...paystackOptions,
          onEvent,
        }),
      ],
    });
    const ctx = await auth.$context;

    const payload = createTransferSuccessPayload();
    const rawBody = JSON.stringify(payload);
    const signature = signPaystackWebhook(rawBody, TEST_SECRET_KEY);

    const response = await auth.handler(
      new Request("http://localhost:3000/api/auth/paystack/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-paystack-signature": signature,
        },
        body: rawBody,
      })
    );

    expect(response.status).toBe(200);
    expect(onEvent).toHaveBeenCalledWith(payload);

    const subscriptions = await ctx.adapter.findMany({
      model: "subscription",
    });
    expect(subscriptions).toHaveLength(0);
  });

  test("does not route subscription.expiring_cards through invoice handling", async ({
    memory,
    paystackOptions,
    mockFetch,
  }) => {
    const { auth } = await getTestInstance({
      database: memory,
      plugins: [paystack(paystackOptions)],
    });
    const ctx = await auth.$context;

    await ctx.adapter.create({
      model: "subscription",
      data: createSubscriptionRecord({
        userId: "user_1",
        subscriptionCode: "SUB_test123",
      }),
    });

    const payload = createSubscriptionExpiringCardsPayload();
    const rawBody = JSON.stringify(payload);
    const signature = signPaystackWebhook(rawBody, TEST_SECRET_KEY);

    const response = await auth.handler(
      new Request("http://localhost:3000/api/auth/paystack/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-paystack-signature": signature,
        },
        body: rawBody,
      })
    );

    expect(response.status).toBe(200);

    const subscriptionFetchCall = mockFetch.mock.calls.find(([url]) =>
      String(url).includes("/subscription/")
    );
    expect(subscriptionFetchCall).toBeUndefined();

    const subscriptions = await ctx.adapter.findMany({
      model: "subscription",
      where: [{ field: "userId", value: "user_1" }],
    });
    expect(subscriptions).toHaveLength(1);
    expect(
      (subscriptions[0] as { subscriptionCode?: string }).subscriptionCode
    ).toBe("SUB_test123");
  });

  test("prefers customer-code lookup over conflicting metadata userId", async ({
    memory,
    paystackOptions,
  }) => {
    const { auth, userId, context } = await setupAuthenticatedUpgradeTest({
      memory,
      paystackOptions,
    });

    await context.context.adapter.update({
      model: "user",
      where: [{ field: "id", value: userId }],
      update: {
        paystackCustomerCode: "CUS_test123",
      },
    });

    const payload = createChargeSuccessPayload({
      reference: "ref_metadata_conflict",
      metadata: { userId: "user_victim" },
      customer: {
        id: 1,
        first_name: "Linked",
        last_name: "User",
        email: "linked@example.com",
        customer_code: "CUS_test123",
        phone: null,
        metadata: { userId: "user_victim" },
      },
    });
    const rawBody = JSON.stringify(payload);
    const signature = signPaystackWebhook(rawBody, TEST_SECRET_KEY);

    const response = await auth.handler(
      new Request("http://localhost:3000/api/auth/paystack/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-paystack-signature": signature,
        },
        body: rawBody,
      })
    );

    expect(response.status).toBe(200);

    const subscriptions = await context.context.adapter.findMany({
      model: "subscription",
      where: [{ field: "userId", value: userId }],
    });
    expect(subscriptions.length).toBeGreaterThan(0);

    const victimSubscriptions = await context.context.adapter.findMany({
      model: "subscription",
      where: [{ field: "userId", value: "user_victim" }],
    });
    expect(victimSubscriptions).toHaveLength(0);
  });
});

describe("one-time checkout webhooks", () => {
  const postWebhook = (
    auth: Awaited<ReturnType<typeof getTestInstance>>["auth"],
    payload: PaystackWebhookEvent
  ) => {
    const rawBody = JSON.stringify(payload);
    const signature = signPaystackWebhook(rawBody, TEST_SECRET_KEY);

    return auth.handler(
      new Request("http://localhost:3000/api/auth/paystack/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-paystack-signature": signature,
        },
        body: rawBody,
      })
    );
  };

  test("invokes onCheckoutComplete for one-time charge.success", async ({
    memory,
    paystackOptions,
  }) => {
    const onCheckoutComplete = vi.fn();
    const { auth } = await getTestInstance({
      database: memory,
      plugins: [
        paystack({
          ...paystackOptions,
          checkout: { onCheckoutComplete },
        }),
      ],
    });

    const payload = createOneTimeChargeSuccessPayload({
      reference: "ref_checkout_1",
      amount: 2500,
    });

    const response = await postWebhook(auth, payload);

    expect(response.status).toBe(200);
    expect(onCheckoutComplete).toHaveBeenCalledOnce();
    expect(onCheckoutComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: "ref_checkout_1",
        amount: 2500,
        userId: "user_1",
        metadata: expect.objectContaining({ orderId: "order_1" }),
        payment: expect.objectContaining({
          reference: "ref_checkout_1",
          status: "successful",
        }),
      })
    );
  });

  test("does not invoke onCheckoutComplete for subscription charge.success", async ({
    memory,
    paystackOptions,
  }) => {
    const onCheckoutComplete = vi.fn();
    const { auth } = await getTestInstance({
      database: memory,
      plugins: [
        paystack({
          ...paystackOptions,
          checkout: { onCheckoutComplete },
        }),
      ],
    });

    const payload = createChargeSuccessPayload({
      reference: "ref_sub_checkout",
    });
    const response = await postWebhook(auth, payload);

    expect(response.status).toBe(200);
    expect(onCheckoutComplete).not.toHaveBeenCalled();
  });

  test("persists payment record when persistence is enabled", async ({
    memory,
    paystackOptions,
  }) => {
    const { auth } = await getTestInstance({
      database: memory,
      plugins: [
        paystack({
          ...paystackOptions,
          checkout: { onCheckoutComplete: vi.fn() },
        }),
      ],
    });
    const ctx = await auth.$context;

    const payload = createOneTimeChargeSuccessPayload({
      reference: "ref_persist_1",
    });
    await postWebhook(auth, payload);

    const payments = await ctx.adapter.findMany({
      model: "payment",
      where: [{ field: "reference", value: "ref_persist_1" }],
    });

    expect(payments).toHaveLength(1);
    expect((payments[0] as { status?: string }).status).toBe("successful");
  });

  test("deduplicates webhook deliveries and calls onCheckoutComplete once", async ({
    memory,
    paystackOptions,
  }) => {
    const onCheckoutComplete = vi.fn();
    const { auth } = await getTestInstance({
      database: memory,
      plugins: [
        paystack({
          ...paystackOptions,
          checkout: { onCheckoutComplete },
        }),
      ],
    });

    const payload = createOneTimeChargeSuccessPayload({
      reference: "ref_dup_checkout",
    });

    const first = await postWebhook(auth, payload);
    const second = await postWebhook(auth, payload);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(((await second.json()) as { duplicate?: boolean }).duplicate).toBe(
      true
    );
    expect(onCheckoutComplete).toHaveBeenCalledOnce();
  });

  test("skips payment persistence when disablePaymentPersistence is true", async ({
    memory,
    paystackOptions,
  }) => {
    const onCheckoutComplete = vi.fn();
    const { auth } = await getTestInstance({
      database: memory,
      plugins: [
        paystack({
          ...paystackOptions,
          disablePaymentPersistence: true,
          checkout: { onCheckoutComplete },
        }),
      ],
    });

    const payload = createOneTimeChargeSuccessPayload({
      reference: "ref_no_persist",
    });
    const response = await postWebhook(auth, payload);

    expect(response.status).toBe(200);
    expect(onCheckoutComplete).toHaveBeenCalledOnce();
    expect(onCheckoutComplete.mock.calls[0]?.[0]?.payment).toBeUndefined();
  });

  test("invokes onCheckoutComplete for guest checkout without userId", async ({
    memory,
    paystackOptions,
  }) => {
    const onCheckoutComplete = vi.fn();
    const { auth } = await getTestInstance({
      database: memory,
      plugins: [
        paystack({
          ...paystackOptions,
          checkout: { onCheckoutComplete },
        }),
      ],
    });

    const payload = createOneTimeChargeSuccessPayload({
      reference: "ref_guest",
      metadata: { orderId: "guest_order" },
      customer: {
        id: 99,
        first_name: "Guest",
        last_name: "User",
        email: "guest@example.com",
        customer_code: "CUS_guest",
        phone: null,
        metadata: null,
      },
    });

    const response = await postWebhook(auth, payload);

    expect(response.status).toBe(200);
    expect(onCheckoutComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: "ref_guest",
        userId: undefined,
        metadata: expect.objectContaining({ orderId: "guest_order" }),
      })
    );
  });

  test("returns 400 when onCheckoutComplete throws", async ({
    memory,
    paystackOptions,
  }) => {
    const { auth } = await getTestInstance({
      database: memory,
      plugins: [
        paystack({
          ...paystackOptions,
          checkout: {
            onCheckoutComplete: () => {
              throw new Error("fulfillment failed");
            },
          },
        }),
      ],
    });

    const payload = createOneTimeChargeSuccessPayload({
      reference: "ref_checkout_fail",
    });
    const response = await postWebhook(auth, payload);

    expect(response.status).toBe(400);
  });
});
