import type {
  PaystackCustomer,
  PaystackInitializeTransaction,
  PaystackPlan,
  PaystackSubscription,
} from "../src/client/responses";
import type { PaystackWebhookEvent } from "../src/types";

export interface DbSubscriptionSeed {
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: Date | null;
  currentPeriodStart?: Date;
  customerCode?: string;
  customerId?: number;
  emailToken?: string;
  metadata?: string;
  planCode?: string;
  planName?: string;
  provider?: string;
  referenceId?: string;
  status?: string;
  subscriptionCode?: string;
  userId?: string;
}

export function createSubscriptionRecord(
  overrides: DbSubscriptionSeed = {}
): Record<string, unknown> {
  return {
    userId: "user_1",
    referenceId: "user_1",
    provider: "paystack",
    subscriptionCode: "SUB_old",
    customerCode: "CUS_test123",
    customerId: 1,
    planCode: "PLN_pro",
    planName: "pro",
    emailToken: "email_token_old",
    status: "active",
    currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    ...overrides,
  };
}

export function createPaystackCustomer(
  overrides: Partial<PaystackCustomer> = {}
): PaystackCustomer {
  return {
    id: 1,
    customer_code: "CUS_test123",
    email: "test@email.com",
    first_name: "Test",
    last_name: "User",
    phone: null,
    metadata: { userId: "user_1" },
    ...overrides,
  } as PaystackCustomer;
}

export function createPaystackPlan(
  overrides: Partial<PaystackPlan> = {}
): PaystackPlan {
  return {
    id: 1,
    name: "Pro",
    plan_code: "PLN_pro",
    amount: 800,
    interval: "monthly",
    currency: "GHS",
    ...overrides,
  } as PaystackPlan;
}

export function createPaystackSubscription(
  overrides: Partial<PaystackSubscription> = {}
): PaystackSubscription {
  return {
    id: 1,
    status: "active",
    subscription_code: "SUB_test123",
    email_token: "email_token_test",
    amount: 800,
    plan: createPaystackPlan(),
    customer: createPaystackCustomer(),
    ...overrides,
  } as PaystackSubscription;
}

export function createInitializeTransaction(
  overrides: Partial<PaystackInitializeTransaction> = {}
): PaystackInitializeTransaction {
  return {
    authorization_url: "https://checkout.paystack.com/test",
    access_code: "access_code",
    reference: "ref_checkout",
    ...overrides,
  };
}

export function createWebhookPayload(
  event: PaystackWebhookEvent["event"],
  data: Record<string, unknown> = {}
): PaystackWebhookEvent {
  return {
    event,
    data,
  };
}

export function createChargeSuccessPayload(
  overrides: Record<string, unknown> = {}
): PaystackWebhookEvent {
  return createWebhookPayload("charge.success", {
    reference: "ref_webhook_1",
    amount: 1500,
    currency: "GHS",
    status: "success",
    metadata: { userId: "user_1" },
    ...overrides,
  });
}

export function createSubscriptionCreatePayload(
  overrides: Record<string, unknown> = {}
): PaystackWebhookEvent {
  return createWebhookPayload("subscription.create", {
    subscription_code: "SUB_test123",
    customer: createPaystackCustomer(),
    ...overrides,
  });
}
