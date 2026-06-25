import { createServerAccessError } from "./errors";

/** Called when a server key is read on the client. May throw a custom error; otherwise the default is thrown. */
export type OnInvalidAccessHandler = (variable: string) => never;

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

  const onInvalidAccessHandler = (variable: string): never => {
    if (onInvalidAccess) {
      onInvalidAccess(variable);
    }
    throw createServerAccessError(variable);
  };

  return new Proxy(target, {
    get(t, prop, receiver) {
      if (typeof prop !== "string") {
        return Reflect.get(t, prop, receiver);
      }
      if (!(isServer || IGNORED_PROPS.has(prop) || clientKeys.has(prop))) {
        return onInvalidAccessHandler(prop);
      }
      return Reflect.get(t, prop, receiver);
    },
  }) as Readonly<T>;
}
