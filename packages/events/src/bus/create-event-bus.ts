import { DEFAULT_ON_LISTENER_ERROR } from "../constants/defaults";
import {
  bindEventLogger,
  type InternalLogger,
  resolveLogger,
} from "../logging";
import { runMiddlewarePipeline } from "../pipeline/run-pipeline";
import { flattenSchema } from "../schema/flatten-schema";
import type {
  EventsFromSchemaInput,
  NestedSchemaShape,
} from "../schema/standard-schema";
import {
  createEventValidator,
  createNoopValidator,
  type EventValidator,
} from "../schema/validate";
import { type ExecutionStrategy, parallelStrategy } from "../strategies";
import type { EventStream } from "../stream/interface";
import {
  type ChannelSubscribeEventHook,
  type ChannelSubscribeEventOptions,
  createEventSubscription,
  isUseEventOptions,
  type SubscribeEventHook,
} from "../subscribe-event";
import type {
  ErrorHandler,
  EventContext,
  MutableEventContext,
  NamespaceEvents,
  OnListenerErrorMode,
} from "../types/context";
import type {
  EventHandler,
  EventName,
  HandlerContext,
  MultiEventHandlerContext,
  OnOptions,
  SingleEventHandlerContext,
} from "../types/listener";
import { deepFreeze } from "../utils/freeze";
import { createEventId, nowTimestamp } from "../utils/id";
import { type EventBusHooks, runEventHook } from "./hooks";
import { ListenerRegistry } from "./listener-registry";
import { normalizeEventError } from "./normalize-error";

export type { EventBusHooks } from "./hooks";

/** Reserved metadata key (`"channels"`) for channel-scoped emissions. @internal */
export const CHANNELS_METADATA_KEY = "channels" as const;

function assertNonEmptyChannels(names: readonly string[]): string[] {
  if (names.length === 0) {
    throw new Error(
      "channel() requires at least one channel name; an empty list must not silently mean everyone."
    );
  }

  return [...names];
}

function eventMatchesBoundChannels(
  boundChannels: readonly string[],
  metadata: Record<string, unknown>
): boolean {
  const eventChannels = metadata[CHANNELS_METADATA_KEY];
  if (!Array.isArray(eventChannels)) {
    return false;
  }

  return boundChannels.some((channel) => eventChannels.includes(channel));
}

export function createChannelEmitter<TEvents extends Record<string, unknown>>(
  bus: EventBus<TEvents>,
  channelNames: string[]
): ChannelEmitter<TEvents> {
  const channels = assertNonEmptyChannels(channelNames);
  const wrappedHandlers = new WeakMap<
    (ctx: HandlerContext<TEvents, EventName<TEvents>>) => void | Promise<void>,
    (ctx: HandlerContext<TEvents, EventName<TEvents>>) => void | Promise<void>
  >();

  const wrapHandler = <K extends EventName<TEvents>>(
    handler: (ctx: HandlerContext<TEvents, K>) => void | Promise<void>
  ): ((ctx: HandlerContext<TEvents, K>) => void | Promise<void>) => {
    const wrapped = (ctx: HandlerContext<TEvents, K>) => {
      if (eventMatchesBoundChannels(channels, ctx.metadata)) {
        return handler(ctx);
      }
    };

    wrappedHandlers.set(
      handler as (
        ctx: HandlerContext<TEvents, EventName<TEvents>>
      ) => void | Promise<void>,
      wrapped as (
        ctx: HandlerContext<TEvents, EventName<TEvents>>
      ) => void | Promise<void>
    );

    return wrapped;
  };

  return {
    emit(event, payload, metadata) {
      return bus.emit(event, payload, {
        ...(metadata ?? {}),
        [CHANNELS_METADATA_KEY]: channels,
      });
    },

    dispatch(event, payload, metadata) {
      bus.dispatch(event, payload, {
        ...(metadata ?? {}),
        [CHANNELS_METADATA_KEY]: channels,
      });
    },

    on(event, handler, opts) {
      return bus.on(event, wrapHandler(handler), opts);
    },

    once(event, handler, opts) {
      return bus.once(event, wrapHandler(handler), opts);
    },

    off(event, handler) {
      const wrapped = wrappedHandlers.get(
        handler as (
          ctx: HandlerContext<TEvents, EventName<TEvents>>
        ) => void | Promise<void>
      );
      if (wrapped) {
        bus.off(
          event,
          wrapped as (ctx: HandlerContext<TEvents, typeof event>) => void
        );
      }
    },

    subscribe(
      eventOrOptions:
        | EventName<TEvents>
        | readonly (keyof TEvents & string)[]
        | ChannelSubscribeEventOptions<
            TEvents,
            readonly (keyof TEvents & string)[]
          >,
      handler?: (
        ctx: HandlerContext<TEvents, EventName<TEvents>>
      ) => void | Promise<void>,
      opts?: OnOptions
    ): Promise<() => void> {
      if (isUseEventOptions<TEvents>(eventOrOptions)) {
        const options = eventOrOptions as ChannelSubscribeEventOptions<
          TEvents,
          readonly (keyof TEvents & string)[]
        >;
        return createEventSubscription(bus, {
          events: options.events,
          onData: options.onData as (
            ctx: MultiEventHandlerContext<TEvents, typeof options.events>
          ) => void | Promise<void>,
          once: options.once,
          priority: options.priority,
          signal: options.signal,
          channels,
        });
      }

      if (Array.isArray(eventOrOptions)) {
        const events = eventOrOptions as readonly (keyof TEvents & string)[];
        return createEventSubscription(bus, {
          events,
          onData: handler as (
            ctx: MultiEventHandlerContext<TEvents, typeof events>
          ) => void | Promise<void>,
          priority: opts?.priority,
          signal: opts?.signal,
          channels,
        });
      }

      if (!handler) {
        throw new Error(
          "channel.subscribe requires a handler for single-event subscriptions."
        );
      }

      return createEventSubscription(
        bus,
        eventOrOptions as EventName<TEvents>,
        handler as unknown as (
          ctx: SingleEventHandlerContext<TEvents, EventName<TEvents>>
        ) => void | Promise<void>,
        opts,
        channels
      );
    },
  } as ChannelEmitter<TEvents>;
}

