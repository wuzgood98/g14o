import { describe, expect, it, vi } from "vitest";
import { parallelStrategy, sequentialStrategy } from "../strategies/parallel";
import type { RegisteredListener } from "../types/listener";
import { deepFreeze } from "../utils/freeze";

function createContext(name = "test.event") {
  return deepFreeze({
    id: "evt-1",
    name,
    payload: { ok: true },
    timestamp: 1,
    metadata: {},
  });
}

function createListener(
  handler: RegisteredListener["handler"],
  priority = 0
): RegisteredListener {
  return {
    handler,
    priority,
    once: false,
    aborted: false,
  };
}

describe("execution strategies", () => {
  it("parallel runs all listeners and continues on error by default", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const onError = vi.fn();

    await parallelStrategy.run(
      [
        createListener(() => {
          throw new Error("boom");
        }),
        createListener(first),
        createListener(second),
      ],
      createContext(),
      {
        onListenerError: "continue",
        onError,
        removeOnceListeners: vi.fn(),
      }
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("sequential honors priority and stop mode", async () => {
    const order: string[] = [];

    await sequentialStrategy.run(
      [
        createListener(() => {
          order.push("low");
        }, 1),
        createListener(() => {
          order.push("high");
          throw new Error("stop");
        }, 10),
        createListener(() => {
          order.push("never");
        }, 5),
      ],
      createContext(),
      {
        onListenerError: "stop",
        onError: vi.fn(),
        removeOnceListeners: vi.fn(),
      }
    );

    expect(order).toEqual(["high"]);
  });

  it("parallel sorts by priority before starting listeners", async () => {
    const order: number[] = [];

    await parallelStrategy.run(
      [
        createListener(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          order.push(1);
        }, 1),
        createListener(() => {
          order.push(10);
        }, 10),
      ],
      createContext(),
      {
        onListenerError: "continue",
        removeOnceListeners: vi.fn(),
      }
    );

    expect(order[0]).toBe(10);
  });
});
