// biome-ignore lint/style/noExportedImports: it is required for the type to be exported
import type { Duration } from "@upstash/ratelimit";

const DURATION_UNITS: Record<string, number> = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

const DURATION_REGEX = /^(\d+)\s*([smhd])$/i;

/**
 * Parses Upstash-style duration strings into milliseconds.
 */
export function parseDurationToMs(window: Duration): number {
  const match = String(window).trim().match(DURATION_REGEX);
  if (!match) {
    throw new Error(`Invalid rate limit window duration: ${window}`);
  }
  const amount = Number.parseInt(match[1] ?? "0", 10);
  const unit = (match[2] ?? "s").toLowerCase();
  const multiplier = DURATION_UNITS[unit];
  if (!multiplier) {
    throw new Error(`Invalid rate limit window unit: ${unit}`);
  }
  return amount * multiplier;
}

export type { Duration };
