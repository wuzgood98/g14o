import type { Mock } from "vitest";
import { vi } from "vitest";
import { Paystack } from "../src/client/paystack-client";
import type {
  PaystackCustomer,
  PaystackInitializeTransaction,
  PaystackPlan,
  PaystackSubscription,
  PaystackTransaction,
} from "../src/client/responses";

export const TEST_SECRET_KEY = "sk_test_unit";

export const DEMO_PAYSTACK_CUSTOMER_CODE = "CUS_mkf7p9e3rtyahnz";
export const DEMO_PAYSTACK_CUSTOMER_ID = 374_466_993;
export const DEMO_PAYSTACK_CUSTOMER_EMAIL = "demo+paystack@example.com";
export const DEMO_PAYSTACK_SUBSCRIPTION_CODE = "SUB_ga4snx1n36kituq";
export const DEMO_PAYSTACK_PLAN_CODE = "PLN_pro";

export function requireLiveSecretKey(): string {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!secretKey) {
    throw new Error(
      "PAYSTACK_SECRET_KEY is required for live Paystack integration tests."
    );
  }

  if (!secretKey.startsWith("sk_test_")) {
    throw new Error(
      "PAYSTACK_SECRET_KEY must be a Paystack test secret key (sk_test_*)."
    );
  }

  return secretKey;
}

export function createUniqueTestEmail(prefix = "paystack-test"): string {
  return `${prefix}+${Date.now()}@example.com`;
}

export function createUniqueReference(prefix = "ref_test"): string {
  return `${prefix}_${Date.now()}`;
}

export function createPaystackCustomer(
  overrides: Partial<PaystackCustomer> = {}
): PaystackCustomer {
  return {
    id: DEMO_PAYSTACK_CUSTOMER_ID,
    customer_code: DEMO_PAYSTACK_CUSTOMER_CODE,
    email: DEMO_PAYSTACK_CUSTOMER_EMAIL,
    first_name: "Demo",
    last_name: "User",
    phone: null,
    metadata: { userId: "user_1" },
    authorizations: [],
    ...overrides,
  };
}

export function createPaystackPlan(
  overrides: Partial<PaystackPlan> = {}
): PaystackPlan {
  return {
    id: 1716,
    name: "Pro",
    plan_code: DEMO_PAYSTACK_PLAN_CODE,
    amount: 800,
    interval: "monthly",
    currency: "GHS",
    ...overrides,
  };
}

export function createPaystackSubscription(
  overrides: Partial<PaystackSubscription> = {}
): PaystackSubscription {
  return {
    id: 4192,
    status: "active",
    subscription_code: DEMO_PAYSTACK_SUBSCRIPTION_CODE,
    email_token: "email_token_demo",
    amount: 800,
    plan: createPaystackPlan(),
    customer: createPaystackCustomer(),
    authorization: {
      authorization_code: "AUTH_test",
      reusable: true,
    },
    ...overrides,
  };
}

export function createPaystackTransaction(
  overrides: Partial<PaystackTransaction> = {}
): PaystackTransaction {
  return {
    id: 1001,
    status: "success",
    reference: "ref_tx_123",
    amount: 1500,
    currency: "GHS",
    metadata: { userId: "user_1" },
    ...overrides,
  };
}

export function createInitializeTransaction(
  overrides: Partial<PaystackInitializeTransaction> = {}
): PaystackInitializeTransaction {
  return {
    authorization_url: "https://checkout.paystack.com/test",
    access_code: "access_code_test",
    reference: "ref_checkout",
    ...overrides,
  };
}

