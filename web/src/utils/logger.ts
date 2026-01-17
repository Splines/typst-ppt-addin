/**
 * Logs debug messages with a consistent prefix.
 */
export function debug(...args: unknown[]) {
  console.log("[TypstAddin]", ...args);
}
