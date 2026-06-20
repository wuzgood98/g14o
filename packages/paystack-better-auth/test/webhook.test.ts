import { createWebhookEventId } from "@g14o/paystack";
import { getTestInstance } from "better-auth/test";
import { describe, expect, it, vi } from "vitest";
import { paystack } from "../src/index";
import {
  createChargeSuccessPayload,
  createSubscriptionExpiringCardsPayload,
  createSubscriptionRecord,
  createTransferSuccessPayload,
} from "./_factories";
import {
  createMockFetch,
  createPaystackClient,
  createPaystackOptions,
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
});
