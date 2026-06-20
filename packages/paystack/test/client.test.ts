import type { Mock } from "vitest";
import { describe, expect, it, vi } from "vitest";
import { PaystackError } from "../src/client/errors";
import { Paystack } from "../src/client/paystack-client";
import {
  createMockFetch,
  createPaystackClient,
  createPaystackTransaction,
  DEMO_PAYSTACK_CUSTOMER_CODE,
  DEMO_PAYSTACK_CUSTOMER_EMAIL,
  DEMO_PAYSTACK_PLAN_CODE,
  DEMO_PAYSTACK_SUBSCRIPTION_CODE,
  getLastFetchCall,
  mockJsonResponse,
  TEST_SECRET_KEY,
} from "./_fixtures";

describe("paystack.customers", () => {
  it("creates a customer", async () => {
    const fetchMock = createMockFetch();
    const paystack = createPaystackClient({ fetch: fetchMock });

    const result = await paystack.customers.create({
      email: "new@example.com",
      first_name: "Ada",
      metadata: { userId: "user_2" },
    });

    const call = getLastFetchCall(fetchMock as Mock);
    expect(call?.method).toBe("POST");
    expect(call?.url).toContain("/customer");
    expect(call?.body).toMatchObject({
      email: "new@example.com",
      first_name: "Ada",
    });
    expect(result.customer_code).toBe("CUS_created");
    expect(result.metadata).toEqual({ userId: "user_2" });
  });

  it("fetches a customer by encoded email", async () => {
    const fetchMock = createMockFetch();
    const paystack = createPaystackClient({ fetch: fetchMock });

    await paystack.customers.fetch(DEMO_PAYSTACK_CUSTOMER_EMAIL);

    const call = getLastFetchCall(fetchMock as Mock);
    expect(call?.method).toBe("GET");
    expect(call?.url).toContain(
      `/customer/${encodeURIComponent(DEMO_PAYSTACK_CUSTOMER_EMAIL)}`
    );
  });

  it("lists customers with pagination query params", async () => {
    const fetchMock = createMockFetch();
    const paystack = createPaystackClient({ fetch: fetchMock });

    const result = await paystack.customers.list({ perPage: 25, page: 2 });

    const call = getLastFetchCall(fetchMock as Mock);
    expect(call?.url).toContain("perPage=25");
    expect(call?.url).toContain("page=2");
    expect(result).toHaveLength(1);
    expect(result[0]?.customer_code).toBe(DEMO_PAYSTACK_CUSTOMER_CODE);
  });

  it("updates a customer", async () => {
    const fetchMock = createMockFetch();
    const paystack = createPaystackClient({ fetch: fetchMock });

    const result = await paystack.customers.update(
      DEMO_PAYSTACK_CUSTOMER_CODE,
      {
        first_name: "Updated",
      }
    );

    const call = getLastFetchCall(fetchMock as Mock);
    expect(call?.method).toBe("PUT");
    expect(call?.url).toContain(
      `/customer/${encodeURIComponent(DEMO_PAYSTACK_CUSTOMER_CODE)}`
    );
    expect(result.first_name).toBe("Updated");
  });

  it("throws validation error for malformed customer responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse({
        status: true,
        message: "Customer created",
        data: { email: "missing-required-fields" },
      })
    );
    const paystack = createPaystackClient({ fetch: fetchMock });

    await expect(
      paystack.customers.create({ email: "new@example.com" })
    ).rejects.toMatchObject({ code: "PAYSTACK_VALIDATION_ERROR" });
  });
});

