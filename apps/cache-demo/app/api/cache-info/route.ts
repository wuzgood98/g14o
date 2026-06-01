import { NextResponse } from "next/server";
import { getCache, inMemoryCache } from "@/lib/cache";

export function GET() {
  getCache();

  const adapter = inMemoryCache() ? "in-memory" : "redis";

  return NextResponse.json({
    adapter,
    env: process.env.NODE_ENV ?? "development",
    nextPhase: process.env.NEXT_PHASE ?? null,
  });
}
