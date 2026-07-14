import {
  type ChargeSuccessData,
  type InvoiceData,
  type PaystackCustomer,
  type PaystackEventName,
  type PaystackPlan,
  type PaystackSubscription,
  type PaystackWebhookEvent,
  parseSafeMetadata,
  type SubscriptionCreateData,
  type WebhookDeliveryStore,
} from "@g14o/paystack";
import type { GenericEndpointContext } from "better-auth";
import { checkoutMetadata, subscriptionMetadata } from "./metadata";
import type { PlanRegistry } from "./plans";
import type {
  CheckoutCompleteContext,
  PaystackPaymentRecord,
  PaystackSubscriptionRecord,
  PluginContext,
  ResolvedPlan,
} from "./types";
import {
  asDbPayment,
  asDbSubscription,
  asDbWebhookEvent,
  mapPaymentRecord,
  mapPaystackSubscriptionStatus,
  mapWebhookEventToStatus,
  parseMetadata,
  parseSubscriptionPeriod,
  shouldCancelAtPeriodEnd,
  toDbPayment,
  toDbSubscription,
  toDbWebhookEvent,
} from "./utils";

type Adapter = GenericEndpointContext["context"]["adapter"];

interface WebhookHandlerContext {
  ctx: GenericEndpointContext;
  planRegistry?: PlanRegistry | undefined;
  pluginContext: PluginContext;
}

type TypedWebhookHandler<E extends PaystackEventName> = (
  ctx: WebhookHandlerContext & {
    event: Extract<PaystackWebhookEvent, { event: E }>;
  }
) => Promise<void>;

const assertNever = (value: never): void => {
  throw new Error(`Invalid webhook event: ${JSON.stringify(value)}`);
};

const mapSubscriptionRecord = (
  record: ReturnType<typeof asDbSubscription>
): PaystackSubscriptionRecord => ({
  id: record.id,
  userId: record.userId,
  referenceId: record.referenceId,
  provider: "paystack",
  subscriptionCode: record.subscriptionCode,
  customerCode: record.customerCode,
  planCode: record.planCode,
  planName: record.planName,
  emailToken: record.emailToken,
  status: record.status as PaystackSubscriptionRecord["status"],
  currentPeriodStart: new Date(record.currentPeriodStart),
  currentPeriodEnd: record.currentPeriodEnd
    ? new Date(record.currentPeriodEnd)
    : null,
  cancelAtPeriodEnd: record.cancelAtPeriodEnd,
  metadata: parseMetadata(record.metadata),
});

const getReferenceIdFromMetadata = (
  metadata: Record<string, unknown> | undefined,
  fallbackUserId: string
): string => {
  const reference = metadata?.referenceId ?? metadata?.reference;

  return typeof reference === "string" ? reference : fallbackUserId;
};

const resolveCustomer = (
  customer: PaystackCustomer | number | undefined | null
): PaystackCustomer | undefined => {
  if (customer === undefined || customer === null) {
    return;
  }

  if (typeof customer === "number") {
    return;
  }

  return customer;
};

const resolvePlan = (
  plan: PaystackPlan | number | undefined | null
): PaystackPlan | undefined => {
  if (plan === undefined || plan === null) {
    return;
  }

  if (typeof plan === "number") {
    return;
  }

  return plan;
};