/** Doc-shaped transaction verify payload (response-schema.ts). */
export function createDocShapedVerifyTransaction(
  reference = "re4lyvq3s3"
): Record<string, unknown> {
  return {
    id: 4_099_260_516,
    domain: "test",
    status: "success",
    reference,
    receipt_number: null,
    amount: 40_333,
    message: null,
    gateway_response: "Successful",
    paid_at: "2024-08-22T09:15:02.000Z",
    created_at: "2024-08-22T09:14:24.000Z",
    channel: "card",
    currency: "NGN",
    ip_address: "197.210.54.33",
    metadata: "",
    log: {
      start_time: 1_724_318_098,
      time_spent: 4,
      attempts: 1,
      errors: 0,
      success: true,
      mobile: false,
      input: [],
      history: [],
    },
    fees: 10_283,
    fees_split: null,
    authorization: {
      authorization_code: "AUTH_uh8bcl3zbn",
      bin: "408408",
      last4: "4081",
      exp_month: "12",
      exp_year: "2030",
      channel: "card",
      card_type: "visa ",
      bank: "TEST BANK",
      country_code: "NG",
      brand: "visa",
      reusable: true,
      signature: null,
      account_name: null,
    },
    customer: {
      id: 181_873_746,
      first_name: null,
      last_name: null,
      email: "demo@test.com",
      customer_code: "CUS_1rkzaqsv4rrhqo6",
      phone: null,
      metadata: null,
      risk_action: "default",
      international_format_phone: null,
    },
    plan: null,
    split: {},
    order_id: null,
    paidAt: "2024-08-22T09:15:02.000Z",
    createdAt: "2024-08-22T09:14:24.000Z",
    requested_amount: 30_050,
    pos_transaction_data: null,
    source: null,
    fees_breakdown: null,
    connect: null,
    transaction_date: "2024-08-22T09:14:24.000Z",
    plan_object: {},
    subaccount: {},
  };
}

/** Doc-shaped charge authorization payload (response-schema.ts). */
export function createDocShapedChargeAuthorizationTransaction(
  reference = "0m7frfnr47ezyxl"
): Record<string, unknown> {
  return {
    amount: 35_247,
    currency: "NGN",
    transaction_date: "2024-08-22T10:53:49.000Z",
    status: "success",
    reference,
    domain: "test",
    metadata: "",
    gateway_response: "Approved",
    message: null,
    channel: "card",
    ip_address: null,
    log: null,
    fees: 10_247,
    authorization: {
      authorization_code: "AUTH_uh8bcl3zbn",
      bin: "408408",
      last4: "4081",
      exp_month: "12",
      exp_year: "2030",
      channel: "card",
      card_type: "visa ",
      bank: "TEST BANK",
      country_code: "NG",
      brand: "visa",
      reusable: true,
      signature: null,
      account_name: null,
    },
    customer: {
      id: 181_873_746,
      first_name: null,
      last_name: null,
      email: "demo@test.com",
      customer_code: "CUS_1rkzaqsv4rrhqo6",
      phone: null,
      metadata: null,
      risk_action: "default",
      international_format_phone: null,
    },
    plan: null,
    id: 4_099_490_251,
  };
}

/** Doc-shaped subscription create payload (response-schema.ts). */
export function createDocShapedCreateSubscription(): Record<string, unknown> {
  return {
    customer: 1173,
    plan: 28,
    integration: 100_032,
    domain: "test",
    start: 1_459_296_064,
    status: "active",
    quantity: 1,
    amount: 50_000,
    authorization: {
      authorization_code: "AUTH_6tmt288t0o",
      bin: "408408",
      last4: "4081",
      exp_month: "12",
      exp_year: "2020",
      channel: "card",
      card_type: "visa visa",
      bank: "TEST BANK",
      country_code: "NG",
      brand: "visa",
      reusable: true,
      signature: "SIG_uSYN4fv1adlAuoij8QXh",
      account_name: "BoJack Horseman",
    },
    subscription_code: "SUB_vsyqdmlzble3uii",
    email_token: "d7gofp6yppn3qz7",
    id: 9,
    createdAt: "2016-03-30T00:01:04.687Z",
    updatedAt: "2016-03-30T00:01:04.687Z",
  };
}

