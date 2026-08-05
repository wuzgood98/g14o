import type { EventContext } from "./context";

/** Options for {@link EventBus.on} / {@link EventBus.once}. */
export interface OnOptions {
  /** Higher runs first among listeners for the same event. @default 0 */
  priority?: number;
  /** Abort to unregister the listener when the signal fires. */
  signal?: AbortSignal;
}

/** Handler invoked when an event is emitted. */
export type EventHandler<TPayload> = (
  ctx: EventContext<TPayload>
) => void | Promise<void>;

export interface RegisteredListener {
  aborted: boolean;
  handler: EventHandler<unknown>;
  once: boolean;
  priority: number;
  signal?: AbortSignal;
}

type WildcardPattern = "*" | `${string}.*` | `${string}.*.${string}`;

export type EventName<TEvents extends Record<string, unknown>> =
  | (keyof TEvents & string)
  | WildcardPattern;

type PrefixEventKeys<
  TEvents extends Record<string, unknown>,
  TPrefix extends string,
> = {
  [K in keyof TEvents & string as K extends `${TPrefix}.${string}`
    ? K
    : never]: TEvents[K];
};

type PrefixSuffixEventKeys<
  TEvents extends Record<string, unknown>,
  TPrefix extends string,
  TSuffix extends string,
> = {
  [K in keyof TEvents & string as K extends `${TPrefix}.${string}.${TSuffix}`
    ? K
    : never]: TEvents[K];
};

type PatternEventKeys<
  TEvents extends Record<string, unknown>,
  TPattern extends WildcardPattern,
> = TPattern extends "*"
  ? TEvents
  : TPattern extends `${infer TPrefix}.*.${infer TSuffix}`
    ? PrefixSuffixEventKeys<TEvents, TPrefix, TSuffix>
    : TPattern extends `${infer TPrefix}.*`
      ? PrefixEventKeys<TEvents, TPrefix>
      : never;

type WildcardPayload<
  TEvents extends Record<string, unknown>,
  TPattern extends string,
> = TPattern extends "*"
  ? TEvents[keyof TEvents & string]
  : TPattern extends `${infer TPrefix}.*`
    ? PrefixEventKeys<TEvents, TPrefix>[keyof PrefixEventKeys<TEvents, TPrefix>]
    : never;

type HandlerPayload<
  TEvents extends Record<string, unknown>,
  TEvent extends string,
> = TEvent extends keyof TEvents
  ? TEvents[TEvent]
  : TEvent extends WildcardPattern
    ? WildcardPayload<TEvents, TEvent>
    : never;

export type HandlerContext<
  TEvents extends Record<string, unknown>,
  TEvent extends string,
> = EventContext<HandlerPayload<TEvents, TEvent>>;

export type DiscriminatedHandlerContext<
  TEvents extends Record<string, unknown>,
  TEvent extends keyof TEvents & string,
  TChannel = string | undefined,
> = HandlerContext<TEvents, TEvent> & {
  event: TEvent;
  channel: TChannel;
};

export type MultiEventHandlerContext<
  TEvents extends Record<string, unknown>,
  TEventList extends readonly (keyof TEvents & string)[],
> = {
  [K in TEventList[number]]: DiscriminatedHandlerContext<
    TEvents,
    K,
    string | undefined
  >;
}[TEventList[number]];

export type ChannelHandlerContext<TEvents extends Record<string, unknown>> = {
  [K in keyof TEvents & string]: DiscriminatedHandlerContext<
    TEvents,
    K,
    string
  >;
}[keyof TEvents & string];

type WildcardHandlerContext<
  TEvents extends Record<string, unknown>,
  TPattern extends WildcardPattern,
> = {
  [K in keyof PatternEventKeys<TEvents, TPattern> &
    string]: DiscriminatedHandlerContext<TEvents, K, string | undefined>;
}[keyof PatternEventKeys<TEvents, TPattern> & string];

export type SingleEventHandlerContext<
  TEvents extends Record<string, unknown>,
  TEvent extends EventName<TEvents>,
> = TEvent extends keyof TEvents & string
  ? DiscriminatedHandlerContext<TEvents, TEvent, undefined>
  : TEvent extends WildcardPattern
    ? WildcardHandlerContext<TEvents, TEvent>
    : never;

export type ChannelMultiEventHandlerContext<
  TEvents extends Record<string, unknown>,
  TEventList extends readonly (keyof TEvents & string)[],
> = {
  [K in TEventList[number]]: DiscriminatedHandlerContext<TEvents, K, string>;
}[TEventList[number]];

type ChannelWildcardHandlerContext<
  TEvents extends Record<string, unknown>,
  TPattern extends WildcardPattern,
> = {
  [K in keyof PatternEventKeys<TEvents, TPattern> &
    string]: DiscriminatedHandlerContext<TEvents, K, string>;
}[keyof PatternEventKeys<TEvents, TPattern> & string];

export type ChannelSingleEventHandlerContext<
  TEvents extends Record<string, unknown>,
  TEvent extends EventName<TEvents>,
> = TEvent extends keyof TEvents & string
  ? DiscriminatedHandlerContext<TEvents, TEvent, string>
  : TEvent extends WildcardPattern
    ? ChannelWildcardHandlerContext<TEvents, TEvent>
    : never;