describe("paystack.transactions", () => {
  it("parses initialize transaction response", async () => {
    const fetchMock = createMockFetch();
    const paystack = createPaystackClient({ fetch: fetchMock });

    const result = await paystack.transactions.initialize({
      email: "test@example.com",
      amount: 1000,
      reference: "ref_123",
    });

    const call = getLastFetchCall(fetchMock as Mock);
    expect(call?.method).toBe("POST");
    expect(call?.url).toContain("/transaction/initialize");
    expect(result.authorization_url).toContain("checkout.paystack.com");
    expect(result.reference).toBe("ref_123");
  });

  it("throws validation error for malformed initialize response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        mockJsonResponse({ status: true, message: "OK", data: {} })
      );
    const paystack = createPaystackClient({ fetch: fetchMock });

    await expect(
      paystack.transactions.initialize({
        email: "test@example.com",
        amount: 1000,
      })
    ).rejects.toBeInstanceOf(PaystackError);
  });

  it("verifies a transaction by reference", async () => {
    const fetchMock = createMockFetch();
    const paystack = createPaystackClient({ fetch: fetchMock });

    const result = await paystack.transactions.verify("ref_verify_1");

    const call = getLastFetchCall(fetchMock as Mock);
    expect(call?.method).toBe("GET");
    expect(call?.url).toContain("/transaction/verify/ref_verify_1");
    expect(result.reference).toBe("ref_verify_1");
    expect(result.status).toBe("success");
  });

  it("charges an authorization", async () => {
    const fetchMock = createMockFetch();
    const paystack = createPaystackClient({ fetch: fetchMock });

    const result = await paystack.transactions.chargeAuthorization({
      email: "test@example.com",
      amount: 1500,
      authorization_code: "AUTH_test",
      reference: "ref_charge_1",
    });

    const call = getLastFetchCall(fetchMock as Mock);
    expect(call?.method).toBe("POST");
    expect(call?.url).toContain("/transaction/charge_authorization");
    expect(call?.body).toMatchObject({
      email: "test@example.com",
      amount: 1500,
      authorization_code: "AUTH_test",
      reference: "ref_charge_1",
    });
    expect(result.reference).toBe("ref_charge_1");
  });

  it("throws API error when Paystack returns status false", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse({
        status: false,
        message: "Transaction not found",
        data: createPaystackTransaction(),
      })
    );
    const paystack = createPaystackClient({ fetch: fetchMock });

    await expect(
      paystack.transactions.verify("missing_ref")
    ).rejects.toMatchObject({
      code: "PAYSTACK_API_ERROR",
      paystackMessage: "Transaction not found",
    });
  });
});

describe("paystack.plans", () => {
  it("creates a plan", async () => {
    const fetchMock = createMockFetch();
    const paystack = createPaystackClient({ fetch: fetchMock });

    const result = await paystack.plans.create({
      name: "Pro",
      amount: 800,
      interval: "monthly",
      currency: "GHS",
    });

    const call = getLastFetchCall(fetchMock as Mock);
    expect(call?.method).toBe("POST");
    expect(call?.url).toContain("/plan");
    expect(result.plan_code).toBe("PLN_pro");
    expect(result.amount).toBe(800);
  });

  it("fetches a plan by code", async () => {
    const fetchMock = createMockFetch();
    const paystack = createPaystackClient({ fetch: fetchMock });

    const result = await paystack.plans.fetch(DEMO_PAYSTACK_PLAN_CODE);

    const call = getLastFetchCall(fetchMock as Mock);
    expect(call?.url).toContain(`/plan/${DEMO_PAYSTACK_PLAN_CODE}`);
    expect(result.plan_code).toBe(DEMO_PAYSTACK_PLAN_CODE);
  });

  it("fetches a plan by numeric id", async () => {
    const fetchMock = createMockFetch();
    const paystack = createPaystackClient({ fetch: fetchMock });

    await paystack.plans.fetch(1716);

    const call = getLastFetchCall(fetchMock as Mock);
    expect(call?.url).toContain("/plan/1716");
  });

  it("lists plans with pagination query params", async () => {
    const fetchMock = createMockFetch();
    const paystack = createPaystackClient({ fetch: fetchMock });

    const result = await paystack.plans.list({ perPage: 10, page: 1 });

    const call = getLastFetchCall(fetchMock as Mock);
    expect(call?.url).toContain("perPage=10");
    expect(call?.url).toContain("page=1");
    expect(result[0]?.plan_code).toBe(DEMO_PAYSTACK_PLAN_CODE);
  });

  it("throws validation error for malformed plan list responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse({
        status: true,
        message: "Plans retrieved",
        data: [{ name: "missing-required-fields" }],
      })
    );
    const paystack = createPaystackClient({ fetch: fetchMock });

    await expect(paystack.plans.list()).rejects.toMatchObject({
      code: "PAYSTACK_VALIDATION_ERROR",
    });
  });
});