export const upsertSubscription = async (options: {
  adapter: Adapter;
  userId: string;
  referenceId: string;
  paystackSubscription: PaystackSubscription;
  plan?: ResolvedPlan | undefined;
  statusOverride?: PaystackSubscriptionRecord["status"] | undefined;
  cancelAtPeriodEnd?: boolean | undefined;
}) => {
  const period = parseSubscriptionPeriod(options.paystackSubscription);
  const status =
    options.statusOverride ??
    mapPaystackSubscriptionStatus(options.paystackSubscription.status);

  const existing = await options.adapter.findOne({
    model: "subscription",
    where: [
      {
        field: "subscriptionCode",
        value: options.paystackSubscription.subscription_code,
      },
    ],
  });

  const existingRecord = existing ? asDbSubscription(existing) : null;

  const payload = toDbSubscription({
    id: existingRecord?.id,
    userId: options.userId,
    referenceId: existingRecord?.referenceId ?? options.referenceId,
    subscriptionCode: options.paystackSubscription.subscription_code,
    customerCode:
      resolveCustomer(options.paystackSubscription.customer)?.customer_code ??
      existingRecord?.customerCode ??
      "",
    customerId:
      resolveCustomer(options.paystackSubscription.customer)?.id ??
      existingRecord?.customerId ??
      0,
    planCode:
      resolvePlan(options.paystackSubscription.plan)?.plan_code ??
      existingRecord?.planCode ??
      "",
    planName:
      options.plan?.normalizedName ??
      resolvePlan(options.paystackSubscription.plan)?.name?.toLowerCase() ??
      existingRecord?.planName ??
      "",
    emailToken:
      options.paystackSubscription.email_token ??
      existingRecord?.emailToken ??
      "",
    status,
    currentPeriodStart: period.currentPeriodStart,
    currentPeriodEnd: period.currentPeriodEnd,
    cancelAtPeriodEnd:
      options.cancelAtPeriodEnd ??
      shouldCancelAtPeriodEnd("", options.paystackSubscription.status),
    metadata: {
      paystackStatus: options.paystackSubscription.status,
    },
  });

  if (existingRecord) {
    const updated = await options.adapter.update({
      model: "subscription",
      where: [{ field: "id", value: existingRecord.id }],
      update: payload,
    });

    return mapSubscriptionRecord(asDbSubscription(updated));
  }

  const created = await options.adapter.create({
    model: "subscription",
    data: payload,
  });

  return mapSubscriptionRecord(asDbSubscription(created));
};

const findUserIdByCustomerCode = async (
  adapter: Adapter,
  customerCode: string | undefined
): Promise<string | null> => {
  if (!customerCode) {
    return null;
  }

  const user = await adapter.findOne({
    model: "user",
    where: [{ field: "paystackCustomerCode", value: customerCode }],
  });

  return (user as { id?: string } | null)?.id ?? null;
};

const parseChargeSuccessMetadata = (
  data: ChargeSuccessData
): Record<string, unknown> | undefined => {
  if (typeof data.metadata === "object" && data.metadata !== null) {
    return parseSafeMetadata(data.metadata as Record<string, unknown>);
  }

  if (typeof data.metadata === "string") {
    try {
      return parseSafeMetadata(
        JSON.parse(data.metadata) as Record<string, unknown>
      );
    } catch {
      return;
    }
  }

  return;
};

const parseCustomerMetadataFromCustomer = (
  customer: SubscriptionCreateData["customer"]
): Record<string, unknown> | undefined =>
  parseSafeMetadata(customer.metadata ?? undefined);

const resolveUserId = async (
  adapter: Adapter,
  metadata: Record<string, unknown> | undefined,
  customerCode?: string | undefined
): Promise<string | null> => {
  const customerUserId = await findUserIdByCustomerCode(adapter, customerCode);

  if (customerUserId) {
    return customerUserId;
  }

  if (typeof metadata?.userId === "string" && metadata.userId) {
    return metadata.userId;
  }

  return null;
};

const findExistingSubscription = async (
  adapter: Adapter,
  subscriptionCode: string
) => {
  const existingRaw = await adapter.findOne({
    model: "subscription",
    where: [{ field: "subscriptionCode", value: subscriptionCode }],
  });

  return existingRaw ? asDbSubscription(existingRaw) : null;
};

const fetchPaystackSubscription = async (
  pluginContext: PluginContext,
  subscriptionCode: string
): Promise<PaystackSubscription> =>
  pluginContext.options.paystackClient.subscriptions.fetch(subscriptionCode);

const isSubscriptionChargeSuccess = (data: ChargeSuccessData): boolean =>
  typeof data.subscription_code === "string" &&
  data.subscription_code.length > 0 &&
  typeof data.plan === "object" &&
  data.plan !== null;

