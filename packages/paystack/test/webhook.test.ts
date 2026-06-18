import { createHmac } from "node:crypto";
import { getTestInstance } from "better-auth/test";
import { describe, expect, it, vi } from "vitest";
import { paystack } from "../src/index";
import {
  createWebhookEventId,
  verifyPaystackWebhookSignature,
} from "../src/utils";
import {
  createChargeSuccessPayload,
  createSubscriptionRecord,
} from "./_factories";
import {
  createMockFetch,
  createPaystackClient,
  createPaystackOptions,
  signPaystackWebhook,
  TEST_SECRET_KEY,
  test,
} from "./_fixtures";

const invalidWebhookSignatureRegex = /Invalid webhook signature/;

describe("webhook verification", () => {
  it("verifies valid signatures", () => {
    const body = JSON.stringify({ event: "charge.success", data: { id: 1 } });
    const signature = createHmac("sha512", "sk_test")
      .update(body)
      .digest("hex");

    expect(() =>
      verifyPaystackWebhookSignature(body, signature, "sk_test")
    ).not.toThrow();
  });

  it("rejects invalid signatures", () => {
    const body = JSON.stringify({ event: "charge.success", data: { id: 1 } });

    expect(() =>
      verifyPaystackWebhookSignature(body, "invalid", "sk_test")
    ).toThrow(invalidWebhookSignatureRegex);
  });

  it("creates stable event ids", () => {
    const id = createWebhookEventId("charge.success", { reference: "ref_1" });
    expect(id).toBe("charge.success:ref_1");
  });

  it("rejects re-serialized bodies when raw bytes differ", () => {
    const rawBody =
      '{\n  "event": "charge.success",\n  "data": {\n    "reference": "ref_raw",\n    "amount": 1000\n  }\n}';
    const reSerialized = JSON.stringify(JSON.parse(rawBody));
    const signature = createHmac("sha512", "sk_test")
      .update(rawBody)
      .digest("hex");

    expect(rawBody).not.toBe(reSerialized);
    expect(() =>
      verifyPaystackWebhookSignature(reSerialized, signature, "sk_test")
    ).toThrow(invalidWebhookSignatureRegex);
    expect(() =>
      verifyPaystackWebhookSignature(rawBody, signature, "sk_test")
    ).not.toThrow();
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
});