/** Channel-scoped emitter; merges `channels` into metadata on each emission. */
export interface ChannelEmitter<TEvents extends Record<string, unknown>> {
  dispatch<K extends keyof TEvents & string>(
    event: K,
    payload: TEvents[K],
    metadata?: Record<string, unknown>
  ): void;
  emit<K extends keyof TEvents & string>(
    event: K,
    payload: TEvents[K],
    metadata?: Record<string, unknown>
  ): Promise<void>;
  off<K extends EventName<TEvents>>(
    event: K,
    handler: (ctx: HandlerContext<TEvents, K>) => void | Promise<void>
  ): void;
  on<K extends EventName<TEvents>>(
    event: K,
    handler: (ctx: HandlerContext<TEvents, K>) => void | Promise<void>,
    opts?: OnOptions
  ): () => void;
  once<K extends EventName<TEvents>>(
    event: K,
    handler: (ctx: HandlerContext<TEvents, K>) => void | Promise<void>,
    opts?: OnOptions
  ): () => void;
  subscribe: ChannelSubscribeEventHook<TEvents>;
}

/** Shared options for {@link Event}. */
export interface EventBusOptions {
  /** Lifecycle hooks for pipeline and error routing. */
  hooks?: EventBusHooks;
  /** How listener errors affect other listeners. @default "continue" */
  onListenerError?: OnListenerErrorMode;
  /** Listener execution strategy. @default parallelStrategy */
  strategy?: ExecutionStrategy;
  /** Cross-instance persistence and fan-out backend. */
  stream?: EventStream;
  /** Log pipeline steps to the console. @default false */
  verbose?: boolean;
}

/**
 * Bus configuration when a schema map is provided for schema-first mode.
 * @internal
 */
type SchemaEventConfig<TSchema extends NestedSchemaShape> = EventBusOptions & {
  schema: TSchema;
};

/**
 * Bus configuration when no schema is provided for type-only mode.
 * @internal
 */
type TypeOnlyEventConfig = EventBusOptions & {
  schema?: undefined;
};

/** Configuration for {@link Event}. With `schema`, event types are inferred. */
export type CreateEventConfig<TSchema extends NestedSchemaShape | undefined> =
  TSchema extends NestedSchemaShape
    ? SchemaEventConfig<TSchema>
    : TypeOnlyEventConfig;

