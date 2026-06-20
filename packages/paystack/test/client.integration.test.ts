import { beforeAll, describe, expect, it } from "vitest";
import { PaystackError } from "../src/client/errors";
import { Paystack } from "../src/client/paystack-client";
import {
  createUniqueReference,
  createUniqueTestEmail,
  requireLiveSecretKey,
} from "./_fixtures";

const testEmail = createUniqueTestEmail();
const customerCodeRegex = /^CUS_/;
const planCodeRegex = /^PLN_/;

describe.sequential("paystack live API integration", () => {
  let paystack: Paystack;
  const testReference = createUniqueReference();
  const planName = `plan_${Date.now()}`;

  let customerCode = "";
  let planCode = "";
  let initializeReference = "";

  beforeAll(() => {
    paystack = new Paystack({ secretKey: requireLiveSecretKey() });
  });

  it("creates a customer", async () => {
    const customer = await paystack.customers.create({
      email: testEmail,
      first_name: "Integration",
      last_name: "Test",
      metadata: { source: "client.integration.test" },
    });

    customerCode = customer.customer_code;
    expect(customer.email).toBe(testEmail);
    expect(customer.customer_code).toMatch(customerCodeRegex);
    expect(customer.metadata).toEqual({ source: "client.integration.test" });
  });

  it("fetches a customer by email", async () => {
    const customer = await paystack.customers.fetch(testEmail);

    expect(customer.customer_code).toBe(customerCode);
    expect(customer.email).toBe(testEmail);
  });

  it("lists customers", async () => {
    const customers = await paystack.customers.list({ perPage: 5, page: 1 });

    expect(Array.isArray(customers)).toBe(true);
    expect(customers.length).toBeGreaterThan(0);
    expect(
      customers.some((customer) => customer.customer_code === customerCode)
    ).toBe(true);
  });

  it("updates a customer", async () => {
    const customer = await paystack.customers.update(customerCode, {
      last_name: "Updated",
    });

    expect(customer.customer_code).toBe(customerCode);
    expect(customer.last_name).toBe("Updated");
  });

  it("creates a plan", async () => {
    const plan = await paystack.plans.create({
      name: planName,
      amount: 1000,
      interval: "monthly",
      currency: "GHS",
      description: "Integration test plan",
    });

    planCode = plan.plan_code;
    expect(plan.name).toBe(planName);
    expect(plan.amount).toBe(1000);
    expect(plan.plan_code).toMatch(planCodeRegex);
  });

  it("fetches a plan by code", async () => {
    const plan = await paystack.plans.fetch(planCode);

    expect(plan.plan_code).toBe(planCode);
    expect(plan.name).toBe(planName);
  });

  it("lists plans", async () => {
    const plans = await paystack.plans.list({ perPage: 5, page: 1 });

    expect(Array.isArray(plans)).toBe(true);
    expect(plans.some((plan) => plan.plan_code === planCode)).toBe(true);
  });

  it("initializes a transaction", async () => {
    const checkout = await paystack.transactions.initialize({
      email: testEmail,
      amount: 1000,
      currency: "GHS",
      reference: testReference,
    });

    initializeReference = checkout.reference;
    expect(checkout.reference).toBe(testReference);
    expect(checkout.authorization_url).toContain("checkout.paystack.com");
    expect(checkout.access_code).toBeTruthy();
  });

  it("verifies an initialized transaction", async () => {
    const transaction = await paystack.transactions.verify(initializeReference);

    expect(transaction.reference).toBe(initializeReference);
    expect(transaction.amount).toBe(1000);
    expect(["abandoned", "failed", "success", "pending"]).toContain(
      transaction.status
    );
  });

  it("returns a Paystack API error for invalid charge authorization requests", async () => {
    await expect(
      paystack.transactions.chargeAuthorization({
        email: testEmail,
        amount: 1000,
        authorization_code: "AUTH_invalid_integration_test",
        reference: createUniqueReference("ref_charge"),
      })
    ).rejects.toBeInstanceOf(PaystackError);
  });

  it("lists subscriptions", async () => {
    const subscriptions = await paystack.subscriptions.list({
      perPage: 5,
      page: 1,
    });

    expect(Array.isArray(subscriptions)).toBe(true);
  });

  it("returns a Paystack API error when creating a subscription without authorization", async () => {
    await expect(
      paystack.subscriptions.create({
        customer: customerCode,
        plan: planCode,
        authorization: "AUTH_invalid_integration_test",
      })
    ).rejects.toBeInstanceOf(PaystackError);
  });

  it("returns a Paystack API error when disabling an unknown subscription", async () => {
    await expect(
      paystack.subscriptions.disable({
        code: "SUB_invalid_integration_test",
        token: "invalid_token",
      })
    ).rejects.toBeInstanceOf(PaystackError);
  });

  it("returns a Paystack API error when enabling an unknown subscription", async () => {
    await expect(
      paystack.subscriptions.enable({
        code: "SUB_invalid_integration_test",
        token: "invalid_token",
      })
    ).rejects.toBeInstanceOf(PaystackError);
  });
});