/** Doc-shaped customer fetch payload (response-schema.ts). */
export function createDocShapedFetchCustomer(): Record<string, unknown> {
  return {
    transactions: [],
    subscriptions: [],
    authorizations: [
      {
        authorization_code: "AUTH_ekk8t49ogj",
        bin: "408408",
        last4: "4081",
        exp_month: "12",
        exp_year: "2030",
        channel: "card",
        card_type: "visa ",
        bank: "TEST BANK",
        country_code: "NG",
        brand: "visa",
        reusable: true,
        signature: "SIG_yEXu7dLBeqG0kU7g95Ke",
        account_name: null,
      },
    ],
    first_name: null,
    last_name: null,
    email: "dom@gmail.com",
    phone: null,
    metadata: null,
    domain: "test",
    customer_code: "CUS_c6wqvwmvwopw4ms",
    risk_action: "default",
    id: 90_758_908,
    integration: 463_433,
    createdAt: "2022-08-15T13:46:39.000Z",
    updatedAt: "2022-08-15T13:46:39.000Z",
    created_at: "2022-08-15T13:46:39.000Z",
    updated_at: "2022-08-15T13:46:39.000Z",
    total_transactions: 0,
    total_transaction_value: [],
    dedicated_account: null,
    identified: false,
    identifications: null,
    international_format_phone: null,
  };
}

export function mockJsonResponse(payload: {
  status: boolean;
  message: string;
  data?: unknown;
  meta?: unknown;
}): Response {
  return new Response(JSON.stringify(payload), { status: 200 });
}

interface MockFetchRequest {
  body: Record<string, unknown>;
  headers: Headers;
  method: string;
  url: string;
}

const parseMockFetchRequest = (
  input: string | URL | Request,
  init?: RequestInit
): MockFetchRequest => {
  if (input instanceof Request) {
    return {
      url: input.url,
      method: input.method,
      headers: input.headers,
      body: {},
    };
  }

  return {
    url: typeof input === "string" ? input : input.toString(),
    method: init?.method ?? "GET",
    headers: new Headers(init?.headers),
    body: init?.body ? JSON.parse(String(init.body)) : {},
  };
};

const parseMetadataBody = (
  metadata: unknown
): Record<string, unknown> | null => {
  if (!metadata) {
    return null;
  }

  if (typeof metadata === "string") {
    return JSON.parse(metadata) as Record<string, unknown>;
  }

  return metadata as Record<string, unknown>;
};

export interface FetchCallDetails {
  body: Record<string, unknown> | undefined;
  headers: Headers;
  method: string;
  url: string;
}

export function getLastFetchCall(
  fetchMock: Mock
): FetchCallDetails | undefined {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) {
    return;
  }

  const [input, init] = call as [
    string | URL | Request,
    RequestInit | undefined,
  ];

  if (input instanceof Request) {
    return {
      url: input.url,
      method: input.method,
      headers: input.headers,
      body: undefined,
    };
  }

  const url = typeof input === "string" ? input : input.toString();
  const method = init?.method ?? "GET";
  const headers = new Headers(init?.headers);
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;

  return { url, method, headers, body };
}

