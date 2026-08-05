import type { MiddlewareHandler, MutableEventContext } from "../types/context";

/**
 * Runs middleware in order, then invokes listeners when the chain completes.
 * @internal
 */
export async function runMiddlewarePipeline(
  middleware: MiddlewareHandler[],
  ctx: MutableEventContext<unknown>,
  runListeners: () => void | Promise<void>
): Promise<void> {
  if (middleware.length === 0) {
    await runListeners();
    return;
  }

  let index = 0;

  const dispatch = async (): Promise<void> => {
    if (index >= middleware.length) {
      await runListeners();
      return;
    }

    const current = middleware[index];
    index += 1;

    if (!current) {
      await dispatch();
      return;
    }

    await current(ctx, dispatch);
  };

  await dispatch();
}
