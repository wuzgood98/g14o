/**
 * Recursively freezes an object and its nested properties.
 * @internal
 */
export function deepFreeze<T extends object>(value: T): Readonly<T> {
  for (const key of Reflect.ownKeys(value)) {
    const property = value[key as keyof T];
    if (
      property &&
      typeof property === "object" &&
      !Object.isFrozen(property)
    ) {
      deepFreeze(property);
    }
  }

  return Object.freeze(value);
}
