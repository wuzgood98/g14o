import { describe, expect, it, vi } from "vitest";
import { PaystackError } from "../src/client/errors";
import { PaystackHttpClient } from "../src/client/http";
import { Paystack } from "../src/client/paystack-client";
import { normalizePlanName } from "../src/utils";

describe("PaystackHttpClient", () => {
  it("retries on 429 and succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Too many requests" }), {
          status: 429,
          headers: { "Retry-After": "0" },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ status: true, message: "OK", data: { ok: true } }),
          { status: 200 }
        )
      );

    const client = new PaystackHttpClient({
      secretKey: "sk_test",
      fetch: fetchMock,
      initialRetryDelayMs: 1,
    });

    const result = await client.request<{
      status: boolean;
      message: string;
      data: { ok: boolean };
    }>({
      method: "GET",
      path: "/plan",
    });

    expect(result.data.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws PaystackError on non-retryable 400", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Bad request" }), {
        status: 400,
      })
    );

    const client = new PaystackHttpClient({
      secretKey: "sk_test",
      fetch: fetchMock,
      maxRetries: 0,
    });

    await expect(
      client.request({ method: "GET", path: "/plan" })
    ).rejects.toMatchObject({ code: "PAYSTACK_API_ERROR", statusCode: 400 });
  });
});

describe("Paystack client validation", () => {
  it("parses initialize transaction response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: true,
          message: "Authorization URL created",
          data: {
            authorization_url: "https://checkout.paystack.com/abc",
            access_code: "access",
            reference: "ref_123",
          },
        }),
        { status: 200 }
      )
    );

    const client = new Paystack({ secretKey: "sk_test", fetch: fetchMock });
    const result = await client.transactions.initialize({
      email: "test@example.com",
      amount: 1000,
    });

    expect(result.authorization_url).toContain("checkout.paystack.com");
    expect(result.reference).toBe("ref_123");
  });

  it("throws validation error for malformed response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: true, message: "OK", data: {} }), {
        status: 200,
      })
    );

    const client = new Paystack({ secretKey: "sk_test", fetch: fetchMock });

    await expect(
      client.transactions.initialize({
        email: "test@example.com",
        amount: 1000,
      })
    ).rejects.toBeInstanceOf(PaystackError);
  });
});

describe("normalizePlanName", () => {
  it("normalizes plan names", () => {
    expect(normalizePlanName(" Pro ")).toBe("pro");
  });
});
