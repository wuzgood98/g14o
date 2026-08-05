import type { EventBus } from "./bus/create-event-bus";
import { CHANNELS_METADATA_KEY } from "./bus/create-event-bus";
import type {
  ChannelMultiEventHandlerContext,
  ChannelSingleEventHandlerContext,
  DiscriminatedHandlerContext,
  EventName,
  HandlerContext,
  MultiEventHandlerContext,
  OnOptions,
  SingleEventHandlerContext,
} from "./types/listener";

/** Options for server {@link EventBus.subscribe} (options-object form). */
export interface UseEventOptions<
  Events extends Record<string, unknown>,
  K extends readonly (keyof Events & string)[] = readonly (keyof Events &
    string)[],
> {
  /** Channel names to scope delivery; omit for bus-wide subscribe. */
  channels?: readonly string[];
  /** Event names to listen for. */
  events: K;
  /** Unsubscribe after the first matching delivery. */
  once?: boolean;
  /** Called for each matching event payload. */
  onData: (ctx: MultiEventHandlerContext<Events, K>) => void | Promise<void>;
  /** Higher runs first when multiple subscribers match. */
  priority?: number;
}

/** {@link UseEventOptions} plus an optional abort signal for cleanup. */
export interface SubscribeEventOptions<
  Events extends Record<string, unknown>,
  K extends readonly (keyof Events & string)[] = readonly (keyof Events &
    string)[],
> extends UseEventOptions<Events, K> {
  /** Abort to unsubscribe when the signal fires. */
  signal?: AbortSignal;
}

/** Typed {@link EventBus.subscribe} overloads. */
export interface SubscribeEventHook<Events extends Record<string, unknown>> {
  <const K extends readonly (keyof Events & string)[]>(
    options: SubscribeEventOptions<Events, K>
  ): Promise<() => void>;
  <K extends EventName<Events>>(
    event: K,
    handler: (
      ctx: SingleEventHandlerContext<Events, K>
    ) => void | Promise<void>,
    opts?: OnOptions & { once?: boolean }
  ): Promise<() => void>;
}

export type ChannelSubscribeEventOptions<
  Events extends Record<string, unknown>,
  K extends readonly (keyof Events & string)[] = readonly (keyof Events &
    string)[],
> = Omit<SubscribeEventOptions<Events, K>, "channels" | "onData"> & {
  onData: (
    ctx: ChannelMultiEventHandlerContext<Events, K>
  ) => void | Promise<void>;
};

/** Typed {@link ChannelEmitter.subscribe} overloads — no `channels`; scope is implicit. */
export interface ChannelSubscribeEventHook<
  Events extends Record<string, unknown>,
> {
  <const K extends readonly (keyof Events & string)[]>(
    options: ChannelSubscribeEventOptions<Events, K>
  ): Promise<() => void>;
  <K extends EventName<Events>>(
    event: K,
    handler: (
      ctx: ChannelSingleEventHandlerContext<Events, K>
    ) => void | Promise<void>,
    opts?: OnOptions & { once?: boolean }
  ): Promise<() => void>;
}

export function isUseEventOptions<Events extends Record<string, unknown>>(
  value: unknown
): value is UseEventOptions<Events, readonly (keyof Events & string)[]> {
  return (
    typeof value === "object" &&
    value !== null &&
    "events" in value &&
    "onData" in value &&
    Array.isArray(
      (value as UseEventOptions<Events, readonly (keyof Events & string)[]>)
        .events
    )
  );
}

/** @internal Exported for tests. */
export function normalizeChannels(
  value: unknown
): readonly string[] | undefined {
  if (typeof value === "string") {
    return value.length > 0 ? [value] : undefined;
  }

  if (!Array.isArray(value)) {
    return;
  }

  const channels = value.filter(
    (entry): entry is string => typeof entry === "string" && entry.length > 0
  );

  return channels.length > 0 ? channels : undefined;
}

/** @internal Exported for tests. */
export function hasChannelMetadata(metadata: Record<string, unknown>): boolean {
  return normalizeChannels(metadata[CHANNELS_METADATA_KEY]) !== undefined;
}

/** @internal Exported for tests. */
export function resolveChannelMatch(
  metadata: Record<string, unknown>,
  subscribedChannels: readonly string[] | undefined
): string | undefined {
  if (!subscribedChannels || subscribedChannels.length === 0) {
    return;
  }

  const eventChannels = normalizeChannels(metadata[CHANNELS_METADATA_KEY]);
  if (!eventChannels) {
    return;
  }

  if (subscribedChannels.includes("*")) {
    return eventChannels[0];
  }

  for (const channel of subscribedChannels) {
    if (channel !== "*" && eventChannels.includes(channel)) {
      return channel;
    }
  }
}

