import { describe, expect, it, vi } from "vitest";
import { ListenerRegistry } from "./listener-registry";

describe("ListenerRegistry", () => {
  it("registers exact listeners and unsubscribes", () => {
    const registry = new ListenerRegistry();
    const handler = vi.fn();
    const unsubscribe = registry.add("user.created", handler);

    expect(registry.listenerCount("user.created")).toBe(1);
    unsubscribe();
    expect(registry.listenerCount("user.created")).toBe(0);
  });

  it("matches wildcard listeners", () => {
    const registry = new ListenerRegistry();
    const all = vi.fn();
    const userWildcard = vi.fn();
    const exact = vi.fn();

    registry.add("*", all);
    registry.add("user.*", userWildcard);
    registry.add("user.created", exact);

    const listeners = registry.collect("user.created");
    expect(listeners).toHaveLength(3);

    for (const listener of listeners) {
      listener.handler({
        id: "1",
        name: "user.created",
        payload: {},
        timestamp: 1,
        metadata: {},
      });
    }

    expect(all).toHaveBeenCalledTimes(1);
    expect(userWildcard).toHaveBeenCalledTimes(1);
    expect(exact).toHaveBeenCalledTimes(1);
  });

  it("respects abort signals", () => {
    const registry = new ListenerRegistry();
    const controller = new AbortController();
    const handler = vi.fn();

    registry.add("user.created", handler, { signal: controller.signal });
    controller.abort();

    const listeners = registry.collect("user.created");
    expect(listeners).toHaveLength(0);
  });

  it("clears listeners by pattern", () => {
    const registry = new ListenerRegistry();
    registry.add("user.created", vi.fn());
    registry.add("user.deleted", vi.fn());

    registry.clear("user.created");
    expect(registry.listenerCount("user.created")).toBe(0);
    expect(registry.listenerCount("user.deleted")).toBe(1);
  });
});
