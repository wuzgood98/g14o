import { describe, expect, it, vi } from "vitest";
import { PaystackHttpClient } from "../src/client/http";

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
