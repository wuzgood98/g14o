import {
  CustomerSyncError,
  type Paystack,
  type PaystackCustomer,
  PaystackError,
} from "@g14o/paystack";
import type { GenericEndpointContext } from "better-auth";
import { customerMetadata } from "./metadata";
import type { PaystackCustomerRecord } from "./types";
import { splitUserName } from "./utils";

type Adapter = GenericEndpointContext["context"]["adapter"];

interface PaystackUser {
  email: string;
  id: string;
  name?: string | null;
  paystackCustomerCode?: string | null;
  paystackCustomerId?: number | null;
  [key: string]: unknown;
}

const formatCustomerSyncErrorMessage = (
  baseMessage: string,
  error: unknown
): string => {
  if (error instanceof PaystackError && error.paystackMessage) {
    return `${baseMessage}: ${error.paystackMessage}`;
  }

  return baseMessage;
};

const mapCustomerFromUser = (user: {
  id: string;
  email: string;
  paystackCustomerCode: string;
  paystackCustomerId?: number;
}): PaystackCustomerRecord => ({
  userId: user.id,
  provider: "paystack",
  customerCode: user.paystackCustomerCode,
  ...(typeof user.paystackCustomerId === "number"
    ? { customerId: user.paystackCustomerId }
    : {}),
  email: user.email,
});

export const getCustomerByUserId = async (
  adapter: Adapter,
  userId: string
): Promise<PaystackCustomerRecord | null> => {
  const user = await getUserById(adapter, userId);

  if (!user?.email || typeof user.paystackCustomerCode !== "string") {
    return null;
  }

  return mapCustomerFromUser({
    id: user.id,
    email: user.email,
    paystackCustomerCode: user.paystackCustomerCode,
    ...(typeof user.paystackCustomerId === "number"
      ? { paystackCustomerId: user.paystackCustomerId }
      : {}),
  });
};

export const getUserById = async (
  adapter: Adapter,
  userId: string
): Promise<PaystackUser | null> => {
  const user = await adapter.findOne({
    model: "user",
    where: [{ field: "id", value: userId }],
  });

  return user as PaystackUser | null;
};

export const resolvePaystackCustomerId = async (options: {
  adapter: Adapter;
  paystackClient: Paystack;
  userId: string;
}): Promise<number> => {
  const user = await getUserById(options.adapter, options.userId);

  if (!user?.email || typeof user.paystackCustomerCode !== "string") {
    throw new CustomerSyncError(
      "Customer record not found",
      "CUSTOMER_NOT_FOUND"
    );
  }

  if (typeof user.paystackCustomerId === "number") {
    return user.paystackCustomerId;
  }

  try {
    const remote = await options.paystackClient.customers.fetch(
      user.paystackCustomerCode
    );

    await options.adapter.update({
      model: "user",
      where: [{ field: "id", value: user.id }],
      update: {
        paystackCustomerId: remote.id,
        ...(remote.customer_code === user.paystackCustomerCode
          ? {}
          : { paystackCustomerCode: remote.customer_code }),
      },
    });

    return remote.id;
  } catch (error) {
    throw new CustomerSyncError(
      formatCustomerSyncErrorMessage(
        "Failed to resolve Paystack customer ID",
        error
      ),
      "CUSTOMER_SYNC_FAILED",
      error
    );
  }
};

export interface CreateCustomerOptions {
  adapter: Adapter;
  authCtx?: GenericEndpointContext;
  getCustomerCreateParams?: (
    user: {
      id: string;
      email: string;
      name?: string | null;
      [key: string]: unknown;
    },
    authCtx: GenericEndpointContext
  ) =>
    | Promise<
        Partial<{
          first_name: string;
          last_name: string;
          phone: string;
          metadata: Record<string, unknown>;
        }>
      >
    | Partial<{
        first_name: string;
        last_name: string;
        phone: string;
        metadata: Record<string, unknown>;
      }>;
  onCustomerCreate?: (
    ctx: {
      customer: PaystackCustomer;
      user: {
        id: string;
        email: string;
        name?: string | null;
        [key: string]: unknown;
      };
    },
    authCtx: GenericEndpointContext
  ) => Promise<void> | void;
  paystackClient: Paystack;
  userId: string;
}

export const createCustomerForUser = async (
  options: CreateCustomerOptions
): Promise<PaystackCustomerRecord> => {
  const existing = await getCustomerByUserId(options.adapter, options.userId);

  if (existing) {
    return existing;
  }

  const user = await getUserById(options.adapter, options.userId);

  if (!user?.email) {
    throw new CustomerSyncError(
      "User not found or missing email",
      "CUSTOMER_NOT_FOUND"
    );
  }

  const nameParts = splitUserName(user.name);
  const customParams =
    options.getCustomerCreateParams && options.authCtx
      ? await options.getCustomerCreateParams(user, options.authCtx)
      : {};

  const metadata = customerMetadata.set(
    { userId: user.id },
    customParams.metadata
  );

  try {
    const customer = await options.paystackClient.customers.create({
      email: user.email,
      first_name: customParams.first_name ?? nameParts.first_name,
      last_name: customParams.last_name ?? nameParts.last_name,
      phone: customParams.phone,
      metadata,
    });

    await options.adapter.update({
      model: "user",
      where: [{ field: "id", value: user.id }],
      update: {
        paystackCustomerCode: customer.customer_code,
        paystackCustomerId: customer.id,
      },
    });

    if (options.onCustomerCreate && options.authCtx) {
      await options.onCustomerCreate({ customer, user }, options.authCtx);
    }

    return mapCustomerFromUser({
      id: user.id,
      email: customer.email ?? user.email,
      paystackCustomerCode: customer.customer_code,
      paystackCustomerId: customer.id,
    });
  } catch (error) {
    throw new CustomerSyncError(
      formatCustomerSyncErrorMessage(
        "Failed to create Paystack customer",
        error
      ),
      "CUSTOMER_CREATE_FAILED",
      error
    );
  }
};

export const syncCustomerForUser = async (options: {
  paystackClient: Paystack;
  adapter: Adapter;
  userId: string;
}): Promise<PaystackCustomerRecord> => {
  const user = await getUserById(options.adapter, options.userId);

  if (!user?.email || typeof user.paystackCustomerCode !== "string") {
    throw new CustomerSyncError(
      "Customer record not found",
      "CUSTOMER_NOT_FOUND"
    );
  }

  try {
    const remote = await options.paystackClient.customers.fetch(
      user.paystackCustomerCode
    );

    const customerCode = remote.customer_code;
    const customerId = remote.id;
    const shouldUpdateCode = customerCode !== user.paystackCustomerCode;
    const shouldUpdateId = user.paystackCustomerId !== customerId;

    if (shouldUpdateCode || shouldUpdateId) {
      await options.adapter.update({
        model: "user",
        where: [{ field: "id", value: user.id }],
        update: {
          ...(shouldUpdateCode ? { paystackCustomerCode: customerCode } : {}),
          ...(shouldUpdateId ? { paystackCustomerId: customerId } : {}),
        },
      });
    }

    return mapCustomerFromUser({
      id: user.id,
      email: remote.email ?? user.email,
      paystackCustomerCode: customerCode,
      paystackCustomerId: customerId,
    });
  } catch (error) {
    throw new CustomerSyncError(
      formatCustomerSyncErrorMessage("Failed to sync Paystack customer", error),
      "CUSTOMER_SYNC_FAILED",
      error
    );
  }
};
