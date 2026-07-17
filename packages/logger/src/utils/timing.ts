/** Returns a monotonic millisecond timestamp for elapsed-time measurement. */
export function monotonicNow(): number {
  if (
    typeof performance !== "undefined" &&
    typeof performance.now === "function"
  ) {
    return performance.now();
  }
  return Date.now();
}
