import { APIError } from "@better-auth/core/error";
import { PAYSTACK_ERROR_CODES } from "./error-codes";
import type { DbPaystackSubscription } from "./types";

/** Subscription record safe to return from HTTP endpoints (no emailToken). */
export type PublicPaystackSubscription = Omit<
  DbPaystackSubscription,
  "emailToken"
>;

/**
 * Ensures a subscription record belongs to the authenticated user.
 * Returns 404 on mismatch to avoid user enumeration.
 */
export function assertSubscriptionOwnership(
  record: DbPaystackSubscription,
  userId: string
): void {
  if (record.userId !== userId) {
    throw APIError.from(
      "NOT_FOUND",
      PAYSTACK_ERROR_CODES.SUBSCRIPTION_NOT_FOUND
    );
  }
}

/** Strips sensitive fields before returning subscription data from API routes. */
export function toPublicSubscription(
  record: DbPaystackSubscription
): PublicPaystackSubscription {
  const { emailToken: _emailToken, ...publicRecord } = record;
  return publicRecord;
}
