import type { Mock } from "vitest";
import { describe, expect } from "vitest";
import {
  createDemoRemoteTestSubscriptions,
  createMockFetch,
  createPaystackClient,
  createPaystackOptions,
  createUpgradeRequest,
  DEMO_PAYSTACK_CUSTOMER_CODE,
  DEMO_PAYSTACK_CUSTOMER_ID,
  DEMO_PAYSTACK_SUBSCRIPTION_CODES,
  setupAuthenticatedUpgradeTest,
  test,
} from "./_fixtures";

const upgradeBody = {
  plan: "basic",
  annual: false,
  callbackUrl: "https://app.example.com/success",
  cancelActionUrl: "https://app.example.com/cancel",
  channels: ["card", "mobile_money"],
  disableRedirect: true,
  subscriptionCode: DEMO_PAYSTACK_SUBSCRIPTION_CODES[0],
};

async function seedPaystackCustomer(
  adapter: {
    update: (args: {
      model: string;
      where: Array<{ field: string; value: string }>;
      update: Record<string, string | number>;
    }) => Promise<unknown>;
  },
  userId: string
) {
  await adapter.update({
    model: "user",
    where: [{ field: "id", value: userId }],
    update: {
      paystackCustomerCode: DEMO_PAYSTACK_CUSTOMER_CODE,
      paystackCustomerId: DEMO_PAYSTACK_CUSTOMER_ID,
    },
  });
}

function createSubscriptionListRequest(
  path: string,
  headers: Headers,
  query?: Record<string, string>
): Request {
  const url = new URL(
    `http://localhost:3000/api/auth/paystack/subscription/${path}`
  );

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
  }

  return new Request(url, {
    method: "GET",
    headers: new Headers(headers),
  });
}

function createSubscriptionActionRequest(
  action: "cancel" | "resume",
  headers: Headers,
  body: Record<string, string> = {}
): Request {
  return new Request(
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
}

const demoRemoteSubscriptions = createDemoRemoteTestSubscriptions();

const remoteSubscriptionPaystackOptions = createPaystackOptions(
  createPaystackClient({
    remoteSubscriptions: demoRemoteSubscriptions,
  })
);

describe("subscription reconciliation", () => {
  test("list reconciles both demo customer subscriptions into the local database", async ({
    memory,
  }) => {
    const mockFetch = createMockFetch({
      remoteSubscriptions: demoRemoteSubscriptions,
    });
    const paystackClient = createPaystackClient({ fetch: mockFetch });
    const paystackOptions = createPaystackOptions(paystackClient);
    const { auth, headers, userId, adapter } =
      await setupAuthenticatedUpgradeTest({
        memory,
        paystackOptions,
      });

    await seedPaystackCustomer(adapter, userId);

    const response = await auth.handler(
      createSubscriptionListRequest("list", headers)
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as Array<{
      subscriptionCode: string;
      userId: string;
    }>;
    expect(json).toHaveLength(2);
    expect(json.map((record) => record.subscriptionCode).sort()).toEqual(
      [...DEMO_PAYSTACK_SUBSCRIPTION_CODES].sort()
    );
    expect(json.every((record) => record.userId === userId)).toBe(true);

    const listCall = (mockFetch as Mock).mock.calls.find(([url]) => {
      const parsed = new URL(String(url));
      return (
        parsed.pathname.endsWith("/subscription") &&
        parsed.searchParams.get("customer") ===
          String(DEMO_PAYSTACK_CUSTOMER_ID)
      );
    });
    expect(listCall).toBeDefined();
  });

  test("getSubscription reconciles on miss for a specific demo subscription", async ({
    memory,
  }) => {
    const { auth, headers, userId, adapter } =
      await setupAuthenticatedUpgradeTest({
        memory,
        paystackOptions: remoteSubscriptionPaystackOptions,
      });

    await seedPaystackCustomer(adapter, userId);

    const response = await auth.handler(
      createSubscriptionListRequest("get", headers, {
        subscriptionCode: DEMO_PAYSTACK_SUBSCRIPTION_CODES[0],
      })
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      subscriptionCode: string;
      userId: string;
      emailToken: string;
    };
    expect(json.subscriptionCode).toBe(DEMO_PAYSTACK_SUBSCRIPTION_CODES[0]);
    expect(json.userId).toBe(userId);
    expect(json.emailToken).toBe(
      `email_token_${DEMO_PAYSTACK_SUBSCRIPTION_CODES[0]}`
    );
  });

  test("cancel reconciles on miss and disables the remote subscription", async ({
    memory,
  }) => {
    const mockFetch = createMockFetch({
      remoteSubscriptions: demoRemoteSubscriptions,
    });
    const paystackClient = createPaystackClient({ fetch: mockFetch });
    const paystackOptions = createPaystackOptions(paystackClient);
    const { auth, headers, userId, adapter } =
      await setupAuthenticatedUpgradeTest({
        memory,
        paystackOptions,
      });

    await seedPaystackCustomer(adapter, userId);

    const response = await auth.handler(
      createSubscriptionActionRequest("cancel", headers, {
        subscriptionCode: DEMO_PAYSTACK_SUBSCRIPTION_CODES[0],
      })
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as { status: string };
    expect(json.status).toBe("cancelled");

    const disableCall = (mockFetch as Mock).mock.calls.find(([url]) =>
      String(url).includes("/subscription/disable")
    );
    expect(disableCall).toBeDefined();
  });

  test("resume reconciles on miss and enables the remote subscription", async ({
    memory,
  }) => {
    const mockFetch = createMockFetch({
      remoteSubscriptions: demoRemoteSubscriptions,
    });
    const paystackClient = createPaystackClient({ fetch: mockFetch });
    const paystackOptions = createPaystackOptions(paystackClient);
    const { auth, headers, userId, adapter } =
      await setupAuthenticatedUpgradeTest({
        memory,
        paystackOptions,
      });

    await seedPaystackCustomer(adapter, userId);

    const response = await auth.handler(
      createSubscriptionActionRequest("resume", headers, {
        subscriptionCode: DEMO_PAYSTACK_SUBSCRIPTION_CODES[1],
      })
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as { status: string };
    expect(json.status).toBe("active");

    const enableCall = (mockFetch as Mock).mock.calls.find(([url]) =>
      String(url).includes("/subscription/enable")
    );
    expect(enableCall).toBeDefined();
  });

  test("upgrade reconciles demo pro subscription and sets supersede metadata", async ({
    memory,
  }) => {
    const mockFetch = createMockFetch({
      remoteSubscriptions: demoRemoteSubscriptions,
    });
    const paystackClient = createPaystackClient({ fetch: mockFetch });
    const paystackOptions = createPaystackOptions(paystackClient);
    const { auth, headers, userId, adapter } =
      await setupAuthenticatedUpgradeTest({
        memory,
        paystackOptions,
      });

    await seedPaystackCustomer(adapter, userId);

    const response = await auth.handler(
      createUpgradeRequest(upgradeBody, headers)
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as { upgraded: boolean };
    expect(json.upgraded).toBe(true);

    const initializeCall = (mockFetch as Mock).mock.calls.find(([url]) =>
      String(url).includes("/transaction/initialize")
    );
    expect(initializeCall).toBeDefined();
    const initBody = JSON.parse(String(initializeCall?.[1]?.body)) as {
      metadata: { supersedeSubscriptionCode?: string };
    };
    expect(initBody.metadata.supersedeSubscriptionCode).toBe(
      DEMO_PAYSTACK_SUBSCRIPTION_CODES[0]
    );
  });
});