/** @internal Exported for tests. */
export function enrichContext<
  TEvents extends Record<string, unknown>,
  K extends keyof TEvents & string,
  TChannel extends string | undefined = string | undefined,
>(
  ctx: HandlerContext<TEvents, K>,
  channel: TChannel
): DiscriminatedHandlerContext<TEvents, K, TChannel> {
  return {
    ...ctx,
    event: ctx.name as K,
    channel,
  } as DiscriminatedHandlerContext<TEvents, K, TChannel>;
}

function deliverSubscribedEvent<
  TEvents extends Record<string, unknown>,
  K extends keyof TEvents & string,
>(
  ctx: HandlerContext<TEvents, K>,
  subscribedChannels: readonly string[] | undefined,
  deliver: (
    ctx: DiscriminatedHandlerContext<TEvents, K, string | undefined>
  ) => void
): void {
  if (subscribedChannels) {
    const matchedChannel = resolveChannelMatch(
      ctx.metadata,
      subscribedChannels
    );
    if (matchedChannel === undefined) {
      return;
    }

    deliver(enrichContext(ctx, matchedChannel));
    return;
  }

  if (hasChannelMetadata(ctx.metadata)) {
    return;
  }

  deliver(enrichContext(ctx, undefined));
}

function subscribeWithOptions<
  Events extends Record<string, unknown>,
  const K extends readonly (keyof Events & string)[],
>(
  bus: EventBus<Events>,
  options: SubscribeEventOptions<Events, K>
): () => void {
  const subscribedChannels = options.channels;
  const unsubscribes = options.events.map((eventName) => {
    const stable = (ctx: HandlerContext<Events, typeof eventName>) => {
      deliverSubscribedEvent(ctx, subscribedChannels, (enriched) => {
        options.onData(enriched as MultiEventHandlerContext<Events, K>);
      });
    };

    return options.once
      ? bus.once(eventName, stable, {
          priority: options.priority,
          signal: options.signal,
        })
      : bus.on(eventName, stable, {
          priority: options.priority,
          signal: options.signal,
        });
  });

  return () => {
    for (const unsubscribe of unsubscribes) {
      unsubscribe();
    }
  };
}

function subscribeWithSingleEvent<
  Events extends Record<string, unknown>,
  K extends EventName<Events>,
>(
  bus: EventBus<Events>,
  event: K,
  handler: (ctx: SingleEventHandlerContext<Events, K>) => void | Promise<void>,
  opts?: OnOptions & { once?: boolean },
  subscribedChannels?: readonly string[]
): () => void {
  const stable = (ctx: HandlerContext<Events, K>) => {
    deliverSubscribedEvent(ctx, subscribedChannels, (enriched) => {
      handler(enriched as SingleEventHandlerContext<Events, K>);
    });
  };

  const boundHandler = stable as unknown as (
    ctx: HandlerContext<Events, K>
  ) => void | Promise<void>;

  return opts?.once
    ? bus.once(event, boundHandler, opts)
    : bus.on(event, boundHandler, opts);
}

export function createEventSubscription<
  Events extends Record<string, unknown>,
  const K extends readonly (keyof Events & string)[],
>(
  bus: EventBus<Events>,
  options: SubscribeEventOptions<Events, K>
): Promise<() => void>;

export function createEventSubscription<
  Events extends Record<string, unknown>,
  K extends EventName<Events>,
>(
  bus: EventBus<Events>,
  event: K,
  handler: (ctx: SingleEventHandlerContext<Events, K>) => void | Promise<void>,
  opts?: OnOptions & { once?: boolean },
  subscribedChannels?: readonly string[]
): Promise<() => void>;

export function createEventSubscription<
  Events extends Record<string, unknown>,
  K extends EventName<Events>,
>(
  bus: EventBus<Events>,
  eventOrOptions:
    | K
    | SubscribeEventOptions<Events, readonly (keyof Events & string)[]>,
  handler?: (ctx: SingleEventHandlerContext<Events, K>) => void | Promise<void>,
  opts?: OnOptions & { once?: boolean },
  subscribedChannels?: readonly string[]
): Promise<() => void> {
  if (isUseEventOptions<Events>(eventOrOptions)) {
    return Promise.resolve(subscribeWithOptions(bus, eventOrOptions));
  }

  if (!handler) {
    throw new Error(
      "createEventSubscription requires a handler for single-event subscriptions."
    );
  }

  return Promise.resolve(
    subscribeWithSingleEvent(
      bus,
      eventOrOptions as K,
      handler,
      opts,
      subscribedChannels
    )
  );
}
