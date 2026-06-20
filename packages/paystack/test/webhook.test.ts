/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: for testing */
import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { PaystackError, WebhookVerificationError } from "../src/client/errors";
import { Paystack } from "../src/client/paystack-client";
import {
  createChargeSuccessWebhookEvent,
  createPaystackClient,
  TEST_SECRET_KEY,
} from "./_fixtures";

const SECRET_KEY = TEST_SECRET_KEY;
const invalidWebhookSignatureRegex = /Invalid webhook signature/;
const invalidWebhookPayloadRegex = /Invalid webhook payload/;
const missingWebhookSignatureRegex = /Missing x-paystack-signature/;

function signWebhookBody(body: string, secretKey = SECRET_KEY): string {
  return createHmac("sha512", secretKey).update(body).digest("hex");
}

function createWebhookRequest(
  payload: { event: string; data: Record<string, unknown> } | string,
  options?: {
    secretKey?: string;
    signature?: string | null;
    omitSignature?: boolean;
  }
): Request {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  const secretKey = options?.secretKey ?? SECRET_KEY;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (!options?.omitSignature) {
    const signature =
      options?.signature === undefined
        ? signWebhookBody(body, secretKey)
        : options.signature;
    if (signature) {
      headers["x-paystack-signature"] = signature;
    }
  }

  return new Request("https://example.com/webhook", {
    method: "POST",
    headers,
    body,
  });
}

describe("paystack.webhook.verifyPaystackWebhookSignature", () => {
  const paystack = new Paystack({ secretKey: SECRET_KEY });

  it("verifies valid signatures", () => {
    const body = JSON.stringify(createChargeSuccessWebhookEvent());
    const signature = signWebhookBody(body);

    expect(() =>
      paystack.webhook.verifyPaystackWebhookSignature(body, signature)
    ).not.toThrow();
  });

  it("rejects invalid signatures", () => {
    const body = JSON.stringify(createChargeSuccessWebhookEvent());

    expect(() =>
      paystack.webhook.verifyPaystackWebhookSignature(body, "invalid")
    ).toThrow(invalidWebhookSignatureRegex);
  });

  it("rejects missing signatures", () => {
    const body = JSON.stringify(createChargeSuccessWebhookEvent());

    expect(() =>
      paystack.webhook.verifyPaystackWebhookSignature(body, null)
    ).toThrow(missingWebhookSignatureRegex);
    expect(() =>
      paystack.webhook.verifyPaystackWebhookSignature(body, null)
    ).toThrow(expect.objectContaining({ code: "WEBHOOK_MISSING_SIGNATURE" }));
  });

  it("rejects re-serialized bodies when raw bytes differ", () => {
    const rawBody =
      '{\n  "event": "charge.success",\n  "data": {\n    "reference": "ref_raw",\n    "amount": 1000\n  }\n}';
    const reSerialized = JSON.stringify(JSON.parse(rawBody));
    const signature = signWebhookBody(rawBody);

    expect(rawBody).not.toBe(reSerialized);
    expect(() =>
      paystack.webhook.verifyPaystackWebhookSignature(reSerialized, signature)
    ).toThrow(invalidWebhookSignatureRegex);
    expect(() =>
      paystack.webhook.verifyPaystackWebhookSignature(rawBody, signature)
    ).not.toThrow();
  });
});

describe("paystack.webhook.parseWebhookPayload", () => {
  const paystack = new Paystack({ secretKey: SECRET_KEY });

  it("parses valid payloads", () => {
    const payload = createChargeSuccessWebhookEvent({ reference: "ref_1" });

    expect(
      paystack.webhook.parseWebhookPayload(JSON.stringify(payload))
    ).toEqual(payload);
  });

  it("rejects invalid payloads", () => {
    expect(() =>
      paystack.webhook.parseWebhookPayload(
        JSON.stringify({ event: "", data: {} })
      )
    ).toThrow(invalidWebhookPayloadRegex);
    expect(() =>
      paystack.webhook.parseWebhookPayload(
        JSON.stringify({ event: "", data: {} })
      )
    ).toThrow(
      expect.objectContaining({
        code: "PAYSTACK_VALIDATION_ERROR",
        statusCode: 400,
      })
    );
  });

  it("rejects malformed JSON payloads", () => {
    expect(() => paystack.webhook.parseWebhookPayload("{not-json")).toThrow(
      invalidWebhookPayloadRegex
    );
    expect(() => paystack.webhook.parseWebhookPayload("{not-json")).toThrow(
      expect.objectContaining({
        code: "PAYSTACK_VALIDATION_ERROR",
        statusCode: 400,
      })
    );
  });
});

