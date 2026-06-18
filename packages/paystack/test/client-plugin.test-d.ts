import { createAuthClient } from "better-auth/client";
import { paystackClientPlugin } from "../src/client";

const authClient = createAuthClient({
  plugins: [paystackClientPlugin()],
});

authClient.subscription.createCheckoutSession({
  amount: 500,
  currency: "GHS",
  disableRedirect: true,
});

authClient.subscription.upgrade({
  plan: "pro",
  disableRedirect: true,
});

authClient.subscription.createCheckoutSession({
  amount: 500,
  currency: "GHS",
  // @ts-expect-error -- unknown prop should be rejected
  callbackUrll: "https://example.com",
});

authClient.subscription.upgrade({
  plan: "pro",
  // @ts-expect-error -- unknown prop should be rejected
  callbackUrll: "https://example.com",
});
