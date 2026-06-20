import { createHmac } from "node:crypto";
import { Paystack } from "@g14o/paystack";
import { memoryAdapter } from "better-auth/adapters/memory";
import { getTestInstance } from "better-auth/test";
import type { Mock } from "vitest";
import { test as baseTest, vi } from "vitest";
import type { getUserById } from "../src/customer";
import { paystack } from "../src/index";
import type { PaystackPluginOptions } from "../src/types";
import {
  createInitializeTransaction,
  createPaystackCustomer,
  createPaystackPlan,
  createPaystackSubscription,
} from "./_factories";

export const TEST_SECRET_KEY = "sk_test_integration";

/** Demo Paystack customer with two active subscriptions on the test integration. */
export const DEMO_PAYSTACK_CUSTOMER_CODE = "CUS_mkf7p9e3rtyahnz";

export const DEMO_PAYSTACK_CUSTOMER_ID = 374_466_993;

export const DEMO_PAYSTACK_SUBSCRIPTION_CODES = [
  "SUB_ga4snx1n36kituq",
  "SUB_aops53nsdklcs2h",
] as const;

export const DEMO_PAYSTACK_CUSTOMER_EMAIL = "demo+paystack@example.com";

export const TEST_PLANS = {
  pro: {
    name: "pro",
    interval: "monthly" as const,
    amount: "800",
    currency: "GHS",
  },
  basic: {
    name: "basic",
    interval: "monthly" as const,
    amount: "500",
    currency: "GHS",
  },
};

export const testUser = {
  email: "test@email.com",
  password: "password",
  name: "Test User",
};

export const createMemoryDatabase = (
  seed: {
    user?: unknown[];
    session?: unknown[];
    account?: unknown[];
    verification?: unknown[];
    subscription?: unknown[];
    webhookEvent?: unknown[];
  } = {}
) =>
  memoryAdapter({
    user: seed.user ?? [],
    session: seed.session ?? [],
    account: seed.account ?? [],
    verification: seed.verification ?? [],
    subscription: seed.subscription ?? [],
    webhookEvent: seed.webhookEvent ?? [],
  });

interface MockFetchRequest {
  body: Record<string, unknown>;
  method: string;
  url: string;
}

const mockJsonResponse = (payload: {
  status: boolean;
  message: string;
  data?: unknown;
}): Response => new Response(JSON.stringify(payload), { status: 200 });

const parseMockFetchRequest = (
  input: string | URL | Request,
  init?: RequestInit
): MockFetchRequest => ({
  url: typeof input === "string" ? input : input.toString(),
  method: init?.method ?? "GET",
  body: init?.body ? JSON.parse(String(init.body)) : {},
});

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

const handleCustomerCreate = (body: Record<string, unknown>): Response =>
  mockJsonResponse({
    status: true,
    message: "Customer created",
    data: {
      id: DEMO_PAYSTACK_CUSTOMER_ID,
      customer_code: "CUS_test123",
      email: body.email,
      metadata: parseMetadataBody(body.metadata),
    },
  });

const handleTransactionInitialize = (body: Record<string, unknown>): Response =>
  mockJsonResponse({
    status: true,
    message: "Authorization URL created",
    data: createInitializeTransaction({
      reference: String(body.reference ?? "ref_checkout"),
    }),
  });

const handlePlansList = (): Response =>
  mockJsonResponse({
    status: true,
    message: "Plans retrieved",
    data: [
      createPaystackPlan({
        id: 1,
        name: "Pro",
        plan_code: "PLN_pro",
        amount: 800,
      }),
      createPaystackPlan({
        id: 2,
        name: "Basic",
        plan_code: "PLN_basic",
        amount: 500,
      }),
    ],
  });

const handleSubscriptionDisable = (): Response =>
  mockJsonResponse({ status: true, message: "Subscription disabled" });

const handleSubscriptionEnable = (): Response =>
  mockJsonResponse({ status: true, message: "Subscription enabled" });

const handleCustomerFetch = (): Response =>
  mockJsonResponse({
    status: true,
    message: "Customer fetched",
    data: createPaystackCustomer({
      id: DEMO_PAYSTACK_CUSTOMER_ID,
      customer_code: DEMO_PAYSTACK_CUSTOMER_CODE,
      email: DEMO_PAYSTACK_CUSTOMER_EMAIL,
    }),
  });

