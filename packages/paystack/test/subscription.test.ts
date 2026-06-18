import { describe, expect, it, vi } from "vitest";
import { SubscriptionError } from "../src/client/errors";
import type { Paystack } from "../src/client/paystack-client";
import { PlanRegistry } from "../src/plans";
import {
  mapPaystackSubscriptionStatus,
  mapTransactionStatus,
  mapWebhookEventToStatus,
  shouldCancelAtPeriodEnd,
} from "../src/utils";
import { TEST_PLANS } from "./_fixtures";

const PRECREATED_PRO = {
  name: "pro",
  planCode: "PLN_manual",
} as const;

const PRECREATED_PRO_ANNUAL = {
  name: "pro",
  planCode: "PLN_manual",
  annualDiscountedPlanCode: "PLN_annual_manual",
} as const;

const mockPaystackPlan = (overrides: {
  plan_code: string;
  amount?: number;
  interval?: string;
  currency?: string;
  description?: string | null;
}) => ({
  id: 1,
  name: "Pro",
  amount: 800,
  interval: "monthly",
  currency: "GHS",
  ...overrides,
});

describe("subscription state mapping", () => {
  it("maps paystack statuses to normalized statuses", () => {
    expect(mapPaystackSubscriptionStatus("active")).toBe("active");
    expect(mapPaystackSubscriptionStatus("non-renewing")).toBe("active");
    expect(mapPaystackSubscriptionStatus("attention")).toBe("past_due");
    expect(mapPaystackSubscriptionStatus("cancelled")).toBe("cancelled");
    expect(mapPaystackSubscriptionStatus("pending")).toBe("incomplete");
  });

  it("maps webhook events to statuses", () => {
    expect(mapWebhookEventToStatus("charge.success")).toBe("active");
    expect(mapWebhookEventToStatus("invoice.payment_failed")).toBe("past_due");
    expect(mapWebhookEventToStatus("subscription.disable")).toBe("cancelled");
  });

  it("detects cancel at period end", () => {
    expect(shouldCancelAtPeriodEnd("subscription.not_renew")).toBe(true);
    expect(shouldCancelAtPeriodEnd("", "non-renewing")).toBe(true);
    expect(shouldCancelAtPeriodEnd("charge.success")).toBe(false);
  });

  it("maps transaction statuses", () => {
    expect(mapTransactionStatus("success")).toBe("successful");
    expect(mapTransactionStatus("failed")).toBe("failed");
    expect(mapTransactionStatus("pending")).toBe("pending");
  });
});

