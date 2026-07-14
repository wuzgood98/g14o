/**
 * Converts a glob pattern (`*` / `?`) into a RegExp that treats all other
 * regex metacharacters as literals.
 *
 * @internal
 */
export function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const regexPattern = escaped.replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${regexPattern}$`);
}