const findPaymentByReference = async (adapter: Adapter, reference: string) => {
  const existing = await adapter.findOne({
    model: "payment",
    where: [{ field: "reference", value: reference }],
  });

  return existing ? asDbPayment(existing) : null;
};

const upsertPayment = async (options: {
  adapter: Adapter;
  data: ChargeSuccessData;
  metadata?: Record<string, unknown> | undefined;
  referenceId?: string | undefined;
  userId?: string | undefined;
}): Promise<PaystackPaymentRecord> => {
  const existing = await findPaymentByReference(
    options.adapter,
    options.data.reference
  );

  const payload = toDbPayment({
    id: existing?.id,
    reference: options.data.reference,
    transactionId: options.data.id,
    userId: options.userId,
    referenceId: options.referenceId,
    customerCode: options.data.customer.customer_code,
    customerId: options.data.customer.id,
    amount: options.data.amount,
    currency: options.data.currency,
    status: "successful",
    channel: options.data.channel,
    paidAt: new Date(options.data.paid_at),
    metadata: options.metadata,
  });

  if (existing) {
    const updated = await options.adapter.update({
      model: "payment",
      where: [{ field: "id", value: existing.id }],
      update: payload,
    });

    return mapPaymentRecord(asDbPayment(updated));
  }

  const created = await options.adapter.create({
    model: "payment",
    data: payload,
  });

  return mapPaymentRecord(asDbPayment(created));
};

const handleSubscriptionChargeSuccess: TypedWebhookHandler<
  "charge.success"
> = async ({ ctx, event, pluginContext }) => {
  const adapter = ctx.context.adapter;
  const data = event.data;
  const metadata = parseChargeSuccessMetadata(data);
  const customerCode = data.customer.customer_code;
  const userId = await resolveUserId(adapter, metadata, customerCode);

  if (!userId) {
    ctx.context.logger.warn(
      `Subscription charge.success for reference ${data.reference}: no userId resolved`
    );
    return;
  }

  if (typeof data.plan !== "object" || data.plan === null) {
    return;
  }

  const subscriptionCode = data.subscription_code;

  if (!subscriptionCode) {
    ctx.context.logger.warn(
      `Subscription charge.success for reference ${data.reference}: missing subscription_code`
    );
    return;
  }

  const paystackSubscription = await fetchPaystackSubscription(
    pluginContext,
    subscriptionCode
  );

  const subscription = await upsertSubscription({
    adapter,
    userId,
    referenceId: getReferenceIdFromMetadata(metadata, userId),
    paystackSubscription,
    statusOverride: "active",
  });

  const supersedeSubscriptionCode =
    subscriptionMetadata.get(metadata).supersedeSubscriptionCode;

  if (
    supersedeSubscriptionCode &&
    supersedeSubscriptionCode !== subscriptionCode
  ) {
    try {
      const oldRecord = await findExistingSubscription(
        adapter,
        supersedeSubscriptionCode
      );

      if (
        oldRecord &&
        oldRecord.userId === userId &&
        oldRecord.status !== "cancelled" &&
        oldRecord.emailToken
      ) {
        await pluginContext.options.paystackClient.subscriptions.disable({
          code: oldRecord.subscriptionCode,
          token: oldRecord.emailToken,
        });
      }
    } catch {
      // Swallow disable failures so the new subscription is not rolled back.
    }
  }

  if (
    pluginContext.options.subscription?.enabled &&
    pluginContext.options.subscription.onSubscriptionComplete
  ) {
    await pluginContext.options.subscription.onSubscriptionComplete({
      event,
      subscription,
      paystackSubscription,
    });
  }
};

const handleOneTimeChargeSuccess: TypedWebhookHandler<
  "charge.success"
