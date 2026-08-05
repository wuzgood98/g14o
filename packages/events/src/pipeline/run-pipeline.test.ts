import { describe, expect, it, vi } from "vitest";
import { runMiddlewarePipeline } from "./run-pipeline";

describe("runMiddlewarePipeline", () => {
  it("composes middleware in registration order", async () => {
    const order: string[] = [];
    const ctx = {
      id: "1",
      name: "test",
      payload: {},
      timestamp: 1,
      metadata: {},
    };

    await runMiddlewarePipeline(
      [
        async (_ctx, next) => {
          order.push("before-1");
          await next();
          order.push("after-1");
        },
        async (_ctx, next) => {
          order.push("before-2");
          await next();
          order.push("after-2");
        },
      ],
      ctx,
      () => {
        order.push("listeners");
      }
    );

    expect(order).toEqual([
      "before-1",
      "before-2",
      "listeners",
      "after-2",
      "after-1",
    ]);
  });

  it("short-circuits when next is not called", async () => {
    const listeners = vi.fn();

    await runMiddlewarePipeline(
      [
        async () => {
          /* short-circuit */
        },
      ],
      {
        id: "1",
        name: "test",
        payload: {},
        timestamp: 1,
        metadata: {},
      },
      listeners
    );

    expect(listeners).not.toHaveBeenCalled();
  });
});
