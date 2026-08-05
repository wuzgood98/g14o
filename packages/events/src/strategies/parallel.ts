import { EventListenerError } from "../errors/event-validation-error";
import type { EventContext } from "../types/context";
import type { RegisteredListener } from "../types/listener";
import type { ExecutionStrategy, ExecutionStrategyOptions } from "./types";

/**
 * Runs a single listener and handles once-removal and error propagation.
 * @internal
 */
async function invokeListener(
  listener: RegisteredListener,
  ctx: EventContext<unknown>,
  options: ExecutionStrategyOptions
): Promise<"continue" | "stop"> {
  if (listener.aborted) {
    return "continue";
  }

  try {
    await listener.handler(ctx);
    if (listener.once) {
      options.removeOnceListeners([listener]);
    }
    return "continue";
  } catch (error) {
    const wrapped = new EventListenerError(ctx.name, error);
    if (options.onError) {
      await options.onError(wrapped, ctx);
    }

    if (options.onListenerError === "stop") {
      return "stop";
    }

    return "continue";
  }
}

/**
 * Default execution strategy. Runs all listeners concurrently via `Promise.all`.
 * Priority affects start order only — not completion order.
 */
export const parallelStrategy: ExecutionStrategy = {
  async run(listeners, ctx, options) {
    const sorted = [...listeners].sort(
      (left, right) => right.priority - left.priority
    );

    const results = await Promise.all(
      sorted.map((listener) => invokeListener(listener, ctx, options))
    );

    if (results.includes("stop")) {
      return;
    }
  },
};

/**
 * Runs listeners one at a time in priority order.
 * `"stop"` mode skips remaining listeners after the first throw.
 */
export const sequentialStrategy: ExecutionStrategy = {
  async run(listeners, ctx, options) {
    const sorted = [...listeners].sort(
      (left, right) => right.priority - left.priority
    );

    for (const listener of sorted) {
      const result = await invokeListener(listener, ctx, options);
      if (result === "stop") {
        break;
      }
    }
  },
};