> = async ({ ctx, event, pluginContext }) => {
  const adapter = ctx.context.adapter;
  const data = event.data;
  const metadata = parseChargeSuccessMetadata(data);
  const customerCode = data.customer.customer_code;
  const userId = await resolveUserId(adapter, metadata, customerCode);
  const { referenceId } = checkoutMetadata.get(metadata);

  if (!userId) {
    ctx.context.logger.warn(
      `One-time charge.success for reference ${data.reference}: no userId resolved (guest checkout)`
    );
  }

  let payment: PaystackPaymentRecord | undefined;

  if (!pluginContext.options.disablePaymentPersistence) {
    const existing = await findPaymentByReference(adapter, data.reference);

    if (existing?.status === "successful") {
      ctx.context.logger.warn(
        `Duplicate successful payment for reference ${data.reference}; skipping onCheckoutComplete`
      );
      return;
    }

    try {
      payment = await upsertPayment({
        adapter,
        data,
        metadata,
        referenceId,
        userId: userId ?? undefined,
      });
    } catch (error) {
      ctx.context.logger.error(
        `Failed to persist payment for reference ${data.reference}`,
        error
      );
      throw error;
    }
  }

  const onCheckoutComplete = pluginContext.options.checkout?.onCheckoutComplete;

  if (!onCheckoutComplete) {
    if (!pluginContext.options.disablePaymentPersistence) {
      ctx.context.logger.warn(
        `One-time charge.success for reference ${data.reference}: payment persisted but checkout.onCheckoutComplete is not configured`
      );
    }
    return;
  }

  const checkoutContext: CheckoutCompleteContext = {
    event,
    reference: data.reference,
    amount: data.amount,
    currency: data.currency,
    channel: data.channel,
    paidAt: data.paid_at,
    customer: data.customer,
    userId: userId ?? undefined,
    referenceId,
    metadata,
    payment,
  };

  await onCheckoutComplete(checkoutContext);
};

const handleChargeSuccessWebhook: TypedWebhookHandler<"charge.success"> = (
  handlerCtx
) => {
  if (isSubscriptionChargeSuccess(handlerCtx.event.data)) {
    return handleSubscriptionChargeSuccess(handlerCtx);
  }

  return handleOneTimeChargeSuccess(handlerCtx);
};

const handleSubscriptionCreateWebhook: TypedWebhookHandler<
  "subscription.create"
> = async ({ ctx, event, pluginContext }) => {
  const adapter = ctx.context.adapter;
  const data = event.data;
  const subscriptionCode = data.subscription_code;

  if (!subscriptionCode) {
    return;
  }

  const paystackSubscription = await fetchPaystackSubscription(
    pluginContext,
    subscriptionCode
  );
  const metadata = parseCustomerMetadataFromCustomer(data.customer);
  const userId = await resolveUserId(
    adapter,
    metadata,
    resolveCustomer(paystackSubscription.customer)?.customer_code
  );

  if (!userId) {
    return;
  }

  const subscription = await upsertSubscription({
    adapter,
    userId,
    referenceId: getReferenceIdFromMetadata(metadata, userId),
    paystackSubscription,
    statusOverride: mapWebhookEventToStatus(event.event) ?? "active",
  });

  if (
    pluginContext.options.subscription?.enabled &&
    pluginContext.options.subscription.onSubscriptionCreated
  ) {
    await pluginContext.options.subscription.onSubscriptionCreated({
      event,
      subscription,
      paystackSubscription,
    });
  }
};

const handleSubscriptionDisableWebhook: TypedWebhookHandler<
  "subscription.disable"
> = async ({ ctx, event, pluginContext }) => {
  const adapter = ctx.context.adapter;
  const subscriptionCode = event.data.subscription_code;

  if (!subscriptionCode) {
    return;
  }

  const existing = await findExistingSubscription(adapter, subscriptionCode);

  if (!existing) {
    return;
  }

  const paystackSubscription = await fetchPaystackSubscription(
    pluginContext,
    subscriptionCode
  );

  const subscription = await upsertSubscription({
    adapter,
    userId: existing.userId,
    referenceId: existing.referenceId,
    paystackSubscription,
    statusOverride: "cancelled",
    cancelAtPeriodEnd: false,
  });

  if (
    pluginContext.options.subscription?.enabled &&
    pluginContext.options.subscription.onSubscriptionCancel
  ) {
    await pluginContext.options.subscription.onSubscriptionCancel({
      event,
      subscription,
      paystackSubscription,
      cancellationDetails: {
        cancelAtPeriodEnd: false,
      },
    });
  }
};

