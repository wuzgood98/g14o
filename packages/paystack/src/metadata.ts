const UNSAFE_METADATA_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Merge metadata objects, giving `internalFields` final priority.
 * Drops reserved keys that could mutate the target's prototype chain.
 */
function mergeMetadata<Internal extends Record<string, unknown>>(
  internalFields: Internal,
  userMetadata: (Record<string, unknown> | undefined)[]
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};

  for (const source of userMetadata) {
    if (!source) {
      continue;
    }

    for (const [key, value] of Object.entries(source)) {
      if (UNSAFE_METADATA_KEYS.has(key)) {
        continue;
      }
      merged[key] = value;
    }
  }

  for (const [key, value] of Object.entries(internalFields)) {
    merged[key] = value;
  }

  return merged;
}

export const customerMetadata = {
  keys: {
    userId: "userId",
  } as const,

  set(
    internalFields: { userId: string },
    ...userMetadata: (Record<string, unknown> | undefined)[]
  ): Record<string, unknown> {
    return mergeMetadata(internalFields, userMetadata);
  },

  get(metadata: Record<string, unknown> | null | undefined): {
    userId: string | undefined;
  } {
    return {
      userId:
        typeof metadata?.userId === "string" ? metadata.userId : undefined,
    };
  },
};

export const subscriptionMetadata = {
  keys: {
    userId: "userId",
    referenceId: "referenceId",
    planName: "planName",
    callbackUrl: "callbackUrl",
    cancel_action: "cancel_action",
    supersedeSubscriptionCode: "supersedeSubscriptionCode",
  } as const,

  set(
    internalFields: {
      userId: string;
      referenceId: string;
      planName?: string | undefined;
      supersedeSubscriptionCode?: string | undefined;
      cancel_Action?: string | undefined;
    },
    ...userMetadata: (Record<string, unknown> | undefined)[]
  ): Record<string, unknown> {
    return mergeMetadata(internalFields, userMetadata);
  },

  get(metadata: Record<string, unknown> | null | undefined): {
    userId: string | undefined;
    referenceId: string | undefined;
    planName: string | undefined;
    supersedeSubscriptionCode: string | undefined;
  } {
    return {
      userId:
        typeof metadata?.userId === "string" ? metadata.userId : undefined,
      referenceId:
        typeof metadata?.referenceId === "string"
          ? metadata.referenceId
          : undefined,
      planName:
        typeof metadata?.planName === "string" ? metadata.planName : undefined,
      supersedeSubscriptionCode:
        typeof metadata?.supersedeSubscriptionCode === "string"
          ? metadata.supersedeSubscriptionCode
          : undefined,
    };
  },
};

export const checkoutMetadata = {
  set(
    internalFields: {
      userId?: string | undefined;
      referenceId?: string;
      cancel_action?: string | undefined;
    },
    ...userMetadata: (Record<string, unknown> | undefined)[]
  ): Record<string, unknown> {
    return mergeMetadata(
      internalFields as Record<string, unknown>,
      userMetadata
    );
  },
};

/**
 * Safely parse JSON metadata stored in the database or received from webhooks.
 */
export const parseSafeMetadata = (
  metadata: string | Record<string, unknown> | null | undefined
): Record<string, unknown> | undefined => {
  if (!metadata) {
    return;
  }

  let parsed: Record<string, unknown>;

  if (typeof metadata === "string") {
    try {
      const value = JSON.parse(metadata) as unknown;
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return;
      }
      parsed = value as Record<string, unknown>;
    } catch {
      return;
    }
  } else {
    parsed = metadata;
  }

  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (UNSAFE_METADATA_KEYS.has(key)) {
      continue;
    }
    safe[key] = value;
  }

  return safe;
};
