import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";

function signWebhookBody(body: string): string {
  return createHmac("sha512", env.PAYSTACK_SECRET_KEY)
    .update(body)
    .digest("hex");
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    event?: string;
    data?: Record<string, unknown>;
  };

  const event = body.event ?? "charge.success";
  const payload = {
    event,
    data: body.data ?? {
      reference: `ref_demo_${Date.now()}`,
      amount: 1500,
      currency: "GHS",
      status: "success",
    },
  };

  const rawBody = JSON.stringify(payload);
  const signature = signWebhookBody(rawBody);
  const webhookUrl = `${env.BETTER_AUTH_URL}/api/auth/paystack/webhook`;

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-paystack-signature": signature,
    },
    body: rawBody,
  });

  const responseBody = await response.json().catch(() => null);

  return Response.json({
    ok: response.ok,
    status: response.status,
    event,
    payload,
    response: responseBody,
  });
}

export async function GET() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  const chargeSuccessPayload = {
    event: "charge.success",
    data: {
      reference: `ref_ping_${Date.now()}`,
      amount: 100,
      currency: "GHS",
      status: "success",
      metadata: session?.user.id ? { userId: session.user.id } : {},
    },
  };

  const rawBody = JSON.stringify(chargeSuccessPayload);
  const signature = signWebhookBody(rawBody);

  return Response.json({
    webhookUrl: `${env.BETTER_AUTH_URL}/api/auth/paystack/webhook`,
    sessionUserId: session?.user.id ?? null,
    samplePayload: chargeSuccessPayload,
    signaturePreview: `${signature.slice(0, 12)}…`,
    supportedEvents: [
      "charge.success",
      "subscription.create",
      "subscription.disable",
      "subscription.not_renew",
      "invoice.create",
      "invoice.update",
      "invoice.payment_failed",
      "subscription.expiring_cards",
    ],
  });
}