const handleSubscriptionNotRenewWebhook: TypedWebhookHandler<
  "subscription.not_renew"
> = async ({ ctx, event, pluginContext }) => {
  const adapter = ctx.context.adapter;
  const subscriptionCode = event.data.subscription_code;

  if (!subscriptionCode) {
    return;
  }

  const existing = await findExistingSubscription(adapter, subscriptionCode);

  if (!existing) {
    return;
  }

  const paystackSubscription = await fetchPaystackSubscription(
    pluginContext,
    subscriptionCode
  );

  const subscription = await upsertSubscription({
    adapter,
    userId: existing.userId,
    referenceId: existing.referenceId,
    paystackSubscription,
    statusOverride: "active",
    cancelAtPeriodEnd: true,
  });

  if (
    pluginContext.options.subscription?.enabled &&
    pluginContext.options.subscription.onSubscriptionUpdate
  ) {
    await pluginContext.options.subscription.onSubscriptionUpdate({
      event,
      subscription,
      paystackSubscription,
    });
  }
};

const handleInvoiceWebhook = async (
  handlerCtx: WebhookHandlerContext & {
    event: Extract<
      PaystackWebhookEvent,
      {
        event: "invoice.create" | "invoice.payment_failed" | "invoice.update";
      }
    >;
  }
): Promise<void> => {
  const { event, ctx, pluginContext } = handlerCtx;
  const adapter = ctx.context.adapter;
  const data: InvoiceData = event.data;
  const subscriptionCode = data.subscription.subscription_code;

  if (!subscriptionCode) {
    return;
  }

  const existing = await findExistingSubscription(adapter, subscriptionCode);

  if (!existing) {
    return;
  }

  const paystackSubscription = await fetchPaystackSubscription(
    pluginContext,
    subscriptionCode
  );

  const statusOverride =
    event.event === "invoice.payment_failed"
      ? "past_due"
      : mapPaystackSubscriptionStatus(paystackSubscription.status);

  const subscription = await upsertSubscription({
    adapter,
    userId: existing.userId,
    referenceId: existing.referenceId,
    paystackSubscription,
    statusOverride,
  });

  if (
    pluginContext.options.subscription?.enabled &&
    pluginContext.options.subscription.onSubscriptionUpdate
  ) {
    await pluginContext.options.subscription.onSubscriptionUpdate({
      event,
      subscription,
      paystackSubscription,
    });
  }
};

export const handlePaystackWebhookEvent = async (options: {
  ctx: GenericEndpointContext;
  event: PaystackWebhookEvent;
  pluginContext: PluginContext;
  planRegistry?: PlanRegistry | undefined;
}): Promise<void> => {
  const { ctx, event, pluginContext, planRegistry } = options;

  if (pluginContext.options.onEvent) {
    await pluginContext.options.onEvent(event);
  }

  const handlerCtx: WebhookHandlerContext = {
    ctx,
    pluginContext,
    planRegistry,
  };

  switch (event.event) {
    case "charge.success":
      return handleChargeSuccessWebhook({ ...handlerCtx, event });
    case "subscription.create":
      return handleSubscriptionCreateWebhook({ ...handlerCtx, event });
    case "subscription.disable":
      return handleSubscriptionDisableWebhook({ ...handlerCtx, event });
    case "subscription.not_renew":
      return handleSubscriptionNotRenewWebhook({ ...handlerCtx, event });
    case "invoice.create":
    case "invoice.update":
    case "invoice.payment_failed":
      return handleInvoiceWebhook({ ...handlerCtx, event });
    case "subscription.expiring_cards":
    case "charge.dispute.create":
    case "charge.dispute.remind":
    case "charge.dispute.resolve":
    case "customeridentification.failed":
    case "customeridentification.success":
    case "dedicatedaccount.assign.failed":
    case "dedicatedaccount.assign.success":
    case "paymentrequest.pending":
    case "paymentrequest.success":
    case "refund.failed":
    case "refund.pending":
    case "refund.processed":
    case "refund.processing":
    case "transfer.failed":
    case "transfer.success":
    case "transfer.reversed":
    case "bank.transfer.rejected":
      return;
    default:
      return assertNever(event);
  }
};

