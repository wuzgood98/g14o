import { getTestInstance } from "better-auth/test";
import { describe, expect } from "vitest";
import { paystackClientPlugin } from "../src/client";
import { getCustomerByUserId } from "../src/customer";
import { paystack } from "../src/index";
import { createPaystackOptions, test, testUser } from "./_fixtures";

describe("paystack customer", () => {
  test("should create a customer on sign up", async ({
    memory,
    paystackClient,
  }) => {
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
      {
        disableTestUser: true,
        clientOptions: {
          plugins: [paystackClientPlugin()],
        },
      }
    );
    const ctx = await auth.$context;

    const userRes = await client.signUp.email(testUser, {
      throw: true,
    });

    const customer = await getCustomerByUserId(
      ctx.adapter as Parameters<typeof getCustomerByUserId>[0],
      userRes.user.id
    );

    expect(customer).toMatchObject({
      userId: userRes.user.id,
      email: testUser.email,
      customerCode: expect.any(String),
      customerId: expect.any(Number),
    });
  });
});