const createDemoRemoteSubscription = (
  subscriptionCode: (typeof DEMO_PAYSTACK_SUBSCRIPTION_CODES)[number],
  plan: ReturnType<typeof createPaystackPlan>
) =>
  createPaystackSubscription({
    id: subscriptionCode === DEMO_PAYSTACK_SUBSCRIPTION_CODES[0] ? 1 : 2,
    subscription_code: subscriptionCode,
    email_token: `email_token_${subscriptionCode}`,
    status: "active",
    plan,
    customer: createPaystackCustomer({
      id: DEMO_PAYSTACK_CUSTOMER_ID,
      customer_code: DEMO_PAYSTACK_CUSTOMER_CODE,
      email: DEMO_PAYSTACK_CUSTOMER_EMAIL,
      metadata: { userId: "demo_user" },
    }),
    authorization: {
      authorization_code: "AUTH_demo",
      reusable: true,
    },
  });

/** Two active subscriptions for the demo Paystack customer. */
export const createDemoRemoteTestSubscriptions = () => [
  createDemoRemoteSubscription(
    DEMO_PAYSTACK_SUBSCRIPTION_CODES[0],
    createPaystackPlan({
      id: 1,
      name: "Pro",
      plan_code: "PLN_pro",
      amount: 800,
    })
  ),
  createDemoRemoteSubscription(
    DEMO_PAYSTACK_SUBSCRIPTION_CODES[1],
    createPaystackPlan({
      id: 2,
      name: "Basic",
      plan_code: "PLN_basic",
      amount: 500,
    })
  ),
];

const handleSubscriptionFetch = (url: string): Response => {
  const subscriptionCode = decodeURIComponent(
    url.split("/subscription/")[1]?.split("?")[0] ?? "SUB_new"
  );
  const isOld = subscriptionCode === "SUB_old";
  const demoSubscription = createDemoRemoteTestSubscriptions().find(
    (subscription) => subscription.subscription_code === subscriptionCode
  );

  if (demoSubscription) {
    return mockJsonResponse({
      status: true,
      message: "Subscription fetched",
      data: demoSubscription,
    });
  }

  return mockJsonResponse({
    status: true,
    message: "Subscription fetched",
    data: createPaystackSubscription({
      id: isOld ? 1 : 2,
      subscription_code: subscriptionCode,
      email_token: isOld ? "email_token_old" : "email_token_new",
      amount: isOld ? 800 : 500,
      plan: createPaystackPlan(
        isOld
          ? { id: 1, name: "Pro", plan_code: "PLN_pro", amount: 800 }
          : { id: 2, name: "Basic", plan_code: "PLN_basic", amount: 500 }
      ),
      customer: createPaystackCustomer({ email: "test@test.com" }),
    }),
  });
};

const mockDefaultResponse = (): Response =>
  mockJsonResponse({ status: true, message: "OK", data: {} });

export const createMockFetch = (
  options: {
    remoteSubscriptions?: ReturnType<typeof createPaystackSubscription>[];
  } = {}
): typeof fetch => {
  const remoteSubscriptions = options.remoteSubscriptions ?? [];

  const handleSubscriptionList = (request: MockFetchRequest): Response => {
    const url = new URL(request.url);
    const customerParam = url.searchParams.get("customer");
    const customerId = customerParam
      ? Number.parseInt(customerParam, 10)
      : Number.NaN;

    const filteredSubscriptions =
      Number.isNaN(customerId) || customerId !== DEMO_PAYSTACK_CUSTOMER_ID
        ? []
        : remoteSubscriptions;

    return mockJsonResponse({
      status: true,
      message: "Subscriptions retrieved",
      data: filteredSubscriptions,
    });
  };

  const mockFetchHandlers: Array<{
    match: (request: MockFetchRequest) => boolean;
    handle: (request: MockFetchRequest) => Response;
  }> = [
    {
      match: (request) =>
        request.url.includes("/customer") && request.method === "POST",
      handle: (request) => handleCustomerCreate(request.body),
    },
    {
      match: (request) => request.url.includes("/transaction/initialize"),
      handle: (request) => handleTransactionInitialize(request.body),
    },
    {
      match: (request) =>
        request.url.includes("/plan") && request.method === "GET",
      handle: () => handlePlansList(),
    },
    {
      match: (request) =>
        request.url.includes("/subscription/disable") &&
        request.method === "POST",
      handle: () => handleSubscriptionDisable(),
    },
    {
      match: (request) =>
        request.url.includes("/subscription/enable") &&
        request.method === "POST",
      handle: () => handleSubscriptionEnable(),
    },
    {
      match: (request) =>
        request.url.includes("/customer/") && request.method === "GET",
      handle: () => handleCustomerFetch(),
    },
    {
      match: (request) =>
        request.url.includes("/subscription") &&
        request.method === "GET" &&
        !request.url.includes("/subscription/"),
      handle: (request) => handleSubscriptionList(request),
    },
    {
      match: (request) =>
        request.url.includes("/subscription/") && request.method === "GET",
      handle: (request) => handleSubscriptionFetch(request.url),
    },
  ];

  return vi.fn(
    (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const request = parseMockFetchRequest(input, init);
      const handler = mockFetchHandlers.find((entry) => entry.match(request));
      return Promise.resolve(
        handler ? handler.handle(request) : mockDefaultResponse()
      );
    }
  ) as typeof fetch;
};

