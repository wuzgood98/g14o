import { type RateLimitTier, tokenConfigSnapshot } from "@g14o/ratelimit";

/** Display order for built-in tier defaults (matches setup docs). */
export const rateLimitTierOrder = [
  "strict",
  "moderate",
  "lenient",
  "auth",
  "write",
] as const satisfies readonly RateLimitTier[];

/** Typical use per tier — mirrors JSDoc on `RateLimitTiersOverride`. */
export const rateLimitTierUsage: Record<RateLimitTier, string> = {
  strict: "Tightest tier — abuse-prone or expensive routes.",
  moderate: "General API default when `tier` is omitted.",
  lenient: "Higher-traffic read endpoints.",
  auth: "Login, signup, password reset.",
  write: "Mutations and write-heavy actions.",
};

/** Built-in tier defaults sourced from `tokenConfigSnapshot` (single source of truth). */
export const rateLimitTierDefaults = rateLimitTierOrder.map((tier) => ({
  tier,
  ...tokenConfigSnapshot[tier],
  usage: rateLimitTierUsage[tier],
}));
