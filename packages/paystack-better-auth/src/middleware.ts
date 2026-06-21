import { createAuthMiddleware } from "@better-auth/core/api";
import { APIError } from "@better-auth/core/error";
import { sessionMiddleware } from "better-auth/api";
import { PAYSTACK_ERROR_CODES } from "./error-codes";

export const paystackSessionMiddleware = createAuthMiddleware(
  {
    use: [sessionMiddleware],
  },
  // biome-ignore lint/suspicious/useAwait: it's ok to use await in a middleware
  async (ctx) => {
    const session = ctx.context.session;
    if (!session) {
      throw APIError.from("UNAUTHORIZED", PAYSTACK_ERROR_CODES.UNAUTHORIZED);
    }

    return { session };
  }
);

export const getReferenceId = (
  sessionUserId: string | undefined,
  explicitReference: string | undefined
): string => explicitReference ?? sessionUserId ?? "anonymous";