export const createPaystackClient = (
  overrides: {
    fetch?: typeof fetch;
    secretKey?: string;
    remoteSubscriptions?: ReturnType<typeof createPaystackSubscription>[];
  } = {}
) =>
  new Paystack({
    secretKey: overrides.secretKey ?? TEST_SECRET_KEY,
    fetch:
      overrides.fetch ??
      createMockFetch({ remoteSubscriptions: overrides.remoteSubscriptions }),
  });

export const createPaystackOptions = (
  paystackClient: Paystack,
  options: Partial<Omit<PaystackPluginOptions, "paystackClient">> = {}
): PaystackPluginOptions =>
  ({
    paystackClient,
    createCustomerOnSignUp: false,
    subscription: {
      enabled: true,
      plans: [TEST_PLANS.pro, TEST_PLANS.basic],
    },
    ...options,
  }) as PaystackPluginOptions;

export const signPaystackWebhook = (body: string, secretKey: string): string =>
  createHmac("sha512", secretKey).update(body).digest("hex");

export const createUpgradeRequest = (
  body: Record<string, unknown>,
  headers?: Headers | Record<string, string>
): Request => {
  const requestHeaders = new Headers({ "Content-Type": "application/json" });

  if (headers instanceof Headers) {
    for (const [key, value] of headers.entries()) {
      requestHeaders.set(key, value);
    }
  } else if (headers) {
    for (const [key, value] of Object.entries(headers)) {
      if (value !== undefined) {
        requestHeaders.set(key, String(value));
      }
    }
  }

  return new Request(
    "http://localhost:3000/api/auth/paystack/subscription/upgrade",
    {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(body),
    }
  );
};

export const createSubscriptionActionRequest = (
  action: "cancel" | "resume",
  headers: Headers,
  body: Record<string, string> = {}
): Request =>
  new Request(
    `http://localhost:3000/api/auth/paystack/subscription/${action}`,
    {
      method: "POST",
      headers: new Headers({
        ...Object.fromEntries(headers.entries()),
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(body),
    }
  );

export type PaystackAdapter = Parameters<typeof getUserById>[0];

type AuthenticatedUpgradeTestContext = Awaited<
  ReturnType<typeof getTestInstance>
> & {
  headers: Headers;
  userId: string;
  adapter: PaystackAdapter;
};

export const setupAuthenticatedUpgradeTest = async (options: {
  memory: ReturnType<typeof createMemoryDatabase>;
  paystackOptions: PaystackPluginOptions;
  seedSubscription?: (userId: string) => Record<string, unknown>;
}): Promise<AuthenticatedUpgradeTestContext> => {
  const instance = await getTestInstance(
    {
      database: options.memory,
      plugins: [paystack(options.paystackOptions)],
    },
    { disableTestUser: true }
  );

  const signUpRes = await instance.client.signUp.email(testUser, {
    throw: true,
  });
  const { headers } = await instance.signInWithUser(
    testUser.email,
    testUser.password
  );
  const ctx = await instance.auth.$context;

  if (options.seedSubscription) {
    await ctx.adapter.create({
      model: "subscription",
      data: options.seedSubscription(signUpRes.user.id),
    });
  }

  return {
    ...instance,
    headers,
    userId: signUpRes.user.id,
    adapter: ctx.adapter as PaystackAdapter,
  } as unknown as AuthenticatedUpgradeTestContext;
};

export const test = baseTest.extend<{
  mockFetch: Mock;
  paystackClient: Paystack;
  memory: ReturnType<typeof createMemoryDatabase>;
  paystackOptions: PaystackPluginOptions;
}>({
  mockFetch: async (
    { task: _task }: { task: unknown },
    use: (value: Mock) => Promise<void>
  ) => {
    const mockFetch = createMockFetch();
    await use(mockFetch as Mock);
  },
  paystackClient: async (
    { mockFetch },
    use: (value: Paystack) => Promise<void>
  ) => {
    await use(createPaystackClient({ fetch: mockFetch as typeof fetch }));
  },
  memory: async (
    { task: _task }: { task: unknown },
    use: (value: ReturnType<typeof createMemoryDatabase>) => Promise<void>
  ) => {
    await use(createMemoryDatabase());
  },
  paystackOptions: async (
    { paystackClient },
    use: (value: PaystackPluginOptions) => Promise<void>
  ) => {
    await use(createPaystackOptions(paystackClient));
  },
});