describe("PlanRegistry", () => {
  it("deduplicates existing paystack plans", async () => {
    const paystackClient = {
      plans: {
        list: vi
          .fn()
          .mockResolvedValue([mockPaystackPlan({ plan_code: "PLN_existing" })]),
        create: vi.fn(),
      },
    } as unknown as Paystack;

    const registry = new PlanRegistry(paystackClient, [TEST_PLANS.pro]);

    const { planCode } = await registry.resolvePaystackPlanCode("pro");

    expect(planCode).toBe("PLN_existing");
    expect(paystackClient.plans.create).not.toHaveBeenCalled();
  });

  it("creates a plan when none exists", async () => {
    const paystackClient = {
      plans: {
        list: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue(
          mockPaystackPlan({
            plan_code: "PLN_new",
            amount: 500,
          })
        ),
      },
    } as unknown as Paystack;

    const registry = new PlanRegistry(paystackClient, [TEST_PLANS.basic]);

    const { planCode } = await registry.resolvePaystackPlanCode("basic");

    expect(planCode).toBe("PLN_new");
    expect(paystackClient.plans.create).toHaveBeenCalledOnce();
  });

  it("uses a provided plan code after verifying it exists on paystack", async () => {
    const paystackClient = {
      plans: {
        fetch: vi
          .fn()
          .mockResolvedValue(mockPaystackPlan({ plan_code: "PLN_manual" })),
        list: vi.fn(),
        create: vi.fn(),
      },
    } as unknown as Paystack;

    const registry = new PlanRegistry(paystackClient, [PRECREATED_PRO]);

    const { plan, planCode } = await registry.resolvePaystackPlanCode("pro");

    expect(planCode).toBe("PLN_manual");
    expect(plan.amount).toBe("800");
    expect(plan.currency).toBe("GHS");
    expect(plan.interval).toBe("monthly");
    expect(paystackClient.plans.fetch).toHaveBeenCalledWith("PLN_manual");
    expect(paystackClient.plans.list).not.toHaveBeenCalled();
    expect(paystackClient.plans.create).not.toHaveBeenCalled();
  });

  it("uses annualDiscountedPlanCode for annual subscriptions", async () => {
    const paystackClient = {
      plans: {
        fetch: vi.fn().mockResolvedValue(
          mockPaystackPlan({
            plan_code: "PLN_annual_manual",
            amount: 700,
            interval: "annually",
          })
        ),
        list: vi.fn(),
        create: vi.fn(),
      },
    } as unknown as Paystack;

    const registry = new PlanRegistry(paystackClient, [PRECREATED_PRO_ANNUAL]);

    const { plan, planCode } = await registry.resolvePaystackPlanCode(
      "pro",
      true
    );

    expect(planCode).toBe("PLN_annual_manual");
    expect(plan.amount).toBe("700");
    expect(plan.interval).toBe("annually");
    expect(plan.paystackAnnualPlanCode).toBe("PLN_annual_manual");
    expect(paystackClient.plans.fetch).toHaveBeenCalledWith(
      "PLN_annual_manual"
    );
    expect(paystackClient.plans.list).not.toHaveBeenCalled();
    expect(paystackClient.plans.create).not.toHaveBeenCalled();
  });

  it("throws when a provided plan code does not exist on paystack", async () => {
    const paystackClient = {
      plans: {
        fetch: vi.fn().mockRejectedValue(new Error("Plan not found")),
        list: vi.fn(),
        create: vi.fn(),
      },
    } as unknown as Paystack;

    const registry = new PlanRegistry(paystackClient, [
      { name: "pro", planCode: "PLN_missing" },
    ]);

    await expect(registry.resolvePaystackPlanCode("pro")).rejects.toThrow(
      SubscriptionError
    );

    await expect(registry.resolvePaystackPlanCode("pro")).rejects.toMatchObject(
      {
        code: "SUBSCRIPTION_PLAN_NOT_FOUND",
      }
    );
    expect(paystackClient.plans.list).not.toHaveBeenCalled();
    expect(paystackClient.plans.create).not.toHaveBeenCalled();
  });

  it("throws when annualDiscountedPlanCode fetch fails", async () => {
    const paystackClient = {
      plans: {
        fetch: vi.fn().mockRejectedValue(new Error("Plan not found")),
        list: vi.fn(),
        create: vi.fn(),
      },
    } as unknown as Paystack;

    const registry = new PlanRegistry(paystackClient, [PRECREATED_PRO_ANNUAL]);

    await expect(
      registry.resolvePaystackPlanCode("pro", true)
    ).rejects.toMatchObject({
      code: "SUBSCRIPTION_PLAN_NOT_FOUND",
    });
  });

  it("throws when annual is requested without annualDiscountedPlanCode", async () => {
    const paystackClient = {
      plans: {
        fetch: vi.fn(),
        list: vi.fn(),
        create: vi.fn(),
      },
    } as unknown as Paystack;

    const registry = new PlanRegistry(paystackClient, [PRECREATED_PRO]);

    await expect(
      registry.resolvePaystackPlanCode("pro", true)
    ).rejects.toMatchObject({
      code: "SUBSCRIPTION_PLAN_NOT_FOUND",
    });
    expect(paystackClient.plans.fetch).not.toHaveBeenCalled();
  });

  it("caches a verified plan code", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(mockPaystackPlan({ plan_code: "PLN_manual" }));
    const paystackClient = {
      plans: {
        fetch,
        list: vi.fn(),
        create: vi.fn(),
      },
    } as unknown as Paystack;

    const registry = new PlanRegistry(paystackClient, [PRECREATED_PRO]);

    await registry.resolvePaystackPlanCode("pro");
    await registry.resolvePaystackPlanCode("pro");

    expect(fetch).toHaveBeenCalledOnce();
  });
});

describe("subscription plan validation", () => {
  const paystackClient = {
    plans: { fetch: vi.fn(), list: vi.fn(), create: vi.fn() },
  } as unknown as Paystack;

  it.each([
    ["amount", { name: "pro", planCode: "PLN_x", amount: "800" }],
    ["currency", { name: "pro", planCode: "PLN_x", currency: "GHS" }],
    ["interval", { name: "pro", planCode: "PLN_x", interval: "monthly" }],
    ["description", { name: "pro", planCode: "PLN_x", description: "desc" }],
    [
      "annualDiscountedAmount",
      { name: "pro", planCode: "PLN_x", annualDiscountedAmount: "700" },
    ],
  ] as const)("rejects planCode with forbidden field %s", async (_field, invalidPlan) => {
    const registry = new PlanRegistry(paystackClient, [
      // @ts-expect-error -- test invalid plan
      invalidPlan,
    ]);

    await expect(registry.resolvePlans()).rejects.toMatchObject({
      code: "SUBSCRIPTION_PLAN_NOT_FOUND",
    });
  });

  it("rejects annualDiscountedPlanCode without planCode", async () => {
    const registry = new PlanRegistry(paystackClient, [
      // @ts-expect-error -- test invalid plan
      {
        name: "pro",
        annualDiscountedPlanCode: "PLN_annual",
      },
    ]);

    await expect(registry.resolvePlans()).rejects.toMatchObject({
      code: "SUBSCRIPTION_PLAN_NOT_FOUND",
    });
  });

  it("rejects auto-create plan missing required billing fields", async () => {
    const registry = new PlanRegistry(paystackClient, [
      // @ts-expect-error -- test invalid plan
      { name: "pro", amount: "800" },
    ]);

    await expect(registry.resolvePlans()).rejects.toMatchObject({
      code: "SUBSCRIPTION_PLAN_NOT_FOUND",
    });
  });
});
