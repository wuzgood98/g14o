import { describe, expect, it, vi } from "vitest";
import { CHANNELS_METADATA_KEY } from "./bus/create-event-bus";
import {
  createEventSubscription,
  normalizeChannels,
  resolveChannelMatch,
} from "./subscribe-event";
import { createTestEvent } from "./test-utils/create-test-event";

interface Events extends Record<string, unknown> {
  "demo.notification": { title: string; body: string };
  "demo.ping": { message: string };
}

describe("normalizeChannels", () => {
  it("wraps a single string channel", () => {
    expect(normalizeChannels("room-1")).toEqual(["room-1"]);
  });
});

describe("resolveChannelMatch", () => {
  it("matches wildcard against string metadata channels", () => {
    expect(
      resolveChannelMatch({ [CHANNELS_METADATA_KEY]: "room-1" }, ["*"])
    ).toBe("room-1");
  });
});

describe("createEventSubscription", () => {
  it("resolves to an unsubscribe function", async () => {
    const bus = createTestEvent<Events>();
    const onData = vi.fn();

    const unsubscribe = await createEventSubscription(bus, {
      events: ["demo.ping"] as const,
      onData,
    });

    expect(typeof unsubscribe).toBe("function");

    await bus.emit("demo.ping", { message: "hello" });
    expect(onData).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "demo.ping",
        channel: undefined,
        payload: { message: "hello" },
      })
    );

    unsubscribe();
    onData.mockClear();
    await bus.emit("demo.ping", { message: "again" });
    expect(onData).not.toHaveBeenCalled();
  });

  it("filters by channels and enriches channel on match", async () => {
    const bus = createTestEvent<Events>();
    const onData = vi.fn();

    const unsubscribe = await createEventSubscription(bus, {
      channels: ["room-1"],
      events: ["demo.ping"] as const,
      onData,
    });

    await bus.emit("demo.ping", { message: "unscoped" });
    expect(onData).not.toHaveBeenCalled();

    await bus.channel("room-1").emit("demo.ping", { message: "scoped" });
    expect(onData).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "demo.ping",
        channel: "room-1",
        payload: { message: "scoped" },
      })
    );

    unsubscribe();
  });

  it("ignores channel-scoped emits when no channels filter is set", async () => {
    const bus = createTestEvent<Events>();
    const onData = vi.fn();

    await createEventSubscription(bus, {
      events: ["demo.ping"] as const,
      onData,
    });

    await bus.channel("room-1").emit("demo.ping", { message: "scoped" });
    expect(onData).not.toHaveBeenCalled();
  });

  it("ignores non-matching channel-scoped emits when channels filter is set", async () => {
    const bus = createTestEvent<Events>();
    const onData = vi.fn();

    await createEventSubscription(bus, {
      channels: ["room-1"],
      events: ["demo.ping"] as const,
      onData,
    });

    await bus.channel("room-2").emit("demo.ping", { message: "other room" });
    expect(onData).not.toHaveBeenCalled();
  });

  it("enriches wildcard single-event subscriptions", async () => {
    const bus = createTestEvent<Events>();
    const onData = vi.fn();

    const unsubscribe = await createEventSubscription(bus, "demo.*", onData);

    await bus.emit("demo.ping", { message: "ping" });
    await bus.emit("demo.notification", { title: "Hi", body: "There" });

    expect(onData).toHaveBeenCalledTimes(2);
    expect(onData).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ event: "demo.ping" })
    );
    expect(onData).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ event: "demo.notification" })
    );

    unsubscribe();
  });

  it("removes listeners when signal aborts", async () => {
    const bus = createTestEvent<Events>();
    const onData = vi.fn();
    const controller = new AbortController();

    await createEventSubscription(bus, {
      events: ["demo.ping"] as const,
      signal: controller.signal,
      onData,
    });

    controller.abort();
    await bus.emit("demo.ping", { message: "hello" });
    expect(onData).not.toHaveBeenCalled();
  });
});