describe("paystack.webhook.verifyWebhookRequest", () => {
  const paystack = new Paystack({ secretKey: SECRET_KEY });

  it("returns the raw body for valid signed requests", async () => {
    const payload = createChargeSuccessWebhookEvent({ reference: "ref_1" });
    const rawBody = JSON.stringify(payload);
    const request = createWebhookRequest(payload);

    await expect(paystack.webhook.verifyWebhookRequest(request)).resolves.toBe(
      rawBody
    );
  });

  it("rejects requests without a body", async () => {
    await expect(
      paystack.webhook.verifyWebhookRequest(undefined)
    ).rejects.toMatchObject({
      code: "PAYSTACK_VALIDATION_ERROR",
      statusCode: 400,
      message: "Invalid request body",
    });

    await expect(
      paystack.webhook.verifyWebhookRequest(new Request("https://example.com"))
    ).rejects.toMatchObject({
      code: "PAYSTACK_VALIDATION_ERROR",
      statusCode: 400,
      message: "Invalid request body",
    });
  });

  it("rejects requests without a signature header", async () => {
    const request = createWebhookRequest(
      createChargeSuccessWebhookEvent({ reference: "ref_1" }),
      { omitSignature: true }
    );

    await expect(
      paystack.webhook.verifyWebhookRequest(request)
    ).rejects.toMatchObject({
      code: "PAYSTACK_VALIDATION_ERROR",
      statusCode: 400,
      message: "Webhook signature not found",
    });
  });

  it("rejects requests with invalid signatures", async () => {
    const request = createWebhookRequest(
      createChargeSuccessWebhookEvent({ reference: "ref_1" }),
      { signature: "invalid" }
    );

    await expect(
      paystack.webhook.verifyWebhookRequest(request)
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof PaystackError &&
        error.code === "PAYSTACK_VALIDATION_ERROR" &&
        error.statusCode === 400 &&
        error.message === "Webhook verification failed" &&
        error.cause instanceof WebhookVerificationError
    );
  });
});

describe("paystack.webhook.processWebhookRequest", () => {
  const paystack = new Paystack({ secretKey: SECRET_KEY });

  it("returns parsed payloads for valid signed requests", async () => {
    const payload = createChargeSuccessWebhookEvent({ reference: "ref_1" });
    const request = createWebhookRequest(payload);

    await expect(
      paystack.webhook.processWebhookRequest(request)
    ).resolves.toEqual(payload);
  });

  it("rejects invalid payloads after successful verification", async () => {
    const request = createWebhookRequest({ event: "", data: {} });

    await expect(
      paystack.webhook.processWebhookRequest(request)
    ).rejects.toMatchObject({
      code: "PAYSTACK_VALIDATION_ERROR",
      statusCode: 400,
      message: "Invalid webhook payload",
    });
  });

  it("rejects malformed JSON after successful verification", async () => {
    const malformedBody = "{not-json";
    const request = createWebhookRequest(malformedBody);

    await expect(
      paystack.webhook.processWebhookRequest(request)
    ).rejects.toMatchObject({
      code: "PAYSTACK_VALIDATION_ERROR",
      statusCode: 400,
      message: "Invalid webhook payload",
    });
  });

  it("rejects requests with invalid signatures", async () => {
    const request = createWebhookRequest(
      createChargeSuccessWebhookEvent({ reference: "ref_1" }),
      { signature: "invalid" }
    );

    await expect(
      paystack.webhook.processWebhookRequest(request)
    ).rejects.toMatchObject({
      code: "PAYSTACK_VALIDATION_ERROR",
      statusCode: 400,
      message: "Webhook verification failed",
    });
  });
});

describe("paystack.webhook.processWebhookDelivery", () => {
  const paystack = createPaystackClient();

  it("calls the handler and returns the parsed event", async () => {
    const payload = createChargeSuccessWebhookEvent({
      reference: "ref_delivery",
    });
    const request = createWebhookRequest(payload);
    const handler = vi.fn(async () => {});

    await expect(
      paystack.webhook.processWebhookDelivery(request, { handler })
    ).resolves.toEqual({ duplicate: false, event: payload });
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(payload);
  });

  it("returns duplicate when the store rejects reprocessing", async () => {
    const payload = createChargeSuccessWebhookEvent({ reference: "ref_dup" });
    const request = createWebhookRequest(payload);
    const handler = vi.fn(async () => {});
    const store = {
      shouldProcess: vi.fn(async () => false),
      persist: vi.fn(async () => {}),
      markProcessed: vi.fn(async () => {}),
      markFailed: vi.fn(async () => {}),
    };

    await expect(
      paystack.webhook.processWebhookDelivery(request, { handler, store })
    ).resolves.toEqual({ duplicate: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it("marks failed deliveries and throws when the handler fails", async () => {
    const payload = createChargeSuccessWebhookEvent({ reference: "ref_fail" });
    const request = createWebhookRequest(payload);
    const store = {
      shouldProcess: vi.fn(async () => true),
      persist: vi.fn(async () => {}),
      markProcessed: vi.fn(async () => {}),
      markFailed: vi.fn(async () => {}),
    };

    await expect(
      paystack.webhook.processWebhookDelivery(request, {
        handler: () => {
          throw new Error("handler failed");
        },
        store,
      })
    ).rejects.toMatchObject({
      code: "WEBHOOK_PROCESSING_ERROR",
      statusCode: 400,
      message: "Webhook processing failed",
    });
    expect(store.markFailed).toHaveBeenCalledWith(
      "charge.success:ref_fail",
      "handler failed"
    );
  });

  it("skips persistence when disabled", async () => {
    const payload = createChargeSuccessWebhookEvent({
      reference: "ref_no_store",
    });
    const request = createWebhookRequest(payload);
    const store = {
      shouldProcess: vi.fn(async () => true),
      persist: vi.fn(async () => {}),
      markProcessed: vi.fn(async () => {}),
      markFailed: vi.fn(async () => {}),
    };

    await paystack.webhook.processWebhookDelivery(request, {
      disablePersistence: true,
      handler: async () => {},
      store,
    });

    expect(store.shouldProcess).not.toHaveBeenCalled();
    expect(store.persist).not.toHaveBeenCalled();
    expect(store.markProcessed).not.toHaveBeenCalled();
  });
});