export const createAdapterWebhookStore = (
  adapter: GenericEndpointContext["context"]["adapter"]
): WebhookDeliveryStore => ({
  claim: async (input) => {
    const existing = await findWebhookEvent(adapter, input.eventId);

    if (existing) {
      const record = asDbWebhookEvent(existing);

      if (record.status === "processed") {
        return "duplicate";
      }

      if (record.status === "failed") {
        await reprocessWebhookEvent(adapter, input.eventId);
        return "claimed";
      }

      return "duplicate";
    }

    try {
      await persistWebhookEvent(adapter, input);
      return "claimed";
    } catch {
      const raced = await findWebhookEvent(adapter, input.eventId);

      if (!raced) {
        throw new Error(
          `Failed to claim webhook event ${input.eventId} after duplicate insert race`
        );
      }

      const record = asDbWebhookEvent(raced);

      if (record.status === "failed") {
        await reprocessWebhookEvent(adapter, input.eventId);
        return "claimed";
      }

      return "duplicate";
    }
  },
  markProcessed: async (eventId) => {
    await markWebhookProcessed(adapter, eventId);
  },
  markFailed: async (eventId, errorMessage) => {
    await markWebhookFailed(adapter, eventId, errorMessage);
  },
});

export const findWebhookEvent = async (
  adapter: GenericEndpointContext["context"]["adapter"],
  eventId: string
): Promise<unknown | null> =>
  await adapter.findOne({
    model: "webhookEvent",
    where: [{ field: "eventId", value: eventId }],
  });

export const persistWebhookEvent = async (
  adapter: GenericEndpointContext["context"]["adapter"],
  input: {
    eventId: string;
    type: string;
    payload: string;
  }
): Promise<unknown> =>
  await adapter.create({
    model: "webhookEvent",
    data: toDbWebhookEvent({
      eventId: input.eventId,
      type: input.type,
      payload: input.payload,
      status: "pending",
    }),
  });

export const markWebhookProcessed = async (
  adapter: GenericEndpointContext["context"]["adapter"],
  eventId: string
): Promise<unknown | null> => {
  const existing = await findWebhookEvent(adapter, eventId);

  if (!existing) {
    return null;
  }

  return adapter.update({
    model: "webhookEvent",
    where: [{ field: "eventId", value: eventId }],
    update: {
      status: "processed",
      processedAt: new Date(),
      errorMessage: null,
    },
  });
};

export const markWebhookFailed = async (
  adapter: GenericEndpointContext["context"]["adapter"],
  eventId: string,
  errorMessage: string
): Promise<unknown | null> => {
  const existing = await findWebhookEvent(adapter, eventId);

  if (!existing) {
    return null;
  }

  return adapter.update({
    model: "webhookEvent",
    where: [{ field: "eventId", value: eventId }],
    update: {
      status: "failed",
      processedAt: new Date(),
      errorMessage,
    },
  });
};

export const reprocessWebhookEvent = async (
  adapter: GenericEndpointContext["context"]["adapter"],
  eventId: string
): Promise<unknown | null> => {
  const existing = await findWebhookEvent(adapter, eventId);

  if (!existing) {
    return null;
  }

  return adapter.update({
    model: "webhookEvent",
    where: [{ field: "eventId", value: eventId }],
    update: {
      status: "pending",
      processedAt: null,
      errorMessage: null,
    },
  });
};
