/** biome-ignore-all lint/style/noExportedImports: it's required for the type */

import {
  type RateLimitClient as CoreRateLimitClient,
  type RateLimitOptions as CoreRateLimitOptions,
  type CreateRateLimitOptions,
  createRateLimit as createCoreRateLimit,
} from "@g14o/ratelimit";
import type { NextRequest, NextResponse } from "next/server";

export type { CreateRateLimitOptions };

/**
 * Rate limit client typed for Next.js `NextRequest` / `NextResponse` handlers.
 *
 * See {@link @g14o/ratelimit!RateLimitClient} for method documentation.
 */
export type RateLimitClient = CoreRateLimitClient<NextRequest, NextResponse>;

/** Per-call options with Next.js-native `NextRequest` callbacks. */
export type RateLimitOptions = CoreRateLimitOptions<NextRequest>;

/**
 * Creates a rate limit client with bound methods for Next.js `NextRequest` / `NextResponse` handlers.
 *
 * Delegates to {@link @g14o/ratelimit | @g14o/ratelimit} at runtime.
 *
 * @param options - Redis credentials or client, logger, environment, and optional `tiers` overrides.
 * @returns {@link RateLimitClient} instance.
 *
 * @example
 * ```ts
 * export const { withRateLimit } = createRateLimit({
 *   redis: {
 *     url: process.env.UPSTASH_REDIS_REST_URL!,
 *     token: process.env.UPSTASH_REDIS_REST_TOKEN!,
 *   },
 * });
 *
 * export const POST = withRateLimit(
 *   async (req) => NextResponse.json({ ok: true }),
 *   { tier: "moderate" }
 * );
 * ```
 */
export function createRateLimit(
  options: CreateRateLimitOptions = {}
): RateLimitClient {
  return createCoreRateLimit<NextRequest, NextResponse>(options);
}
