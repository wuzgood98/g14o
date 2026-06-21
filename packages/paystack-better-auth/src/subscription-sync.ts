import { PaystackError, type PaystackSubscription } from "@g14o/paystack";
import type { GenericEndpointContext } from "better-auth";
import { resolvePaystackCustomerId } from "./customer";
import { upsertSubscription } from "./hooks";
import type {
  DbPaystackSubscription,
  PaystackSubscriptionRecord,
  PluginContext,
} from "./types";
import { asDbSubscription } from "./utils";

const SUBSCRIPTION_LIST_PAGE_SIZE = 100;

/**
 * Gets a subscription record from the database.
 * @internal
 */
export async function getSubscriptionRecord(
  ctx: GenericEndpointContext,
  options: {
    userId: string;
    reference?: string | undefined;
    subscriptionCode?: string | undefined;
  }
): Promise<DbPaystackSubscription | null> {
  if (options.subscriptionCode) {
    const record = await ctx.context.adapter.findOne({
      model: "subscription",
      where: [
        { field: "subscriptionCode", value: options.subscriptionCode },
        { field: "userId", value: options.userId },
      ],
    });

    return record ? asDbSubscription(record) : null;
  }

  const referenceId = options.reference ?? options.userId;

  const record = await ctx.context.adapter.findOne({
    model: "subscription",
    where: [
      { field: "userId", value: options.userId },
      { field: "referenceId", value: referenceId },
    ],
  });

  return record ? asDbSubscription(record) : null;
}

/**
 * Lists all subscriptions for a customer.
 * @internal
 */
async function listAllSubscriptionsForCustomer(
  pluginContext: PluginContext,
  options: {
    customer: number;
    page?: number | undefined | null;
    perPage?: number | undefined | null;
    plan?: number | null | undefined;
  }
): Promise<PaystackSubscription[]> {
  const paystackClient = pluginContext.options.paystackClient;
  const subscriptions: PaystackSubscription[] = [];
  let page = options.page ?? 1;
  const pageSize =
    options.perPage && options.perPage > 0
      ? options.perPage
      : SUBSCRIPTION_LIST_PAGE_SIZE;

  while (true) {
    const batch = await paystackClient.subscriptions.list({
      customer: options.customer,
      perPage: pageSize,
      page,
      plan: options.plan,
    });

    subscriptions.push(...batch);

    if (batch.length < pageSize) {
      break;
    }

    page += 1;
  }

  return subscriptions;
}

/**
 * Resolves a paystack subscription for upsert.
 * @internal
 */
async function resolveSubscriptionForUpsert(
  pluginContext: PluginContext,
  paystackSubscription: PaystackSubscription
): Promise<PaystackSubscription> {
  if (paystackSubscription.email_token) {
    return Promise.resolve(paystackSubscription);
  }

  return await pluginContext.options.paystackClient.subscriptions.fetch(
    paystackSubscription.subscription_code
  );
}

/**
 * Reconciles the subscriptions for a user by listing all subscriptions for the customer from
 * paystack if no subscriptions are found in the database.
 * @internal
 */
export async function reconcileSubscriptionsForUser(options: {
  ctx: GenericEndpointContext;
  pluginContext: PluginContext;
  userId: string;
  query?:
    | {
        customer?: number | null | undefined;
        page?: number | undefined;
        perPage?: number | undefined;
        plan?: number | null | undefined;
      }
    | undefined;
}): Promise<PaystackSubscriptionRecord[]> {
  try {
    const resolvedCustomer = await resolvePaystackCustomerId({
      ctx: options.ctx,
      paystackClient: options.pluginContext.options.paystackClient,
      userId: options.userId,
    });

    const requestedCustomer = options.query?.customer;
    if (requestedCustomer != null && requestedCustomer !== resolvedCustomer) {
      throw new PaystackError("Customer ID does not match authenticated user", {
        code: "PAYSTACK_VALIDATION_ERROR",
      });
    }

    const customer = resolvedCustomer;

    const subscriptions = await listAllSubscriptionsForCustomer(
      options.pluginContext,
      {
        customer,
        page: options.query?.page,
        perPage: options.query?.perPage,
        plan: options.query?.plan,
      }
    );

    const results: PaystackSubscriptionRecord[] = [];

    for (const listedSubscription of subscriptions) {
      const paystackSubscription = await resolveSubscriptionForUpsert(
        options.pluginContext,
        listedSubscription
      );

      const record = await upsertSubscription({
        adapter: options.ctx.context.adapter,
        userId: options.userId,
        referenceId: options.userId,
        paystackSubscription,
      });

      results.push(record);
    }

    return results;
  } catch (error) {
    if (
      error instanceof PaystackError &&
      error.code === "PAYSTACK_VALIDATION_ERROR"
    ) {
      throw error;
    }

    return [];
  }
}

/**
 * Gets a subscription record from the database and reconciles it if it is not found.
 * @internal
 */
export async function getSubscriptionRecordWithReconcile(options: {
  ctx: GenericEndpointContext;
  pluginContext: PluginContext;
  userId: string;
  reference?: string | undefined;
  subscriptionCode?: string | undefined;
  query?:
    | {
        customer?: number | undefined;
        page?: number | undefined;
        perPage?: number | undefined;
        plan?: number | undefined;
      }
    | undefined;
}): Promise<DbPaystackSubscription | null> {
  let record = await getSubscriptionRecord(options.ctx, {
    userId: options.userId,
    reference: options.reference,
    subscriptionCode: options.subscriptionCode,
  });

  if (!record) {
    await reconcileSubscriptionsForUser({
      ctx: options.ctx,
      pluginContext: options.pluginContext,
      userId: options.userId,
      query: options.query,
    });

    record = await getSubscriptionRecord(options.ctx, {
      userId: options.userId,
      reference: options.reference,
      subscriptionCode: options.subscriptionCode,
    });
  }

  return record;
}