describe("paystack.subscriptions", () => {
  it("creates a subscription", async () => {
    const fetchMock = createMockFetch();
    const paystack = createPaystackClient({ fetch: fetchMock });

    const result = await paystack.subscriptions.create({
      customer: DEMO_PAYSTACK_CUSTOMER_CODE,
      plan: DEMO_PAYSTACK_PLAN_CODE,
      authorization: "AUTH_test",
    });

    const call = getLastFetchCall(fetchMock as Mock);
    expect(call?.method).toBe("POST");
    expect(call?.url).toContain("/subscription");
    expect(result.subscription_code).toBe(DEMO_PAYSTACK_SUBSCRIPTION_CODE);
  });

  it("fetches a subscription by code", async () => {
    const fetchMock = createMockFetch();
    const paystack = createPaystackClient({ fetch: fetchMock });

    const result = await paystack.subscriptions.fetch(
      DEMO_PAYSTACK_SUBSCRIPTION_CODE
    );

    const call = getLastFetchCall(fetchMock as Mock);
    expect(call?.url).toContain(
      `/subscription/${DEMO_PAYSTACK_SUBSCRIPTION_CODE}`
    );
    expect(result.subscription_code).toBe(DEMO_PAYSTACK_SUBSCRIPTION_CODE);
  });

  it("lists subscriptions with filters", async () => {
    const fetchMock = createMockFetch();
    const paystack = createPaystackClient({ fetch: fetchMock });

    const result = await paystack.subscriptions.list({
      perPage: 5,
      page: 1,
      customer: 374_466_993,
      plan: 1716,
    });

    const call = getLastFetchCall(fetchMock as Mock);
    expect(call?.url).toContain("perPage=5");
    expect(call?.url).toContain("page=1");
    expect(call?.url).toContain("customer=374466993");
    expect(call?.url).toContain("plan=1716");
    expect(result).toHaveLength(1);
  });

  it("disables a subscription", async () => {
    const fetchMock = createMockFetch();
    const paystack = createPaystackClient({ fetch: fetchMock });

    const result = await paystack.subscriptions.disable({
      code: DEMO_PAYSTACK_SUBSCRIPTION_CODE,
      token: "email_token_demo",
    });

    const call = getLastFetchCall(fetchMock as Mock);
    expect(call?.method).toBe("POST");
    expect(call?.url).toContain("/subscription/disable");
    expect(call?.body).toMatchObject({
      code: DEMO_PAYSTACK_SUBSCRIPTION_CODE,
      token: "email_token_demo",
    });
    expect(result).toMatchObject({
      status: true,
      message: "Subscription disabled",
    });
  });

  it("enables a subscription", async () => {
    const fetchMock = createMockFetch();
    const paystack = createPaystackClient({ fetch: fetchMock });

    const result = await paystack.subscriptions.enable({
      code: DEMO_PAYSTACK_SUBSCRIPTION_CODE,
      token: "email_token_demo",
    });

    const call = getLastFetchCall(fetchMock as Mock);
    expect(call?.url).toContain("/subscription/enable");
    expect(result).toMatchObject({
      status: true,
      message: "Subscription enabled",
    });
  });

  it("rejects disable requests with invalid payload before fetch", async () => {
    const fetchMock = createMockFetch();
    const paystack = createPaystackClient({ fetch: fetchMock });

    await expect(
      paystack.subscriptions.disable({ code: "", token: "token" })
    ).rejects.toMatchObject({
      code: "PAYSTACK_VALIDATION_ERROR",
      statusCode: 400,
      message: "Invalid payload",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects enable requests with invalid payload before fetch", async () => {
    const fetchMock = createMockFetch();
    const paystack = createPaystackClient({ fetch: fetchMock });

    await expect(
      paystack.subscriptions.enable({ code: "SUB_test", token: "" })
    ).rejects.toMatchObject({
      code: "PAYSTACK_VALIDATION_ERROR",
      statusCode: 400,
      message: "Invalid payload",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws validation error for malformed subscription responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse({
        status: true,
        message: "Subscription fetched",
        data: { status: "active" },
      })
    );
    const paystack = createPaystackClient({ fetch: fetchMock });

    await expect(
      paystack.subscriptions.fetch(DEMO_PAYSTACK_SUBSCRIPTION_CODE)
    ).rejects.toMatchObject({ code: "PAYSTACK_VALIDATION_ERROR" });
  });
});

describe("Paystack client options", () => {
  it("does not expose the secret key on the client instance", () => {
    const paystack = new Paystack({
      secretKey: TEST_SECRET_KEY,
      publicKey: "pk_test_public",
    });

    expect("secretKey" in paystack).toBe(false);
    expect(paystack.publicKey).toBe("pk_test_public");
  });
});
