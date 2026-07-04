import type { RateLimitRequest } from "@g14o/ratelimit";
import type { Request } from "express";

/**
 * Maps an Express request to the minimal {@link RateLimitRequest} shape.
 *
 * @param req - Express request.
 * @returns Object with `url` and `headers.get()` for core rate limiting.
 */
export function adaptExpressRequest(req: Request): RateLimitRequest {
  const host = req.get("host") ?? "localhost";
  const protocol = req.protocol ?? "http";
  return {
    url: `${protocol}://${host}${req.originalUrl}`,
    headers: {
      get: (name: string) => req.get(name) ?? null,
    },
  };
}
