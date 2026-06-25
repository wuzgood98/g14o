export function hasPaystackCredentials(): boolean {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  return typeof secretKey === "string" && secretKey.startsWith("sk_test_");
}

export function requireLiveSecretKey(): string {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!secretKey) {
    throw new Error(
      "PAYSTACK_SECRET_KEY is required for live Paystack integration tests."
    );
  }

  if (!secretKey.startsWith("sk_test_")) {
    throw new Error(
      "PAYSTACK_SECRET_KEY must be a Paystack test secret key (sk_test_*)."
    );
  }

  return secretKey;
}

export function createUniqueTestEmail(prefix = "paystack-ba-test"): string {
  return `${prefix}+${Date.now()}@example.com`;
}