/** Typed async-first event bus. */
export interface EventBus<TEvents extends Record<string, unknown>> {
  channel(...names: string[]): ChannelEmitter<TEvents>;
  clear(event?: EventName<TEvents>): void;
  dispatch<K extends keyof TEvents & string>(
    event: K,
    payload: TEvents[K],
    metadata?: Record<string, unknown>
  ): void;
  emit<K extends keyof TEvents & string>(
    event: K,
    payload: TEvents[K],
    metadata?: Record<string, unknown>
  ): Promise<void>;
  hasListeners(event: EventName<TEvents>): boolean;
  listenerCount(event: EventName<TEvents>): number;
  namespace<TPrefix extends string>(
    prefix: TPrefix
  ): EventBus<NamespaceEvents<TPrefix, TEvents>>;
  off<K extends EventName<TEvents>>(
    event: K,
    handler: (ctx: HandlerContext<TEvents, K>) => void | Promise<void>
  ): void;
  on<K extends EventName<TEvents>>(
    event: K,
    handler: (ctx: HandlerContext<TEvents, K>) => void | Promise<void>,
    opts?: OnOptions
  ): () => void;
  once<K extends EventName<TEvents>>(
    event: K,
    handler: (ctx: HandlerContext<TEvents, K>) => void | Promise<void>,
    opts?: OnOptions
  ): () => void;
  onError(handler: ErrorHandler): () => void;
  onValidationError(handler: ErrorHandler): () => void;
  readonly stream: EventStream;
  subscribe: SubscribeEventHook<TEvents>;
  use(middleware: import("../types/context").MiddlewareHandler): () => void;
}

/**
 * Mutable runtime state shared by a bus instance and its namespaces.
 * @internal
 */
interface EventBusState<TEvents extends Record<string, unknown>> {
  errorHandlers: ErrorHandler[];
  hooks?: EventBusHooks;
  logger: InternalLogger;
  middleware: import("../types/context").MiddlewareHandler[];
  namespacePrefix?: string;
  onListenerError: OnListenerErrorMode;
  parent?: EventBusInternal<TEvents>;
  registry: ListenerRegistry;
  strategy: ExecutionStrategy;
  stream: EventStream;
  validationErrorHandlers: ErrorHandler[];
  validator: EventValidator | null;
}

/**
 * Event bus with access to internal state for namespace wiring.
 * @internal
 */
interface EventBusInternal<TEvents extends Record<string, unknown>>
  extends EventBus<TEvents> {
  state: EventBusState<TEvents>;
}

/** @internal Prefer {@link Event}. Creates a typed event bus. */
export function createEventBus<const TSchema extends NestedSchemaShape>(
  config: EventBusOptions & { schema: TSchema }
): EventBus<EventsFromSchemaInput<TSchema>>;

export function createEventBus<TEvents extends Record<string, unknown>>(
  config?: EventBusOptions
): EventBus<TEvents>;

export function createEventBus(
  config?: EventBusOptions & { schema?: NestedSchemaShape }
): EventBus<Record<string, unknown>> {
  const schema = config?.schema;

  const validator =
    schema && typeof schema === "object"
      ? createEventValidator(flattenSchema(schema))
      : createNoopValidator();

  if (!config?.stream) {
    throw new Error("Stream not configured");
  }
  const stream = config.stream;
  const logger = resolveLogger(config?.verbose);

  const bus = createEventInternal({
    hooks: config?.hooks,
    logger,
    onListenerError: config?.onListenerError ?? DEFAULT_ON_LISTENER_ERROR,
    strategy: config?.strategy ?? parallelStrategy,
    stream,
    validator,
  });

  bindEventLogger(bus, logger);

  if (config?.hooks?.onValidationError) {
    bus.onValidationError(config.hooks.onValidationError);
  }

  if (config?.hooks?.onError) {
    bus.onError(config.hooks.onError);
  }

  return bus;
}

/**
 * Builds a bus instance from resolved options and shared state.
 * @internal
 */
