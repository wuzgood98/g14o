import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventProvider, useEventProviderContext } from "./provider";

class MockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;
  static instances: MockEventSource[] = [];

  url: string;
  onopen: ((this: EventSource, ev: Event) => unknown) | null = null;
  onmessage: ((this: EventSource, ev: MessageEvent) => unknown) | null = null;
  onerror: ((this: EventSource, ev: Event) => unknown) | null = null;
  readyState = MockEventSource.CONNECTING;

  constructor(url: string, _options?: EventSourceInit) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  close(): void {
    this.readyState = MockEventSource.CLOSED;
  }

  static latest(): MockEventSource {
    const latest = MockEventSource.instances.at(-1);
    if (!latest) {
      throw new Error("Expected a MockEventSource instance");
    }
    return latest;
  }
}

function renderProvider(maxReconnectAttempts: number) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      EventProvider,
      { api: { url: "/api/events" }, maxReconnectAttempts, children },
      children
    );

  const hook = renderHook(() => useEventProviderContext(), { wrapper });

  act(() => {
    hook.result.current.register("test", ["demo"], () => undefined);
  });

  return hook;
}

async function advanceConnectDebounce(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(25);
  });
}

function triggerError(instance: MockEventSource): void {
  instance.readyState = MockEventSource.CLOSED;
  act(() => {
    instance.onerror?.call(
      instance as unknown as EventSource,
      new Event("error")
    );
  });
}

describe("EventProvider reconnect attempts", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("does not retry when maxReconnectAttempts is 0", async () => {
    const hook = renderProvider(0);

    await advanceConnectDebounce();
    expect(MockEventSource.instances).toHaveLength(1);

    triggerError(MockEventSource.latest());

    expect(hook.result.current.status).toBe("error");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });

    expect(MockEventSource.instances).toHaveLength(1);
  });

  it("enters error after finite reconnect attempts are exhausted", async () => {
    const hook = renderProvider(2);

    await advanceConnectDebounce();
    triggerError(MockEventSource.latest());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    triggerError(MockEventSource.latest());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    triggerError(MockEventSource.latest());

    expect(hook.result.current.status).toBe("error");
    expect(MockEventSource.instances).toHaveLength(3);
  });

  it("keeps retrying when maxReconnectAttempts is Infinity", async () => {
    renderProvider(Number.POSITIVE_INFINITY);

    await advanceConnectDebounce();

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      triggerError(MockEventSource.latest());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(Math.min(1000 * attempt, 10_000));
      });
    }

    expect(MockEventSource.instances.length).toBeGreaterThan(5);
  });

  it("resets the failure counter after a successful connection", async () => {
    const hook = renderProvider(1);

    await advanceConnectDebounce();
    triggerError(MockEventSource.latest());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    act(() => {
      MockEventSource.latest().readyState = MockEventSource.OPEN;
      MockEventSource.latest().onopen?.call(
        MockEventSource.latest() as unknown as EventSource,
        new Event("open")
      );
    });

    expect(hook.result.current.status).toBe("connected");

    triggerError(MockEventSource.latest());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(hook.result.current.status).not.toBe("error");
    expect(MockEventSource.instances).toHaveLength(3);
  });
});
