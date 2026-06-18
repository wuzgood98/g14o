import { defineErrorCodes } from "@better-auth/core/utils/error-codes";

export const PAYSTACK_ERROR_CODES = defineErrorCodes({
  UNAUTHORIZED: "Unauthorized access",
  EMAIL_REQUIRED: "Email is required for anonymous checkout",
  SUBSCRIPTION_PLANS_NOT_ENABLED: "Subscription plans are not enabled",
  SUBSCRIPTION_NOT_FOUND: "Subscription not found",
  SUBSCRIPTION_ALREADY_ON_PLAN: "User is already subscribed to this plan",
  SUBSCRIPTION_PLAN_NOT_FOUND: "Subscription plan not found",
  SUBSCRIPTION_MISSING_EMAIL_TOKEN:
    "Missing email token for subscription operation",
  CUSTOMER_NOT_FOUND: "Customer not found",
  CUSTOMER_CREATE_FAILED: "Unable to create Paystack customer",
  CUSTOMER_SYNC_FAILED: "Unable to sync Paystack customer",
  CHECKOUT_INITIALIZATION_FAILED: "Unable to initialize checkout session",
  CHARGE_AUTHORIZATION_FAILED: "Unable to charge authorization",
  WEBHOOK_SIGNATURE_NOT_FOUND: "Paystack signature not found",
  WEBHOOK_SECRET_NOT_FOUND: "Paystack webhook secret not found",
  INVALID_WEBHOOK_PAYLOAD: "Invalid webhook payload",
  WEBHOOK_VERIFICATION_FAILED: "Paystack webhook verification failed",
  WEBHOOK_PROCESSING_ERROR: "Paystack webhook processing error",
  INVALID_REQUEST_BODY: "Invalid request body",
  INVALID_PLUGIN_OPTIONS:
    "Provide either paystackClient or secretKey to the paystack plugin, not both",
  MISSING_PLUGIN_CREDENTIALS:
    "Either paystackClient or secretKey must be provided to the paystack plugin",
});
