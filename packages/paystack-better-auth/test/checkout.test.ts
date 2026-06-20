import { getTestInstance } from "better-auth/test";
import { describe, expect } from "vitest";
import { paystack } from "../src/index";
import { test } from "./_fixtures";

describe("paystack checkout", () => {
  test("creates checkout session for anonymous payment", async ({
    memory,
    paystackOptions,
  }) => {
    const { auth } = await getTestInstance({
      database: memory,
      plugins: [paystack(paystackOptions)],
    });

    const response = await auth.handler(
      new Request(
        "http://localhost:3000/api/auth/paystack/checkout/create-session",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: 1500,
            currency: "GHS",
            email: "anonymous@example.com",
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
  });

  test("strips reserved metadata keys from guest checkout initialize payload", async ({
    memory,
    paystackOptions,
    mockFetch,
  }) => {
    const { auth } = await getTestInstance({
      database: memory,
      plugins: [paystack(paystackOptions)],
    });

    const response = await auth.handler(
      new Request(
        "http://localhost:3000/api/auth/paystack/checkout/create-session",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: 1500,
            currency: "GHS",
            email: "anonymous@example.com",
            disableRedirect: true,
            metadata: {
              userId: "user_victim",
              referenceId: "ref_victim",
              source: "guest",
            },
          }),
        }
      )
    );

    expect(response.status).toBe(200);

    const initializeCall = mockFetch.mock.calls.find(([url]) =>
      String(url).includes("/transaction/initialize")
    );
    expect(initializeCall).toBeDefined();
    const initBody = JSON.parse(String(initializeCall?.[1]?.body)) as {
      metadata: Record<string, unknown>;
    };
    expect(initBody.metadata).toEqual({ source: "guest" });
  });
});
