/** True when running in a browser-like environment without Node stdout. */
export function isBrowserEnv(): boolean {
  return typeof process === "undefined" || !process.stdout;
}
