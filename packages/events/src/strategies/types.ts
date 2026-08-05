import type { EventContext } from "../types/context";
import type { RegisteredListener } from "../types/listener";

/** Pluggable listener execution strategy. */
export interface ExecutionStrategy {
  run(
    listeners: RegisteredListener[],
    ctx: EventContext<unknown>,
    options: ExecutionStrategyOptions
  ): Promise<void>;
}

/** Options for {@link ExecutionStrategy.run}. */
export interface ExecutionStrategyOptions {
  onError?: (
    error: unknown,
    ctx: EventContext<unknown>
  ) => void | Promise<void>;
  onListenerError: "continue" | "stop";
  removeOnceListeners: (listeners: RegisteredListener[]) => void;
}
