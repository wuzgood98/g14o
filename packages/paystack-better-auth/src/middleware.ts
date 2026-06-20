import { APIError } from "@better-auth/core/error";
import {
  type AuthMiddleware,
  createAuthMiddleware,
  sessionMiddleware,
} from "better-auth/api";
import { PAYSTACK_ERROR_CODES } from "./error-codes";

export const paystackSessionMiddleware: AuthMiddleware = createAuthMiddleware(
  {
    use: [sessionMiddleware],
  },
  (ctx) => {
    if (!ctx.context.session) {
      throw APIError.from("UNAUTHORIZED", PAYSTACK_ERROR_CODES.UNAUTHORIZED);
    }

    return Promise.resolve({
      session: ctx.context.session,
    });
  }
);

export const getReferenceId = (
  sessionUserId: string | undefined,
  explicitReference: string | undefined
): string => explicitReference ?? sessionUserId ?? "anonymous";
