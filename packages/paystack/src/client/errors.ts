/** Error codes returned by the Paystack HTTP client. */
export type PaystackErrorCode =
  | "PAYSTACK_API_ERROR"
  | "PAYSTACK_VALIDATION_ERROR"
  | "PAYSTACK_NETWORK_ERROR"
  | "PAYSTACK_RATE_LIMIT"
  | "PAYSTACK_TIMEOUT"
  | "WEBHOOK_PROCESSING_ERROR";

/** Error codes for webhook signature verification failures. */
export type WebhookVerificationErrorCode =
  | "WEBHOOK_MISSING_SIGNATURE"
  | "WEBHOOK_INVALID_SIGNATURE"
  | "WEBHOOK_INVALID_PAYLOAD";

/** Error codes for subscription lifecycle operations. */
export type SubscriptionErrorCode =
  | "SUBSCRIPTION_NOT_FOUND"
  | "SUBSCRIPTION_ALREADY_CANCELLED"
  | "SUBSCRIPTION_PLAN_NOT_FOUND"
  | "SUBSCRIPTION_MISSING_EMAIL_TOKEN"
  | "SUBSCRIPTION_OPERATION_FAILED";

/** Error codes for checkout initialization and verification. */
export type CheckoutErrorCode =
  | "CHECKOUT_INITIALIZATION_FAILED"
  | "CHECKOUT_VERIFICATION_FAILED"
  | "CHECKOUT_INVALID_AMOUNT";

/** Error codes for Paystack customer sync operations. */
export type CustomerSyncErrorCode =
  | "CUSTOMER_NOT_FOUND"
  | "CUSTOMER_CREATE_FAILED"
  | "CUSTOMER_SYNC_FAILED"
  | "CUSTOMER_ALREADY_EXISTS";

/** Base error for Paystack API client failures. */
export class PaystackError extends Error {
  readonly code: PaystackErrorCode;
  readonly statusCode?: number;
  readonly paystackMessage?: string;

  constructor(
    message: string,
    options: {
      code: PaystackErrorCode;
      statusCode?: number;
      paystackMessage?: string;
      cause?: unknown;
    }
  ) {
    super(message, { cause: options.cause });
    this.name = "PaystackError";
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.paystackMessage = options.paystackMessage;
  }
}

/** Thrown when webhook HMAC-SHA512 verification fails. */
export class WebhookVerificationError extends Error {
  readonly code: WebhookVerificationErrorCode;

  constructor(message: string, code: WebhookVerificationErrorCode) {
    super(message);
    this.name = "WebhookVerificationError";
    this.code = code;
  }
}

/** Thrown when subscription operations fail (cancel, resume, lookup). */
export class SubscriptionError extends Error {
  readonly code: SubscriptionErrorCode;

  constructor(message: string, code: SubscriptionErrorCode, cause?: unknown) {
    super(message, { cause });
    this.name = "SubscriptionError";
    this.code = code;
  }
}

/** Thrown when checkout session creation or verification fails. */
export class CheckoutError extends Error {
  readonly code: CheckoutErrorCode;

  constructor(message: string, code: CheckoutErrorCode, cause?: unknown) {
    super(message, { cause });
    this.name = "CheckoutError";
    this.code = code;
  }
}

/** Thrown when Paystack customer create/sync operations fail. */
export class CustomerSyncError extends Error {
  readonly code: CustomerSyncErrorCode;

  constructor(message: string, code: CustomerSyncErrorCode, cause?: unknown) {
    super(message, { cause });
    this.name = "CustomerSyncError";
    this.code = code;
  }
}

/** Union of all structured plugin errors. */
export type PaystackPluginError =
  | PaystackError
  | WebhookVerificationError
  | SubscriptionError
  | CheckoutError
  | CustomerSyncError;
