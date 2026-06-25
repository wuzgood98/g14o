import { Paystack } from "@g14o/paystack";
import { getTestInstance } from "better-auth/test";
import { beforeAll, describe, expect, it } from "vitest";
import { getCustomerByUserId } from "../src/customer";
import { paystack } from "../src/index";
import {
  createMemoryDatabase,
  createPaystackOptions,
  DEMO_PAYSTACK_CUSTOMER_CODE,
  setupAuthenticatedUpgradeTest,
  wrapPaystackContext,
} from "./_fixtures";
import {
  createUniqueTestEmail,
  hasPaystackCredentials,
  requireLiveSecretKey,
} from "./integration-env";

const customerCodeRegex = /^CUS_/;

describe.skipIf(!hasPaystackCredentials())(
  "paystack-better-auth live API smoke",
  () => {
    let paystackClient: Paystack;
    let demoCustomerAvailable = false;
    let demoReconciliationAvailable = false;
    let liveDemoCustomer: { customer_code: string; id: number } | null = null;
    let liveDemoSubscriptionCodes: string[] = [];

    beforeAll(async () => {
      paystackClient = new Paystack({ secretKey: requireLiveSecretKey() });

      try {
        const demoCustomer = await paystackClient.customers.fetch(
          DEMO_PAYSTACK_CUSTOMER_CODE
        );
        demoCustomerAvailable =
          demoCustomer.customer_code === DEMO_PAYSTACK_CUSTOMER_CODE;

        if (demoCustomerAvailable) {
          liveDemoCustomer = {
            customer_code: demoCustomer.customer_code,
            id: demoCustomer.id,
          };

          const subscriptions = await paystackClient.subscriptions.list({
            customer: demoCustomer.id,
            perPage: 100,
            page: 1,
          });

          liveDemoSubscriptionCodes = subscriptions.map(
            (subscription) => subscription.subscription_code
          );
          demoReconciliationAvailable = liveDemoSubscriptionCodes.length > 0;
        }
      } catch {
        demoCustomerAvailable = false;
        demoReconciliationAvailable = false;
        liveDemoCustomer = null;
        liveDemoSubscriptionCodes = [];
      }
    });

    describe.sequential("plugin smoke", () => {
      it("creates a Paystack customer on sign up", async () => {
        const email = createUniqueTestEmail();
        const memory = createMemoryDatabase();
        const { client, auth } = await getTestInstance(
          {
            database: memory,
            plugins: [
              paystack(
                createPaystackOptions(paystackClient, {
                  createCustomerOnSignUp: true,
                })
              ),
            ],
          },
          { disableTestUser: true }
        );
        const ctx = await auth.$context;

        const userRes = await client.signUp.email(
          {
            email,
            password: "password",
            name: "Smoke Test User",
          },
          { throw: true }
        );

        const customer = await getCustomerByUserId(
          wrapPaystackContext(ctx),
          userRes.user.id
        );

        expect(customer).toMatchObject({
          userId: userRes.user.id,
          email,
          customerCode: expect.stringMatching(customerCodeRegex),
          customerId: expect.any(Number),
        });

        const remoteCustomer = await paystackClient.customers.fetch(email);
        expect(remoteCustomer.customer_code).toBe(customer?.customerCode);
      });

      it("creates a guest checkout session against the live API", async () => {
        const email = createUniqueTestEmail();
        const memory = createMemoryDatabase();
        const { auth } = await getTestInstance({
          database: memory,
          plugins: [paystack(createPaystackOptions(paystackClient))],
        });

        const response = await auth.handler(
          new Request(
            "http://localhost:3000/api/auth/paystack/create-checkout-session",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                amount: 1500,
                currency: "GHS",
                email,
                disableRedirect: true,
              }),
            }
          )
        );

        expect(response.status).toBe(200);
        const json = (await response.json()) as {
          authorizationUrl: string;
          reference: string;
        };
        expect(json.authorizationUrl).toContain("checkout.paystack.com");
        expect(json.reference).toBeTruthy();

        const transaction = await paystackClient.transactions.verify(
          json.reference
        );
        expect(transaction.reference).toBe(json.reference);
        expect(["abandoned", "failed", "success", "pending"]).toContain(
          transaction.status
        );
      });

      it("reconciles demo customer subscriptions into the local database", async ({
        skip,
      }) => {
        if (!(demoReconciliationAvailable && liveDemoCustomer)) {
          skip();
        }

        const remote = await paystackClient.subscriptions.list({
          customer: liveDemoCustomer.id,
          perPage: 100,
        });
        expect(remote.length).toBeGreaterThan(0);

        const memory = createMemoryDatabase();
        const paystackOptions = createPaystackOptions(paystackClient);
        const { auth, headers, userId, context } =
          await setupAuthenticatedUpgradeTest({
            memory,
            paystackOptions,
          });

        await context.context.adapter.update({
          model: "user",
          where: [{ field: "id", value: userId }],
          update: {
            paystackCustomerCode: liveDemoCustomer.customer_code,
            paystackCustomerId: liveDemoCustomer.id,
          },
        });

        const response = await auth.handler(
          new Request(
            "http://localhost:3000/api/auth/paystack/subscription/list",
            {
              method: "GET",
              headers: new Headers(headers),
            }
          )
        );

        expect(response.status).toBe(200);
        const json = (await response.json()) as Array<{
          subscriptionCode: string;
          userId: string;
        }>;
        expect(json).toHaveLength(liveDemoSubscriptionCodes.length);
        expect(json.map((record) => record.subscriptionCode).sort()).toEqual(
          [...liveDemoSubscriptionCodes].sort()
        );
        expect(json.every((record) => record.userId === userId)).toBe(true);
      });
    });
  }
);
