import { describe, expect } from "vitest";
import { createSubscriptionRecord } from "./_factories";
import {
  createDemoRemoteTestSubscriptions,
  createMockFetch,
  createPaystackClient,
  createPaystackOptions,
  createSubscriptionActionRequest,
  createUpgradeRequest,
  DEMO_PAYSTACK_CUSTOMER_CODE,
  DEMO_PAYSTACK_CUSTOMER_ID,
  setupAuthenticatedUpgradeTest,
  test,
} from "./_fixtures";

async function seedPaystackCustomer(
  adapter: {
    update: (args: {
      model: string;
      where: Array<{ field: string; value: string }>;
      update: Record<string, string | number>;
    }) => Promise<unknown>;
    findMany: (args: {
      model: string;
      where: Array<{ field: string; value: string }>;
    }) => Promise<unknown[]>;
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
  headers: Headers,
  query?: Record<string, string>
): Request {
  const url = new URL(
    "http://localhost:3000/api/auth/paystack/subscription/list"
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

describe("paystack authorization", () => {
  test("rejects cancel for subscriptionCode owned by another user", async ({
    memory,
    paystackOptions,
  }) => {
    const { auth, headers } = await setupAuthenticatedUpgradeTest({
      memory,
      paystackOptions,
      seedSubscription: () =>
        createSubscriptionRecord({
          userId: "other_user",
          referenceId: "other_user",
          subscriptionCode: "SUB_other",
        }),
    });

    const response = await auth.handler(
      createSubscriptionActionRequest("cancel", headers, {
        subscriptionCode: "SUB_other",
      })
    );

    expect(response.status).toBe(404);
  });

  test("rejects get for subscriptionCode owned by another user", async ({
    memory,
    paystackOptions,
  }) => {
    const { auth, headers } = await setupAuthenticatedUpgradeTest({
      memory,
      paystackOptions,
      seedSubscription: () =>
        createSubscriptionRecord({
          userId: "other_user",
          referenceId: "other_user",
          subscriptionCode: "SUB_other",
        }),
    });

    const response = await auth.handler(
      new Request(
        "http://localhost:3000/api/auth/paystack/subscription/get?subscriptionCode=SUB_other",
        {
          method: "GET",
          headers: new Headers(headers),
        }
      )
    );

    expect(response.status).toBe(404);
  });

  test("does not expose emailToken in subscription responses", async ({
    memory,
    paystackOptions,
  }) => {
    const { auth, headers, userId } = await setupAuthenticatedUpgradeTest({
      memory,
      paystackOptions,
      seedSubscription: (ownerId) =>
        createSubscriptionRecord({
          userId: ownerId,
          referenceId: ownerId,
        }),
    });

    const response = await auth.handler(
      new Request(
        "http://localhost:3000/api/auth/paystack/subscription/get?subscriptionCode=SUB_old",
        {
          method: "GET",
          headers: new Headers(headers),
        }
      )
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as Record<string, unknown>;
    expect(json.userId).toBe(userId);
    expect(json).not.toHaveProperty("emailToken");
  });

  test("rejects upgrade for subscriptionCode owned by another user", async ({
    memory,
    paystackOptions,
  }) => {
    const { auth, headers } = await setupAuthenticatedUpgradeTest({
      memory,
      paystackOptions,
      seedSubscription: () =>
        createSubscriptionRecord({
          userId: "other_user",
          referenceId: "other_user",
        }),
    });

    const response = await auth.handler(
      createUpgradeRequest(
        {
          plan: "basic",
          annual: false,
          callbackUrl: "https://app.example.com/success",
          disableRedirect: true,
          subscriptionCode: "SUB_old",
        },
        headers
      )
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as { upgraded: boolean };
    expect(json.upgraded).toBe(false);
  });

  test("rejects list when customer query param does not match authenticated user", async ({
    memory,
  }) => {
    const demoRemoteSubscriptions = createDemoRemoteTestSubscriptions();
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
      createSubscriptionListRequest(headers, {
        customer: "999999",
      })
    );

    expect(response.status).toBe(400);

    const records = await adapter.findMany({
      model: "subscription",
      where: [{ field: "userId", value: userId }],
    });
    expect(records).toHaveLength(0);
  });
});
