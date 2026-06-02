export type Unit = "ms" | "s" | "m" | "h" | "d";
export type Duration = `${number} ${Unit}` | `${number}${Unit}`;

const DURATION_UNITS: Record<Unit, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

const DURATION_REGEX = /^(\d+)\s*(ms|s|m|h|d)$/i;

/**
 * Parses Upstash-style duration strings into milliseconds.
 */
export function parseDurationToMs(window: Duration): number {
  const match = String(window).trim().match(DURATION_REGEX);
  if (!match) {
    throw new Error(`Invalid rate limit window duration: ${window}`);
  }
  const amount = Number.parseInt(match[1] ?? "0", 10);
  const unit = (match[2] ?? "s").toLowerCase() as Unit;
  const multiplier = DURATION_UNITS[unit];
  if (!multiplier) {
    throw new Error(`Invalid rate limit window unit: ${unit}`);
  }
  return amount * multiplier;
}
