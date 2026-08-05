/** biome-ignore-all lint/performance/noBarrelFile: published package entry */
export type {
  ChannelEmitter,
  CreateEventConfig,
  EventBus,
  EventBusHooks,
  EventBusOptions,
} from "./bus/create-event-bus";
export type { InferEvents } from "./bus/event";
export { Event } from "./bus/event";
export {
  EventListenerError,
  EventValidationError,
} from "./errors/event-validation-error";
export {
  parallelStrategy,
  sequentialStrategy,
} from "./strategies";
export type { ExecutionStrategy } from "./strategies/types";
export type {
  SubscribeEventHook,
  SubscribeEventOptions,
} from "./subscribe-event";
export type {
  ErrorHandler,
  EventContext,
  MiddlewareHandler,
  OnListenerErrorMode,
} from "./types/context";
export type { OnOptions } from "./types/listener";
