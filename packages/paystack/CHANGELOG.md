# @g14o/paystack

## Unreleased

### Patch Changes

- Align API response Zod schemas in `responses.ts` with official Paystack payloads to prevent validation errors on real API responses.

  ### Fixes

  - Accept `null` on authorization fields that Paystack returns as null: `signature`, `bank`, and `account_name`. Fixes `transactions.verify` and `transaction/charge_authorization` failing with `PAYSTACK_VALIDATION_ERROR` when `authorization.signature` is `null`.
  - Make all optional webhook event fields in `webhook-events.ts` nullish (`.nullish()`) so Paystack payloads with `null` optional values parse without `PAYSTACK_VALIDATION_ERROR`.

  ### Schema expansions

  - **Authorization** (`paystackAuthorizationSchema`): add `account_name`; make `bank` and `signature` nullable.
  - **Transaction** (`paystackTransactionSchema`): add `receipt_number`, `ip_address`, `fees`, `fees_split`, `order_id`, `pos_transaction_data`, `source`, `fees_breakdown`, `connect`, `transaction_date`, `paidAt`, `createdAt`, `requested_amount`, `log`, `split`, `subaccount`, `plan_object`; make `gateway_response` nullable.
  - **Customer** (`paystackCustomerSchema`): add `domain`, `integration`, `identified`, `identifications`, `dedicated_account`, `international_format_phone`, timestamp aliases, `transactions`, `subscriptions`, `total_transactions`, `total_transaction_value`.
  - **Plan** (`paystackPlanSchema`): add `domain`, `integration`, `hosted_page`, `hosted_page_url`, `hosted_page_summary`, timestamps, `subscriptions`.
  - **Subscription** (`paystackSubscriptionSchema`): add `integration`, `start`, `quantity`, `easy_cron_id`, `updatedAt`, `invoices`; allow `plan` and `customer` as either a numeric ID or embedded object.
  - **Customer list meta**: use Paystack's list shape (`next`, `previous`, `perPage`) instead of the plan-list meta schema.

  These are additive type/schema changes only — no breaking changes to client method signatures. Regression tests added in `test/client.test.ts` and doc-shaped fixtures in `test/_fixtures.ts`.

## 0.1.0

### Minor Changes

- f9786ad: Initial release of `@g14o/paystack` — a typed Paystack REST SDK with Zod-validated responses, retries, and webhook verification.

  Includes the `Paystack` client for customers, transactions, subscriptions, and plans; webhook signature verification; typed webhook event parsing; and webhook delivery deduplication helpers.
