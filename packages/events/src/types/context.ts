export interface EventContext<TPayload = unknown> {
  readonly id: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly name: string;
  readonly payload: TPayload;
  readonly timestamp: number;
}

export interface MutableEventContext<TPayload = unknown> {
  id: string;
  metadata: Record<string, unknown>;
  name: string;
  payload: TPayload;
  timestamp: number;
}

/** Listener throw behavior: `"continue"` (default) or `"stop"` under sequential. */
export type OnListenerErrorMode = "continue" | "stop";

/** Bus-level error handler for {@link EventBus.onError} / {@link EventBus.onValidationError}. */
export type ErrorHandler = (
  error: Error,
  ctx: EventContext<unknown>
) => void | Promise<void>;

/** Middleware `next()` — continues pipeline or hands off to listeners. */
export type MiddlewareNext = () => Promise<void>;

/** Runs after validation, before listeners. Skip `next()` to short-circuit. */
export type MiddlewareHandler = (
  ctx: MutableEventContext<unknown>,
  next: MiddlewareNext
) => void | Promise<void>;

/** Strips namespace prefix from event map keys. */
export type StripNamespacePrefix<
  TPrefix extends string,
  TEvents extends Record<string, unknown>,
> = {
  [K in keyof TEvents as K extends `${TPrefix}.${infer Rest}`
    ? Rest
    : never]: TEvents[K];
};

/** Event map for a {@link EventBus.namespace} view with the prefix removed. */
export type NamespaceEvents<
  TPrefix extends string,
  TEvents extends Record<string, unknown>,
> = StripNamespacePrefix<TPrefix, TEvents>;