function createEventInternal<TEvents extends Record<string, unknown>>(options: {
  hooks?: EventBusHooks;
  logger: InternalLogger;
  namespacePrefix?: string;
  onListenerError?: OnListenerErrorMode;
  parent?: EventBusInternal<TEvents>;
  strategy?: ExecutionStrategy;
  stream: EventStream;
  validator: EventValidator | null;
}): EventBusInternal<TEvents> {
  const state: EventBusState<TEvents> = {
    errorHandlers: [],
    hooks: options.hooks,
    logger: options.logger,
    middleware: [],
    namespacePrefix: options.namespacePrefix,
    parent: options.parent,
    registry: new ListenerRegistry(),
    strategy: options.strategy ?? parallelStrategy,
    onListenerError: options.onListenerError ?? DEFAULT_ON_LISTENER_ERROR,
    stream: options.stream,
    validationErrorHandlers: [],
    validator: options.validator,
  };

  let bus!: EventBusInternal<TEvents>;

  const resolveRoot = (): EventBusInternal<TEvents> => state.parent ?? bus;

  const resolveEventName = (event: string): string => {
    if (!state.namespacePrefix) {
      return event;
    }
    return `${state.namespacePrefix}.${event}`;
  };

  const handleListenerError = async (
    error: unknown,
    ctx: EventContext<unknown>
  ): Promise<void> => {
    const normalized = normalizeEventError(error);
    const root = resolveRoot();
    root.state.logger.warn(`[events] Listener error: ${ctx.name}`, normalized);
    const handlers = root.state.errorHandlers;

    for (const handler of handlers) {
      await handler(normalized, ctx);
    }
  };

  const handleValidationError = async (
    error: unknown,
    ctx: EventContext<unknown>,
    reject?: (error: unknown) => void
  ): Promise<void> => {
    const normalized = normalizeEventError(error);
    const root = resolveRoot();
    root.state.logger.warn(
      `[events] Validation failed: ${ctx.name}`,
      normalized
    );
    const handlers = root.state.validationErrorHandlers;

    for (const handler of handlers) {
      await handler(normalized, ctx);
    }

    reject?.(normalized);
  };

  const validatePayload = (event: string, payload: unknown): unknown => {
    const root = resolveRoot();
    if (!root.state.validator) {
      return payload;
    }

    return root.state.validator.validate(event, payload);
  };

  const processEvent = async (
    event: string,
    payload: unknown,
    metadata: Record<string, unknown> | undefined,
    reject?: (error: unknown) => void
  ): Promise<void> => {
    let validatedPayload: unknown;

    try {
      validatedPayload = validatePayload(event, payload);
    } catch (error) {
      const ctx = buildContext(event, payload, metadata ?? {});
      await handleValidationError(error, ctx, reject);
      return;
    }

    const mutableContext: MutableEventContext<unknown> = {
      id: createEventId(),
      name: event,
      payload: validatedPayload,
      timestamp: nowTimestamp(),
      metadata: { ...(metadata ?? {}) },
    };

    const runListeners = async (): Promise<void> => {
      const root = resolveRoot();
      const listeners = root.state.registry.collect(event);
      const frozenContext = deepFreeze({ ...mutableContext });

      await root.state.strategy.run(listeners, frozenContext, {
        onListenerError: root.state.onListenerError,
        onError: (error, ctx) => handleListenerError(error, ctx),
        removeOnceListeners: (onceListeners) => {
          for (const listener of onceListeners) {
            listener.aborted = true;
          }
        },
      });
    };

    const root = resolveRoot();

    root.state.logger.info(`[events] Emit: ${event}`);

    await runEventHook(
      root.state.hooks?.onPipelineStart,
      mutableContext,
      root.state.logger
    );
    try {
      await runMiddlewarePipeline(
        root.state.middleware,
        mutableContext,
        runListeners
      );
      await publishToStream(root.state.stream, mutableContext);
      await runEventHook(
        root.state.hooks?.onPipelineEnd,
        mutableContext,
        root.state.logger
      );
    } finally {
      await runEventHook(
        root.state.hooks?.onPipelineFinally,
        mutableContext,
        root.state.logger
      );
    }
  };

  bus = {
    state,

    get stream() {
      return resolveRoot().state.stream;
    },

    on(event, handler, opts) {
      const resolved = resolveEventName(event);
      const root = resolveRoot();
      return root.state.registry.add(
        resolved,
        handler as EventHandler<unknown>,
        {
          priority: opts?.priority,
          signal: opts?.signal,
        }
      );
    },

    once(event, handler, opts) {
      const resolved = resolveEventName(event);
      const root = resolveRoot();
      return root.state.registry.add(
        resolved,
        handler as EventHandler<unknown>,
        {
          once: true,
          priority: opts?.priority,
          signal: opts?.signal,
        }
      );
    },

    off(event, handler) {
      const resolved = resolveEventName(event);
      const root = resolveRoot();
      root.state.registry.remove(resolved, handler as EventHandler<unknown>);
    },

    clear(event) {
      const root = resolveRoot();
      if (!event) {
        root.state.registry.clear();
        return;
      }
      root.state.registry.clear(resolveEventName(event));
    },

    hasListeners(event) {
      const root = resolveRoot();
      return root.state.registry.hasListeners(resolveEventName(event));
    },

    listenerCount(event) {
      const root = resolveRoot();
      return root.state.registry.listenerCount(resolveEventName(event));
    },

    emit(event, payload, metadata) {
      const resolved = resolveEventName(event);
      return new Promise<void>((resolve, reject) => {
        processEvent(resolved, payload, metadata, reject)
          .then(resolve)
          .catch(reject);
      });
    },

    dispatch(event, payload, metadata) {
      const resolved = resolveEventName(event);
      const root = resolveRoot();
      processEvent(resolved, payload, metadata).catch((error) => {
        root.state.logger.error(`[events] Dispatch failed: ${resolved}`, error);
      });
    },

    onError(handler) {
      const root = resolveRoot();
      root.state.errorHandlers.push(handler);
      return () => {
        const index = root.state.errorHandlers.indexOf(handler);
        if (index >= 0) {
          root.state.errorHandlers.splice(index, 1);
        }
      };
    },

    onValidationError(handler) {
      const root = resolveRoot();
      root.state.validationErrorHandlers.push(handler);
      return () => {
        const index = root.state.validationErrorHandlers.indexOf(handler);
        if (index >= 0) {
          root.state.validationErrorHandlers.splice(index, 1);
        }
      };
    },

    use(middleware) {
      const root = resolveRoot();
      root.state.middleware.push(middleware);
      return () => {
        const index = root.state.middleware.indexOf(middleware);
        if (index >= 0) {
          root.state.middleware.splice(index, 1);
        }
      };
    },

    namespace(prefix) {
      const root = resolveRoot();
      const child = createEventInternal<
        NamespaceEvents<typeof prefix, TEvents>
      >({
        hooks: root.state.hooks,
        logger: root.state.logger,
        namespacePrefix: state.namespacePrefix
          ? `${state.namespacePrefix}.${prefix}`
          : prefix,
        onListenerError: root.state.onListenerError,
        parent: root as unknown as EventBusInternal<
          NamespaceEvents<typeof prefix, TEvents>
        >,
        strategy: root.state.strategy,
        stream: root.state.stream,
        validator: root.state.validator,
      });
      bindEventLogger(child, root.state.logger);
      return child;
    },

    channel(...names) {
      return createChannelEmitter(bus, names);
    },

    subscribe: ((
      eventOrOptions: unknown,
      handler?: unknown,
      opts?: unknown
    ) => {
      if (isUseEventOptions<TEvents>(eventOrOptions)) {
        return createEventSubscription(bus, eventOrOptions);
      }

      if (!handler) {
        throw new Error(
          "bus.subscribe requires a handler for single-event subscriptions."
        );
      }

      return createEventSubscription(
        bus,
        eventOrOptions as EventName<TEvents>,
        handler as (
          ctx: SingleEventHandlerContext<TEvents, EventName<TEvents>>
        ) => void | Promise<void>,
        opts as OnOptions & { once?: boolean }
      );
    }) as SubscribeEventHook<TEvents>,
  };

  if (!options.parent) {
    bus.state.parent = bus;
  }

  return bus;
}

/**
 * Creates a frozen event context for dispatch and listener execution.
 * @internal
 */
function buildContext(
  event: string,
  payload: unknown,
  metadata: Record<string, unknown>
): EventContext<unknown> {
  return deepFreeze({
    id: createEventId(),
    name: event,
    payload,
    timestamp: nowTimestamp(),
    metadata,
  });
}

async function publishToStream(
  stream: EventStream,
  ctx: MutableEventContext<unknown>
): Promise<void> {
  const channels = ctx.metadata[CHANNELS_METADATA_KEY];
  if (!Array.isArray(channels) || channels.length === 0) {
    return;
  }

  for (const channel of channels) {
    if (typeof channel !== "string" || channel.length === 0) {
      continue;
    }

    const id = await stream.append(channel, {
      event: ctx.name,
      data: ctx.payload,
      timestamp: ctx.timestamp,
      metadata: ctx.metadata,
    });

    await stream.publish(channel, {
      id,
      channel,
      event: ctx.name,
      data: ctx.payload,
      timestamp: ctx.timestamp,
      metadata: ctx.metadata,
    });
  }
}
