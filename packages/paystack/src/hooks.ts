import type { GenericEndpointContext } from "better-auth";
import type { PaystackSubscription } from "./client/responses";
import { parseSafeMetadata, subscriptionMetadata } from "./metadata";
import type { PlanRegistry } from "./plans";
import type {
  PaystackSubscriptionRecord,
  PaystackWebhookEvent,
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
  data: Record<string, unknown>;
  event: PaystackWebhookEvent;
  planRegistry?: PlanRegistry | undefined;
  pluginContext: PluginContext;
}

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

const parseWebhookMetadata = (
  data: Record<string, unknown>
): Record<string, unknown> | undefined => {
  if (typeof data.metadata === "object" && data.metadata !== null) {
    return parseSafeMetadata(data.metadata as Record<string, unknown>);
  }

  return;
};

const parseCustomerCode = (
  data: Record<string, unknown>
): string | undefined => {
  if (
    typeof data.customer === "object" &&
    data.customer !== null &&
    "customer_code" in data.customer
  ) {
    return String((data.customer as { customer_code: string }).customer_code);
  }

  return;
};

const parseCustomerMetadata = (
  data: Record<string, unknown>
): Record<string, unknown> | undefined => {
  if (typeof data.customer === "object" && data.customer !== null) {
    return parseSafeMetadata(
      (data.customer as { metadata?: Record<string, unknown> }).metadata
    );
  }

  return;
};

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

const getSubscriptionCodeFromData = (data: Record<string, unknown>): string =>
  String(data.subscription_code ?? "");

const getInvoiceSubscriptionCode = (data: Record<string, unknown>): string => {
  const subscriptionData = data.subscription as
    | { subscription_code?: string }
    | undefined;

  return String(
    subscriptionData?.subscription_code ?? data.subscription_code ?? ""
  );
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

const handleChargeSuccessWebhook = async (
  ctx: WebhookHandlerContext
): Promise<void> => {
  const { event, data, adapter, pluginContext } = ctx;
  const metadata = parseWebhookMetadata(data);
  const customerCode = parseCustomerCode(data);
  const userId = await resolveUserId(adapter, metadata, customerCode);

  if (!userId) {
    return;
  }

  if (typeof data.plan !== "object" || data.plan === null) {
    return;
  }

  const subscriptionCode =
    typeof data.subscription_code === "string"
      ? data.subscription_code
      : undefined;

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

const handleSubscriptionCreateWebhook = async (
  ctx: WebhookHandlerContext
): Promise<void> => {
  const { event, data, adapter, pluginContext } = ctx;
  const subscriptionCode = getSubscriptionCodeFromData(data);

  if (!subscriptionCode) {
    return;
  }

  const paystackSubscription = await fetchPaystackSubscription(
    pluginContext,
    subscriptionCode
  );
  const metadata = parseCustomerMetadata(data);
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

const handleSubscriptionDisableWebhook = async (
  ctx: WebhookHandlerContext
): Promise<void> => {
  const { event, data, adapter, pluginContext } = ctx;
  const subscriptionCode = getSubscriptionCodeFromData(data);

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

const handleSubscriptionNotRenewWebhook = async (
  ctx: WebhookHandlerContext
): Promise<void> => {
  const { event, data, adapter, pluginContext } = ctx;
  const subscriptionCode = getSubscriptionCodeFromData(data);

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
  ctx: WebhookHandlerContext
): Promise<void> => {
  const { event, data, adapter, pluginContext } = ctx;
  const subscriptionCode = getInvoiceSubscriptionCode(data);

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
    event,
    data: event.data,
    adapter,
    pluginContext,
    planRegistry,
  };

  switch (event.event) {
    case "charge.success":
      return handleChargeSuccessWebhook(ctx);
    case "subscription.create":
      return handleSubscriptionCreateWebhook(ctx);
    case "subscription.disable":
      return handleSubscriptionDisableWebhook(ctx);
    case "subscription.not_renew":
      return handleSubscriptionNotRenewWebhook(ctx);
    case "invoice.create":
    case "invoice.update":
    case "invoice.payment_failed":
    case "subscription.expiring_cards":
      return handleInvoiceWebhook(ctx);
    default:
      return;
  }
};

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
