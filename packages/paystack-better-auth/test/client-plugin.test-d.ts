import { createAuthClient } from "better-auth/client";
import { paystackClient } from "../src/client";

const authClient = createAuthClient({
  plugins: [paystackClient({ subscription: true })],
});

authClient.paystack.createCheckoutSession({
  amount: 500,
  currency: "GHS",
  disableRedirect: true,
});

authClient.paystack.subscription.upgrade({
  plan: "pro",
  disableRedirect: true,
  callbackUrl: "https://example.com/auth/paystack/callback",
});

authClient.paystack.createCheckoutSession({
  amount: 500,
  currency: "GHS",
  // @ts-expect-error -- unknown prop should be rejected
  callbackUrll: "https://example.com",
});

authClient.paystack.subscription.upgrade({
  plan: "pro",
  // @ts-expect-error -- unknown prop should be rejected
  callbackUrll: "https://example.com",
});
