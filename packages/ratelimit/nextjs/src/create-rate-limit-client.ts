/** biome-ignore-all lint/style/noExportedImports: it's required for the type */

import {
  type RateLimitClient as CoreRateLimitClient,
  type RateLimitOptions as CoreRateLimitOptions,
  type CreateRateLimitOptions,
  createRateLimit as createCoreRateLimit,
} from "@g14o/ratelimit";
import type { NextRequest, NextResponse } from "next/server";

export type { CreateRateLimitOptions };
export type RateLimitClient = CoreRateLimitClient<NextRequest, NextResponse>;
export type RateLimitOptions = CoreRateLimitOptions<NextRequest>;

/**
 * Creates a rate limit client with bound methods for Next.js `NextRequest` / `NextResponse` handlers.
 *
 * Delegates to {@link @g14o/ratelimit | @g14o/ratelimit} at runtime.
 */
export function createRateLimit(
  options: CreateRateLimitOptions = {}
): RateLimitClient {
  return createCoreRateLimit<NextRequest, NextResponse>(options);
}
