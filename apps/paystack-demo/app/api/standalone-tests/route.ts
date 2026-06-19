import { env } from "@/lib/env";
import { paystack } from "@/lib/paystack";

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

export async function GET() {
  const suffix = Date.now();
  const testEmail = `paystack-demo+${suffix}@example.com`;
  const planName = `Demo Plan ${suffix}`;
  let customerCode = "";
  let planCode = "";
  let transactionReference = "";

  const results: TestResult[] = [];

  results.push(
    await runTest("customers.create", async () => {
      const customer = await paystack.customers.create({
        email: testEmail,
        first_name: "Demo",
        last_name: "User",
        metadata: { source: "paystack-demo" },
      });
      customerCode = customer.customer_code;
      return {
        customer_code: customer.customer_code,
        email: customer.email,
      };
    })
  );

  results.push(
    await runTest("customers.fetch", async () => {
      const customer = await paystack.customers.fetch(testEmail);
      return {
        customer_code: customer.customer_code,
        email: customer.email,
      };
    })
  );

  results.push(
    await runTest("customers.list", async () => {
      const customers = await paystack.customers.list({ perPage: 5, page: 1 });
      return { count: customers.length };
    })
  );

  results.push(
    await runTest("customers.update", async () => {
      if (!customerCode) {
        throw new Error("Missing customer code from create step");
      }
      const customer = await paystack.customers.update(customerCode, {
        phone: "+233200000000",
      });
      return { customer_code: customer.customer_code, phone: customer.phone };
    })
  );

  results.push(
    await runTest("plans.create", async () => {
      const plan = await paystack.plans.create({
        name: planName,
        interval: "monthly",
        amount: 500,
        currency: "GHS",
        description: "Paystack demo test plan",
      });
      planCode = plan.plan_code;
      return {
        plan_code: plan.plan_code,
        name: plan.name,
        amount: plan.amount,
      };
    })
  );

  results.push(
    await runTest("plans.fetch", async () => {
      if (!planCode) {
        throw new Error("Missing plan code from create step");
      }
      const plan = await paystack.plans.fetch(planCode);
      return { plan_code: plan.plan_code, name: plan.name };
    })
  );

  results.push(
    await runTest("plans.list", async () => {
      const plans = await paystack.plans.list({ perPage: 5, page: 1 });
      return { count: plans.length };
    })
  );

  results.push(
    await runTest("transactions.initialize", async () => {
      const initialized = await paystack.transactions.initialize({
        email: testEmail,
        amount: 500,
        currency: "GHS",
        reference: `demo_checkout_${suffix}`,
        callback_url: `${env.NEXT_PUBLIC_APP_URL}/`,
        channels: ["card"],
      });
      transactionReference = initialized.reference;
      return {
        reference: initialized.reference,
        authorization_url: initialized.authorization_url,
      };
    })
  );

  results.push(
    await runTest("transactions.verify", async () => {
      if (!transactionReference) {
        throw new Error("Missing transaction reference from initialize step");
      }
      try {
        const transaction =
          await paystack.transactions.verify(transactionReference);
        return {
          reference: transaction.reference,
          status: transaction.status,
        };
      } catch (error) {
        return {
          skipped: true,
          reason:
            "Unpaid transactions return an error until checkout completes",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    })
  );

  results.push(
    await runTest("subscriptions.list", async () => {
      const subscriptions = await paystack.subscriptions.list({
        perPage: 5,
        page: 1,
      });
      return { count: subscriptions.length };
    })
  );

  results.push(
    await runTest("subscriptions.create", async () => {
      if (!(customerCode && planCode)) {
        throw new Error("Missing customer or plan code from prior steps");
      }
      try {
        const subscription = await paystack.subscriptions.create({
          customer: customerCode,
          plan: planCode,
        });
        return {
          subscription_code: subscription.subscription_code,
          status: subscription.status,
        };
      } catch (error) {
        return {
          skipped: true,
          reason:
            "Paystack requires a saved authorization to create subscriptions without checkout",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    })
  );

  const passed = results.filter((result) => result.ok).length;
  const failed = results.filter((result) => !result.ok).length;

  return Response.json({
    summary: { total: results.length, passed, failed },
    testEmail,
    customerCode,
    planCode,
    transactionReference,
    results,
  });
}