export function createMockFetch(
  options: {
    defaultResponse?: Response;
    handlers?: Array<{
      match: (request: MockFetchRequest) => boolean;
      handle: (request: MockFetchRequest) => Response;
    }>;
  } = {}
): typeof fetch {
  const defaultHandlers: Array<{
    match: (request: MockFetchRequest) => boolean;
    handle: (request: MockFetchRequest) => Response;
  }> = [
    {
      match: (request) =>
        request.url.includes("/customer") &&
        request.method === "POST" &&
        !request.url.includes("/customer/"),
      handle: (request) =>
        mockJsonResponse({
          status: true,
          message: "Customer created",
          data: createPaystackCustomer({
            customer_code: "CUS_created",
            email: String(request.body.email ?? DEMO_PAYSTACK_CUSTOMER_EMAIL),
            metadata: parseMetadataBody(request.body.metadata),
          }),
        }),
    },
    {
      match: (request) =>
        request.url.includes("/customer/") && request.method === "GET",
      handle: () =>
        mockJsonResponse({
          status: true,
          message: "Customer fetched",
          data: createPaystackCustomer(),
        }),
    },
    {
      match: (request) =>
        request.url.includes("/customer") &&
        request.method === "GET" &&
        !request.url.includes("/customer/"),
      handle: () =>
        mockJsonResponse({
          status: true,
          message: "Customers retrieved",
          data: [createPaystackCustomer()],
        }),
    },
    {
      match: (request) =>
        request.url.includes("/customer/") && request.method === "PUT",
      handle: (request) =>
        mockJsonResponse({
          status: true,
          message: "Customer updated",
          data: createPaystackCustomer({
            first_name: String(request.body.first_name ?? "Updated"),
          }),
        }),
    },
    {
      match: (request) => request.url.includes("/transaction/initialize"),
      handle: (request) =>
        mockJsonResponse({
          status: true,
          message: "Authorization URL created",
          data: createInitializeTransaction({
            reference: String(request.body.reference ?? "ref_checkout"),
          }),
        }),
    },
    {
      match: (request) => request.url.includes("/transaction/verify/"),
      handle: (request) => {
        const reference = decodeURIComponent(
          request.url.split("/transaction/verify/")[1]?.split("?")[0] ?? ""
        );

        return mockJsonResponse({
          status: true,
          message: "Verification successful",
          data: createPaystackTransaction({ reference }),
        });
      },
    },
    {
      match: (request) =>
        request.url.includes("/transaction/charge_authorization"),
      handle: (request) =>
        mockJsonResponse({
          status: true,
          message: "Charge attempted",
          data: createPaystackTransaction({
            reference: String(request.body.reference ?? "ref_charge"),
            amount: Number(request.body.amount ?? 1500),
          }),
        }),
    },
    {
      match: (request) =>
        request.url.includes("/plan") &&
        request.method === "POST" &&
        !request.url.includes("/plan/"),
      handle: (request) =>
        mockJsonResponse({
          status: true,
          message: "Plan created",
          data: createPaystackPlan({
            name: String(request.body.name ?? "Pro"),
            plan_code: String(request.body.name ?? "PLN_pro").startsWith("PLN_")
              ? String(request.body.name)
              : `PLN_${String(request.body.name ?? "pro").toLowerCase()}`,
            amount: Number(request.body.amount ?? 800),
          }),
        }),
    },
    {
      match: (request) =>
        request.url.includes("/plan/") && request.method === "GET",
      handle: (request) => {
        const idOrCode = decodeURIComponent(
          request.url.split("/plan/")[1]?.split("?")[0] ??
            DEMO_PAYSTACK_PLAN_CODE
        );

        return mockJsonResponse({
          status: true,
          message: "Plan fetched",
          data: createPaystackPlan({
            plan_code: idOrCode.startsWith("PLN_")
              ? idOrCode
              : DEMO_PAYSTACK_PLAN_CODE,
          }),
        });
      },
    },
    {
      match: (request) =>
        request.url.includes("/plan") &&
        request.method === "GET" &&
        !request.url.includes("/plan/"),
      handle: () =>
        mockJsonResponse({
          status: true,
          message: "Plans retrieved",
          data: [createPaystackPlan()],
        }),
    },
    {
      match: (request) =>
        request.url.includes("/subscription") &&
        request.method === "POST" &&
        !request.url.includes("/subscription/"),
      handle: () =>
        mockJsonResponse({
          status: true,
          message: "Subscription created",
          data: createPaystackSubscription(),
        }),
    },
    {
      match: (request) =>
        request.url.includes("/subscription/") &&
        request.method === "GET" &&
        !request.url.includes("/subscription/disable") &&
        !request.url.includes("/subscription/enable"),
      handle: (request) => {
        const code = decodeURIComponent(
          request.url.split("/subscription/")[1]?.split("?")[0] ?? ""
        );

        return mockJsonResponse({
          status: true,
          message: "Subscription fetched",
          data: createPaystackSubscription({ subscription_code: code }),
        });
      },
    },
    {
      match: (request) => request.url.includes("/subscription/disable"),
      handle: () =>
        mockJsonResponse({
          status: true,
          message: "Subscription disabled",
        }),
    },
    {
      match: (request) => request.url.includes("/subscription/enable"),
      handle: () =>
        mockJsonResponse({
          status: true,
          message: "Subscription enabled",
        }),
    },
    {
      match: (request) =>
        request.url.includes("/subscription") &&
        request.method === "GET" &&
        !request.url.includes("/subscription/"),
      handle: () =>
        mockJsonResponse({
          status: true,
          message: "Subscriptions retrieved",
          data: [createPaystackSubscription()],
        }),
    },
  ];

  const handlers = [...(options.handlers ?? []), ...defaultHandlers];

  return vi.fn(
    (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const request = parseMockFetchRequest(input, init);
      const handler = handlers.find((entry) => entry.match(request));

      return Promise.resolve(
        handler?.handle(request) ??
          options.defaultResponse ??
          mockJsonResponse({ status: true, message: "OK", data: {} })
      );
    }
  ) as typeof fetch;
}

