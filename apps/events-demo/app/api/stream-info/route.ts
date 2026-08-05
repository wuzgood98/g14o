import { NextResponse } from "next/server";
import { streamAdapter } from "@/lib/events";

export function GET() {
  return NextResponse.json({
    adapter: streamAdapter,
    env: process.env.NODE_ENV ?? "development",
  });
}
