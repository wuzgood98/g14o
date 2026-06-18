import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";

interface TestResult {
  detail?: unknown;
  error?: string;
  name: string;
  ok: boolean;
}

async function runTest(
  name: string,
  fn: () => Promise<unknown>
): Promise<TestResult> {
  try {
    const detail = await fn();
    return { name, ok: true, detail };
  } catch (error) {
    return {
      name,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function GET(request: Request) {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session) {
    return Response.json(
      { error: "Sign in required to run server plugin API tests" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") ?? "all";
  const results: TestResult[] = [];

  const runAction = async (name: string, fn: () => Promise<unknown>) => {
    if (action !== "all" && action !== name) {
      return;
    }
    results.push(await runTest(name, fn));
  };

  await runAction("createPaystackCustomer", () =>
    auth.api.createPaystackCustomer({
      body: {},
      headers: requestHeaders,
    })
  );

  await runAction("getPaystackCustomer", () =>
    auth.api.getPaystackCustomer({
      query: {},
      headers: requestHeaders,
    })
  );

  await runAction("syncPaystackCustomer", () =>
    auth.api.syncPaystackCustomer({
      body: {},
      headers: requestHeaders,
    })
  );

  await runAction("createCheckoutSession", () =>
    auth.api.createCheckoutSession({
      body: {
        email: "demo@example.com",
        amount: 500,
        currency: "GHS",
        disableRedirect: true,
        callbackUrl: `${env.NEXT_PUBLIC_APP_URL}/`,
        cancelActionUrl: `${env.NEXT_PUBLIC_APP_URL}/`,
        metadata: { demo: true },
        channels: [
          "card",
          "bank",
          "mobile_money",
          "bank_transfer",
          "apple_pay",
        ],
      },
      headers: requestHeaders,
    })
  );

  await runAction("upgradeSubscription", () =>
    auth.api.upgradeSubscription({
      body: {
        plan: "basic",
        annual: false,
        callbackUrl: `${env.NEXT_PUBLIC_APP_URL}/`,
        cancelActionUrl: `${env.NEXT_PUBLIC_APP_URL}/`,
        channels: [
          "card",
          "bank",
          "mobile_money",
          "bank_transfer",
          "apple_pay",
        ],
        disableRedirect: true,
      },
      headers: requestHeaders,
    })
  );

  await runAction("listSubscriptions", () =>
    auth.api.listActiveSubscriptions({
      query: { customer: session.user.paystackCustomerId },
      headers: requestHeaders,
    })
  );

  await runAction("getSubscription", async () => {
    if (!session.user.paystackCustomerId) {
      return {
        skipped: true,
        reason: "No Paystack customer ID — run createPaystackCustomer first",
      };
    }
    const subscriptions = await auth.api.listActiveSubscriptions({
      query: { customer: session.user.paystackCustomerId },
      headers: requestHeaders,
    });
    const list = subscriptions;
    const first = list[0];

    if (!first?.subscriptionCode) {
      return {
        skipped: true,
        reason: "No subscription in database — run webhook simulation first",
      };
    }

    return auth.api.getSubscription({
      query: { subscriptionCode: first.subscriptionCode },
      headers: requestHeaders,
    });
  });

  await runAction("cancelSubscription", async () => {
    if (!session.user.paystackCustomerId) {
      return {
        skipped: true,
        reason: "No Paystack customer ID — run createPaystackCustomer first",
      };
    }
    const subscriptions = await auth.api.listActiveSubscriptions({
      query: { customer: session.user.paystackCustomerId },
      headers: requestHeaders,
    });
    const list = subscriptions;
    const first = list[0];

    if (!first?.subscriptionCode) {
      return {
        skipped: true,
        reason: "No subscription in database — run webhook simulation first",
      };
    }

    return auth.api.cancelSubscription({
      body: { subscriptionCode: first.subscriptionCode },
      headers: requestHeaders,
    });
  });

  await runAction("resumeSubscription", async () => {
    const subscriptions = await auth.api.listActiveSubscriptions({
      query: { customer: session.user.paystackCustomerId },
      headers: requestHeaders,
    });
    const list = subscriptions;
    const first = list[0];

    if (!first?.subscriptionCode) {
      return {
        skipped: true,
        reason: "No subscription in database — run webhook simulation first",
      };
    }

    return auth.api.resumeSubscription({
      body: { subscriptionCode: first.subscriptionCode },
      headers: requestHeaders,
    });
  });

  await runAction("chargeAuthorization", async () => {
    try {
      return await auth.api.chargeAuthorization({
        body: {
          amount: 500,
          currency: "GHS",
        },
        headers: requestHeaders,
      });
    } catch (error) {
      return {
        skipped: true,
        reason:
          "Requires a Paystack customer with a reusable saved authorization",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  });

  const passed = results.filter((result) => result.ok).length;
  const failed = results.filter((result) => !result.ok).length;

  return Response.json({
    userId: session.user.id,
    action,
    summary: { total: results.length, passed, failed },
    results,
  });
}