export function createPaystackClient(
  overrides: { fetch?: typeof fetch; secretKey?: string } = {}
): Paystack {
  return new Paystack({
    secretKey: overrides.secretKey ?? TEST_SECRET_KEY,
    fetch: overrides.fetch ?? createMockFetch(),
  });
}

const WEBHOOK_CUSTOMER = {
  id: 1,
  first_name: "Test",
  last_name: "User",
  email: "demo+paystack@example.com",
  customer_code: DEMO_PAYSTACK_CUSTOMER_CODE,
  phone: null,
  metadata: { userId: "user_1" },
} as const;

const WEBHOOK_PLAN = {
  id: 1716,
  name: "Pro",
  plan_code: DEMO_PAYSTACK_PLAN_CODE,
  amount: 800,
  interval: "monthly",
  currency: "GHS",
} as const;

const WEBHOOK_AUTHORIZATION = {
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

export function createChargeSuccessWebhookEvent(
  overrides: {
    reference?: string;
    subscription_code?: string;
    metadata?: Record<string, unknown>;
    customer?: typeof WEBHOOK_CUSTOMER;
    plan?: typeof WEBHOOK_PLAN | null;
  } = {}
) {
  return {
    event: "charge.success" as const,
    data: {
      id: 1001,
      domain: "test",
      status: "success" as const,
      reference: overrides.reference ?? "ref_webhook_1",
      amount: 1500,
      message: null,
      gateway_response: "Successful",
      paid_at: "2026-01-01T00:00:00.000Z",
      created_at: "2026-01-01T00:00:00.000Z",
      channel: "card",
      currency: "GHS",
      customer: overrides.customer ?? WEBHOOK_CUSTOMER,
      plan: overrides.plan === null ? null : (overrides.plan ?? WEBHOOK_PLAN),
      subscription_code: overrides.subscription_code ?? "SUB_test123",
      metadata: overrides.metadata ?? { userId: "user_1" },
    },
  };
}

export function createSubscriptionCreateWebhookEvent(
  overrides: {
    subscription_code?: string;
    metadata?: Record<string, unknown> | null;
  } = {}
) {
  return {
    event: "subscription.create" as const,
    data: {
      id: 4192,
      domain: "test",
      status: "active",
      subscription_code:
        overrides.subscription_code ?? DEMO_PAYSTACK_SUBSCRIPTION_CODE,
      email_token: "email_token_demo",
      amount: 800,
      cron_expression: "0 0 * * *",
      next_payment_date: "2026-02-01T00:00:00.000Z",
      plan: WEBHOOK_PLAN,
      authorization: WEBHOOK_AUTHORIZATION,
      customer: {
        ...WEBHOOK_CUSTOMER,
        metadata: overrides.metadata ?? WEBHOOK_CUSTOMER.metadata,
      },
    },
  };
}
