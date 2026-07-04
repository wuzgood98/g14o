/** Supported duration units for {@link Duration} strings. */
export type Unit = "ms" | "s" | "m" | "h" | "d";

/**
 * Upstash-style duration string (e.g. `"60 s"`, `"15m"`, `"1 h"`).
 *
 * Accepts an optional space between the number and unit.
 */
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
 *
 * @param window - Duration string such as `"60 s"` or `"15m"`.
 * @returns Duration in milliseconds.
 * @throws When the format or unit is invalid.
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
