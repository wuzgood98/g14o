const STREAM_ID_PATTERN = /^\d+-\d+$/;

/** Returns true when `value` looks like a Redis stream id (`ms-seq`). */
export function isStreamCursor(value: string): boolean {
  return STREAM_ID_PATTERN.test(value);
}

/** Compare two Redis-style stream ids. Returns -1, 0, or 1. */
export function compareStreamIds(a: string, b: string): number {
  const [aTime = 0n, aSequence = 0n] = a.split("-").map(BigInt);
  const [bTime = 0n, bSequence = 0n] = b.split("-").map(BigInt);

  if (aTime < bTime) {
    return -1;
  }
  if (aTime > bTime) {
    return 1;
  }
  if (aSequence < bSequence) {
    return -1;
  }
  if (aSequence > bSequence) {
    return 1;
  }
  return 0;
}

/** Allocate a monotonic in-process stream id. */
export function createMemoryCursor(
  sequence: number,
  now: number = Date.now()
): string {
  return `${now}-${sequence}`;
}
