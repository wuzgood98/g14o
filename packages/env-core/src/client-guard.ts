import { createServerAccessError } from "./errors";

export type OnInvalidAccessHandler = (variable: string) => void;

const IGNORED_PROPS = new Set(["__esModule", "$$typeof"]);

export function guardEnv<T extends Record<string, unknown>>(
  target: T,
  opts: {
    isServer: boolean;
    clientKeys: ReadonlySet<string>;
    onInvalidAccess?: OnInvalidAccessHandler;
  }
): Readonly<T> {
  const { isServer, clientKeys, onInvalidAccess } = opts;

  return new Proxy(target, {
    get(t, prop, receiver) {
      if (typeof prop !== "string") {
        return Reflect.get(t, prop, receiver);
      }
      if (!(isServer || IGNORED_PROPS.has(prop) || clientKeys.has(prop))) {
        onInvalidAccess?.(prop);
        throw createServerAccessError(prop);
      }
      return Reflect.get(t, prop, receiver);
    },
  }) as Readonly<T>;
}
