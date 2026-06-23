import type {
  ChargeSuccessData,
  PaystackCustomer,
  PaystackInitializeTransaction,
  PaystackPlan,
  PaystackSubscription,
  PaystackWebhookEvent,
} from "@g14o/paystack";

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

const defaultChargeSuccessData = (): ChargeSuccessData => ({
  id: 1001,
  domain: "test",
  status: "success",
  reference: "ref_webhook_1",
  amount: 1500,
  message: null,
  gateway_response: "Successful",
  paid_at: "2026-01-01T00:00:00.000Z",
  created_at: "2026-01-01T00:00:00.000Z",
  channel: "card",
  currency: "GHS",
  customer: {
    id: 1,
    first_name: "Test",
    last_name: "User",
    email: "test@email.com",
    customer_code: "CUS_test123",
    phone: null,
    metadata: { userId: "user_1" },
  },
  plan: createPaystackPlan(),
  subscription_code: "SUB_test123",
  metadata: { userId: "user_1" },
});

export function createChargeSuccessPayload(
  overrides: Partial<ChargeSuccessData> = {}
): Extract<PaystackWebhookEvent, { event: "charge.success" }> {
  return {
    event: "charge.success",
    data: {
      ...defaultChargeSuccessData(),
      ...overrides,
      customer: {
        ...defaultChargeSuccessData().customer,
        ...(overrides.customer ?? {}),
      },
    },
  };
}

export function createOneTimeChargeSuccessPayload(
  overrides: Partial<ChargeSuccessData> = {}
): Extract<PaystackWebhookEvent, { event: "charge.success" }> {
  const base = defaultChargeSuccessData();
  const data: ChargeSuccessData = {
    id: base.id,
    domain: base.domain,
    status: base.status,
    reference: base.reference,
    amount: base.amount,
    message: base.message,
    gateway_response: base.gateway_response,
    paid_at: base.paid_at,
    created_at: base.created_at,
    channel: base.channel,
    currency: base.currency,
    customer: {
      ...base.customer,
      ...(overrides.customer ?? {}),
    },
    plan: null,
    metadata: { userId: "user_1", orderId: "order_1" },
    ...overrides,
  };

  const { subscription_code, ...rest } = data;

  return {
    event: "charge.success",
    data: {
      ...rest,
      plan: rest.plan ?? null,
    },
  };
}

export function createSubscriptionCreatePayload(
  overrides: Partial<
    Extract<PaystackWebhookEvent, { event: "subscription.create" }>["data"]
  > = {}
): Extract<PaystackWebhookEvent, { event: "subscription.create" }> {
  return {
    event: "subscription.create",
    data: {
      id: 1,
      domain: "test",
      status: "active",
      subscription_code: "SUB_test123",
      email_token: "email_token_test",
      amount: 800,
      cron_expression: "0 0 * * *",
      next_payment_date: "2026-01-01T00:00:00.000Z",
      plan: createPaystackPlan(),
      authorization: {
        authorization_code: "AUTH_test",
        bin: "408408",
        last4: "4081",
        exp_month: "12",
        exp_year: "2030",
        channel: "card",
        card_type: "visa",
        bank: "TEST BANK",
        country_code: "GH",
        brand: "visa",
        reusable: true,
      },
      ...overrides,
      customer: {
        id: 1,
        first_name: "Test",
        last_name: "User",
        email: "test@email.com",
        customer_code: "CUS_test123",
        phone: null,
        metadata: { userId: "user_1" },
        ...(overrides.customer ?? {}),
      },
    },
  };
}

const webhookCustomer = {
  id: 1,
  first_name: "Test",
  last_name: "User",
  email: "test@email.com",
  customer_code: "CUS_test123",
  phone: null,
  metadata: { userId: "user_1" },
} as const;

const webhookAuthorization = {
  authorization_code: "AUTH_test",
  bin: "408408",
  last4: "4081",
  exp_month: "12",
  exp_year: "2030",
  channel: "card",
  card_type: "visa",
  bank: "TEST BANK",
  country_code: "GH",
  brand: "visa",
  reusable: true,
} as const;

export function createTransferSuccessPayload(): Extract<
  PaystackWebhookEvent,
  { event: "transfer.success" }
> {
  return {
    event: "transfer.success",
    data: {
      id: 1,
      amount: 1000,
      currency: "GHS",
      source: "balance",
      status: "success",
      transfer_code: "TRF_test",
      recipient: {
        id: 1,
        type: "nuban",
        currency: "GHS",
        recipient_code: "RCP_test",
      },
    },
  };
}

export function createSubscriptionExpiringCardsPayload(): Extract<
  PaystackWebhookEvent,
  { event: "subscription.expiring_cards" }
> {
  return {
    event: "subscription.expiring_cards",
    data: [
      {
        expiry_date: "12/2030",
        subscription: {
          id: 1,
          subscription_code: "SUB_test123",
          amount: 800,
          status: "active",
        },
        customer: webhookCustomer,
        authorization: webhookAuthorization,
      },
    ],
  };
}
