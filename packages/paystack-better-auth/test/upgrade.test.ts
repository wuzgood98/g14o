import { describe, expect } from "vitest";
import { createSubscriptionRecord } from "./_factories";
import {
  createUpgradeRequest,
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
  metadata: {
    userId: "user_123",
    referenceId: "ref_123",
    planName: "basic",
  },
};

describe("paystack subscription upgrade", () => {
  test("creates checkout when user has no subscription", async ({
    memory,
    paystackOptions,
  }) => {
    const { auth, headers } = await setupAuthenticatedUpgradeTest({
      memory,
      paystackOptions,
    });

    const response = await auth.handler(
      createUpgradeRequest(upgradeBody, headers)
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      authorizationUrl: string;
      reference: string;
      upgraded: boolean;
    };
    expect(json.authorizationUrl).toContain("checkout.paystack.com");
    expect(json.reference).toBeTruthy();
    expect(json.upgraded).toBe(false);
  }, 30_000);

  test("sets supersede metadata when upgrading from a live subscription", async ({
    memory,
    paystackOptions,
    mockFetch,
  }) => {
    const { auth, headers } = await setupAuthenticatedUpgradeTest({
      memory,
      paystackOptions,
      seedSubscription: (userId) =>
        createSubscriptionRecord({
          userId,
          referenceId: userId,
        }),
    });

    const response = await auth.handler(
      createUpgradeRequest(upgradeBody, headers)
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as { upgraded: boolean };
    expect(json.upgraded).toBe(true);

    const initializeCall = mockFetch.mock.calls.find(([url]) =>
      String(url).includes("/transaction/initialize")
    );
    expect(initializeCall).toBeDefined();
    const initBody = JSON.parse(String(initializeCall?.[1]?.body)) as {
      metadata: { supersedeSubscriptionCode?: string };
    };
    expect(initBody.metadata.supersedeSubscriptionCode).toBe("SUB_old");
  });

  test("rejects upgrade to the same plan", async ({
    memory,
    paystackOptions,
  }) => {
    const { auth, headers } = await setupAuthenticatedUpgradeTest({
      memory,
      paystackOptions,
      seedSubscription: (userId) =>
        createSubscriptionRecord({
          userId,
          referenceId: userId,
          planCode: "PLN_basic",
          planName: "basic",
        }),
    });

    const response = await auth.handler(
      createUpgradeRequest(upgradeBody, headers)
    );

    expect(response.status).toBe(400);
    const json = (await response.json()) as { message?: string };
    expect(json.message).toContain("already subscribed to this plan");
  });

  test("ignores subscriptionCode owned by another user and starts a new checkout", async ({
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
          ...upgradeBody,
          subscriptionCode: "SUB_old",
        },
        headers
      )
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as { upgraded: boolean };
    expect(json.upgraded).toBe(false);
  });

  test("rejects live subscription missing email token", async ({
    memory,
    paystackOptions,
  }) => {
    const { auth, headers } = await setupAuthenticatedUpgradeTest({
      memory,
      paystackOptions,
      seedSubscription: (userId) =>
        createSubscriptionRecord({
          userId,
          referenceId: userId,
          emailToken: "",
        }),
    });

    const response = await auth.handler(
      createUpgradeRequest(upgradeBody, headers)
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  test("ignores cancelled subscription and creates new checkout", async ({
    memory,
    paystackOptions,
  }) => {
    const { auth, headers } = await setupAuthenticatedUpgradeTest({
      memory,
      paystackOptions,
      seedSubscription: (userId) =>
        createSubscriptionRecord({
          userId,
          referenceId: userId,
          status: "cancelled",
        }),
    });

    const response = await auth.handler(
      createUpgradeRequest(upgradeBody, headers)
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as { upgraded: boolean };
    expect(json.upgraded).toBe(false);
  });
});
