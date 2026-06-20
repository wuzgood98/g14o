import {
  type ChargeSuccessData,
  type InvoiceData,
  type PaystackEventName,
  type PaystackSubscription,
  type PaystackWebhookEvent,
  parseSafeMetadata,
  type SubscriptionCreateData,
  type WebhookDeliveryStore,
} from "@g14o/paystack";
import type { GenericEndpointContext } from "better-auth";
import { subscriptionMetadata } from "./metadata";
import type { PlanRegistry } from "./plans";
import type {
  PaystackSubscriptionRecord,
  PluginContext,
  ResolvedPlan,
} from "./types";
import {
  asDbSubscription,
  asDbWebhookEvent,
  mapPaystackSubscriptionStatus,
  mapWebhookEventToStatus,
  parseMetadata,
  parseSubscriptionPeriod,
  shouldCancelAtPeriodEnd,
  toDbSubscription,
  toDbWebhookEvent,
} from "./utils";

type Adapter = GenericEndpointContext["context"]["adapter"];

interface WebhookHandlerContext {
  adapter: Adapter;
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
      options.paystackSubscription.customer?.customer_code ??
      existingRecord?.customerCode ??
      "",
    customerId:
      options.paystackSubscription.customer?.id ??
      existingRecord?.customerId ??
      0,
    planCode:
      options.paystackSubscription.plan?.plan_code ??
      existingRecord?.planCode ??
      "",
    planName:
      options.plan?.normalizedName ??
      options.paystackSubscription.plan?.name?.toLowerCase() ??
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

const resolveUserId = (
  adapter: Adapter,
  metadata: Record<string, unknown> | undefined,
  customerCode?: string | undefined
): Promise<string | null> => {
  if (typeof metadata?.userId === "string" && metadata.userId) {
    return Promise.resolve(metadata.userId);
  }

  return findUserIdByCustomerCode(adapter, customerCode);
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

const handleChargeSuccessWebhook: TypedWebhookHandler<
  "charge.success"
> = async ({ event, adapter, pluginContext }) => {
  const data = event.data;
  const metadata = parseChargeSuccessMetadata(data);
  const customerCode = data.customer.customer_code;
  const userId = await resolveUserId(adapter, metadata, customerCode);

  if (!userId) {
    return;
  }

  if (typeof data.plan !== "object" || data.plan === null) {
    return;
  }

  const subscriptionCode = data.subscription_code;

  if (!subscriptionCode) {
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

const handleSubscriptionCreateWebhook: TypedWebhookHandler<
  "subscription.create"
> = async ({ event, adapter, pluginContext }) => {
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
    paystackSubscription.customer?.customer_code
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
> = async ({ event, adapter, pluginContext }) => {
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
> = async ({ event, adapter, pluginContext }) => {
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
  ctx: WebhookHandlerContext & {
    event: Extract<
      PaystackWebhookEvent,
      {
        event: "invoice.create" | "invoice.payment_failed" | "invoice.update";
      }
    >;
  }
): Promise<void> => {
  const { event, adapter, pluginContext } = ctx;
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
  event: PaystackWebhookEvent;
  adapter: Adapter;
  pluginContext: PluginContext;
  planRegistry?: PlanRegistry | undefined;
}): Promise<void> => {
  const { event, adapter, pluginContext, planRegistry } = options;

  if (pluginContext.options.onEvent) {
    await pluginContext.options.onEvent(event);
  }

  const ctx: WebhookHandlerContext = {
    adapter,
    pluginContext,
    planRegistry,
  };

  switch (event.event) {
    case "charge.success":
      return handleChargeSuccessWebhook({ ...ctx, event });
    case "subscription.create":
      return handleSubscriptionCreateWebhook({ ...ctx, event });
    case "subscription.disable":
      return handleSubscriptionDisableWebhook({ ...ctx, event });
    case "subscription.not_renew":
      return handleSubscriptionNotRenewWebhook({ ...ctx, event });
    case "invoice.create":
    case "invoice.update":
    case "invoice.payment_failed":
      return handleInvoiceWebhook({ ...ctx, event });
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
      return;
    default:
      return assertNever(event);
  }
};

export const createAdapterWebhookStore = (
  adapter: GenericEndpointContext["context"]["adapter"]
): WebhookDeliveryStore => ({
  shouldProcess: (eventId) => shouldProcessWebhook(adapter, eventId),
  persist: async (input) => {
    await persistWebhookEvent(adapter, input);
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

export const shouldProcessWebhook = async (
  adapter: GenericEndpointContext["context"]["adapter"],
  eventId: string
): Promise<boolean> => {
  const existing = await findWebhookEvent(adapter, eventId);

  if (!existing) {
    return true;
  }

  return asDbWebhookEvent(existing).status !== "processed";
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
