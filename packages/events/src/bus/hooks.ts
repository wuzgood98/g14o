import type { ErrorHandler, MutableEventContext } from "../types/context";
import type { VerboseLogger } from "../verbose.js";

/** Optional lifecycle hooks for {@link Event}. */
export interface EventBusHooks {
  /** Initial `onError` handler (listener errors). */
  onError?: ErrorHandler;
  /** After middleware + listeners complete. */
  onPipelineEnd?: (ctx: MutableEventContext<unknown>) => void | Promise<void>;
  /** After pipeline attempt (success or failure). Skipped on validation failure. */
  onPipelineFinally?: (
    ctx: MutableEventContext<unknown>
  ) => void | Promise<void>;
  /** After validation, before middleware + listeners. */
  onPipelineStart?: (ctx: MutableEventContext<unknown>) => void | Promise<void>;
  /** Initial `onValidationError` handler. */
  onValidationError?: ErrorHandler;
}

/**
 * Runs a lifecycle hook, awaiting async handlers and swallowing errors.
 * Hook errors are logged but never affect event emission or error routing.
 */
export async function runEventHook<Ctx>(
  hook: ((ctx: Ctx) => void | Promise<void>) | undefined,
  ctx: Ctx,
  logger: VerboseLogger
): Promise<void> {
  if (!hook) {
    return;
  }

  try {
    await hook(ctx);
  } catch (error) {
    logger.error("[events] Hook threw", error);
  }
}
