import { describe, expect, it, vi } from "vitest";
import {
  EventListenerError,
  EventValidationError,
} from "../errors/event-validation-error";
import { sequentialStrategy } from "../strategies/parallel";
import { memoryStream } from "../stream/memory";
import { createTestEvent } from "../test-utils/create-test-event";
import { createMockSchema } from "../test-utils/schema";
import { CHANNELS_METADATA_KEY } from "./create-event-bus";
import { Event } from "./event";

interface Events extends Record<string, unknown> {
  "auth.login": { userId: string };
  "email.sent": { subject: string; to: string };
  "user.created": { email: string; id: string };
  "user.deleted": { id: string };
}

describe("Event", () => {
  it("throws when stream is not configured", () => {
    expect(() => new Event<Events>()).toThrow("Stream not configured");
    expect(() => new Event({})).toThrow("Stream not configured");
  });

  it("supports type-only mode without validation overhead", async () => {
    const bus = createTestEvent<Events>();
    const handler = vi.fn();

    bus.on("user.created", handler);
    await bus.emit("user.created", { id: "1", email: "a@b.com" });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "user.created",
        payload: { id: "1", email: "a@b.com" },
      })
    );
  });

  it("publishes channel-scoped emits to the stream", async () => {
    const stream = memoryStream();
    const bus = createTestEvent<Events>({ stream });
    const received = vi.fn();

    stream.subscribe(["tenant:123"], (message) => {
      received(message);
    });

    await bus.channel("tenant:123").emit("user.created", {
      id: "1",
      email: "a@b.com",
    });

    await vi.waitFor(() => {
      expect(received).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "user.created",
          channel: "tenant:123",
          data: { id: "1", email: "a@b.com" },
        })
      );
    });

    await stream.close();
  });

  it("exposes stream on the instance", () => {
    const stream = memoryStream();
    const bus = createTestEvent<Events>({ stream });
    expect(bus.stream).toBe(stream);
  });

  it("validates schema-first payloads once before listeners", async () => {
    const bus = createTestEvent({
      schema: {
        "user.created": createMockSchema((value) => {
          if (
            typeof value === "object" &&
            value !== null &&
            "email" in value &&
            typeof value.email === "string" &&
            value.email.includes("@")
          ) {
            return { value: value as { id: string; email: string } };
          }
          return { issues: [{ message: "invalid email" }] };
        }),
      },
    });
    const handler = vi.fn();
    const onValidationError = vi.fn();
    const onError = vi.fn();
    bus.onValidationError(onValidationError);
    bus.onError(onError);

    bus.on("user.created", handler);
    await bus.emit("user.created", { id: "1", email: "a@b.com" });
    expect(handler).toHaveBeenCalledTimes(1);

    await expect(
      bus.emit("user.created", { id: "1", email: "bad" })
    ).rejects.toBeInstanceOf(EventValidationError);
    expect(onValidationError).toHaveBeenCalledWith(
      expect.any(EventValidationError),
      expect.objectContaining({ name: "user.created" })
    );
    expect(onError).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("rejects emit when validation fails and no onValidationError handler exists", async () => {
    const bus = createTestEvent({
      schema: {
        "user.created": createMockSchema((value) => {
          if (
            typeof value === "object" &&
            value !== null &&
            "email" in value &&
            typeof value.email === "string" &&
            value.email.includes("@")
          ) {
            return { value: value as { id: string; email: string } };
          }
          return { issues: [{ message: "invalid email" }] };
        }),
      },
    });
    const onError = vi.fn();
    bus.onError(onError);

    await expect(
      bus.emit("user.created", { id: "1", email: "bad" })
    ).rejects.toBeInstanceOf(EventValidationError);
    expect(onError).not.toHaveBeenCalled();
  });

  it("routes dispatch validation failures to onValidationError without rejecting", async () => {
    const bus = createTestEvent({
      schema: {
        "user.created": createMockSchema(() => ({
          issues: [{ message: "invalid" }],
        })),
      },
    });
    const onValidationError = vi.fn();
    const onError = vi.fn();
    bus.onValidationError(onValidationError);
    bus.onError(onError);

    bus.dispatch("user.created", { id: "1", email: "a@b.com" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onValidationError).toHaveBeenCalledWith(
      expect.any(EventValidationError),
      expect.any(Object)
    );
    expect(onError).not.toHaveBeenCalled();
  });

  it("routes listener errors to onError without calling onValidationError", async () => {
    const bus = createTestEvent<Events>({ onListenerError: "continue" });
    const onError = vi.fn();
    const onValidationError = vi.fn();
    bus.onError(onError);
    bus.onValidationError(onValidationError);

    bus.on("user.created", () => {
      throw new Error("listener boom");
    });

    await bus.emit("user.created", { id: "1", email: "a@b.com" });

    expect(onError).toHaveBeenCalledWith(
      expect.any(EventListenerError),
      expect.any(Object)
    );
    expect(onValidationError).not.toHaveBeenCalled();
  });

  it("runs middleware before listeners and supports short-circuit", async () => {
    const bus = createTestEvent<Events>();
    const order: string[] = [];
    const handler = vi.fn(() => {
      order.push("listener");
    });

    bus.use(async (_ctx, next) => {
      order.push("middleware-1");
      await next();
    });
    bus.use(() => {
      order.push("middleware-block");
    });
    bus.on("user.created", handler);

    await bus.emit("user.created", { id: "1", email: "a@b.com" });
    expect(order).toEqual(["middleware-1", "middleware-block"]);
    expect(handler).not.toHaveBeenCalled();

    const passingBus = createTestEvent<Events>();
    const passingOrder: string[] = [];
    const passingHandler = vi.fn(() => {
      passingOrder.push("listener");
    });

    passingBus.use(async (_ctx, next) => {
      passingOrder.push("middleware-1");
      await next();
    });
    passingBus.use(async (_ctx, next) => {
      passingOrder.push("middleware-2");
      await next();
    });
    passingBus.on("user.created", passingHandler);
    await passingBus.emit("user.created", { id: "2", email: "b@c.com" });
    expect(passingOrder).toEqual(["middleware-1", "middleware-2", "listener"]);
  });

  it("allows middleware to enrich metadata before listeners receive frozen context", async () => {
    const bus = createTestEvent<Events>();

    bus.use(async (ctx, next) => {
      ctx.metadata.traceId = "trace-1";
      await next();
    });

    const handler = vi.fn();
    bus.on("user.created", handler);
    await bus.emit(
      "user.created",
      { id: "1", email: "a@b.com" },
      { source: "api" }
    );

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { source: "api", traceId: "trace-1" },
      })
    );

    const ctx = handler.mock.calls[0]?.[0];
    expect(Object.isFrozen(ctx)).toBe(true);
    expect(Object.isFrozen(ctx.metadata)).toBe(true);
  });

  it("supports once listeners and off()", async () => {
    const bus = createTestEvent<Events>();
    const handler = vi.fn();

    bus.once("user.created", handler);
    await bus.emit("user.created", { id: "1", email: "a@b.com" });
    await bus.emit("user.created", { id: "2", email: "b@c.com" });
    expect(handler).toHaveBeenCalledTimes(1);

    const repeatable = vi.fn();
    const unsubscribe = bus.on("user.deleted", repeatable);
    bus.off("user.deleted", repeatable);
    unsubscribe();
    await bus.emit("user.deleted", { id: "1" });
    expect(repeatable).not.toHaveBeenCalled();
  });

  it("namespaces events under a prefix", async () => {
    const bus = createTestEvent<Events>();
    const auth = bus.namespace("auth");
    const handler = vi.fn();

    auth.on("login", handler);
    await auth.emit("login", { userId: "1" });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ name: "auth.login", payload: { userId: "1" } })
    );
  });

  it("preserves listener error stacks via EventListenerError", async () => {
    const bus = createTestEvent<Events>({ onListenerError: "continue" });
    const onError = vi.fn();
    bus.onError(onError);

    bus.on("user.created", () => {
      throw new Error("listener boom");
    });

    await bus.emit("user.created", { id: "1", email: "a@b.com" });

    expect(onError).toHaveBeenCalledWith(
      expect.any(EventListenerError),
      expect.any(Object)
    );
    const wrapped = onError.mock.calls[0]?.[0];
    expect(wrapped).toBeInstanceOf(EventListenerError);
    expect((wrapped as EventListenerError).cause).toBeInstanceOf(Error);
  });

  it("uses sequential strategy stop mode", async () => {
    const bus = createTestEvent<Events>({
      onListenerError: "stop",
      strategy: sequentialStrategy,
    });
    const second = vi.fn();
    const third = vi.fn();

    bus.on("user.created", () => {
      throw new Error("stop here");
    });
    bus.on("user.created", second);
    bus.on("user.created", third);

    await bus.emit("user.created", { id: "1", email: "a@b.com" });

    expect(second).not.toHaveBeenCalled();
    expect(third).not.toHaveBeenCalled();
  });

  it("validates nested grouped schema under dotted event names", async () => {
    const bus = createTestEvent({
      schema: {
        notification: {
          alert: createMockSchema((value) => {
            if (
              typeof value === "object" &&
              value !== null &&
              "title" in value &&
              "body" in value
            ) {
              return {
                value: value as { body: string; title: string },
              };
            }
            return { issues: [{ message: "invalid alert payload" }] };
          }),
        },
      },
    });
    const handler = vi.fn();
    bus.on("notification.alert", handler);
    await bus.emit("notification.alert", {
      title: "Hello",
      body: "World",
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "notification.alert",
        payload: { title: "Hello", body: "World" },
      })
    );
  });

  it("sets channels metadata on channel().emit for middleware and listeners", async () => {
    const bus = createTestEvent<Events>();
    const middlewareHandler = vi.fn();
    const listener = vi.fn();

    bus.use(async (ctx, next) => {
      middlewareHandler(ctx.metadata[CHANNELS_METADATA_KEY]);
      await next();
    });
    bus.on("user.created", listener);

    await bus.channel("tenant:123", "region:us").emit("user.created", {
      id: "1",
      email: "a@b.com",
    });

    expect(middlewareHandler).toHaveBeenCalledWith(["tenant:123", "region:us"]);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          [CHANNELS_METADATA_KEY]: ["tenant:123", "region:us"],
        }),
      })
    );
  });

  it("leaves channels metadata undefined on a plain emit", async () => {
    const bus = createTestEvent<Events>();
    const listener = vi.fn();

    bus.on("user.created", listener);
    await bus.emit("user.created", { id: "1", email: "a@b.com" });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.not.objectContaining({
          [CHANNELS_METADATA_KEY]: expect.anything(),
        }),
      })
    );
    expect(
      listener.mock.calls[0]?.[0]?.metadata[CHANNELS_METADATA_KEY]
    ).toBeUndefined();
  });

  it("sets channels metadata on channel().dispatch", async () => {
    const bus = createTestEvent<Events>();
    const listener = vi.fn();

    bus.on("user.created", listener);
    bus.channel("notifications").dispatch("user.created", {
      id: "1",
      email: "a@b.com",
    });

    await vi.waitFor(() => {
      expect(listener).toHaveBeenCalled();
    });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          [CHANNELS_METADATA_KEY]: ["notifications"],
        }),
      })
    );
  });

  it("overwrites channels metadata on channel().emit", async () => {
    const bus = createTestEvent<Events>();
    const listener = vi.fn();

    bus.on("user.created", listener);
    await bus
      .channel("tenant:456")
      .emit(
        "user.created",
        { id: "1", email: "a@b.com" },
        { [CHANNELS_METADATA_KEY]: ["tenant:123"], traceId: "abc" }
      );

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          [CHANNELS_METADATA_KEY]: ["tenant:456"],
          traceId: "abc",
        }),
      })
    );
  });

  it("preserves namespace resolution on channel().emit", async () => {
    const bus = createTestEvent<Events>();
    const handler = vi.fn();

    bus.on("auth.login", handler);
    await bus.namespace("auth").channel("tenant:123").emit("login", {
      userId: "1",
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "auth.login",
        metadata: expect.objectContaining({
          [CHANNELS_METADATA_KEY]: ["tenant:123"],
        }),
      })
    );
  });

  it("channel().subscribe only invokes handlers for matching channel metadata", async () => {
    const bus = createTestEvent<Events>();
    const handler = vi.fn();
    const channel = bus.channel("room-123");

    await channel.subscribe("user.created", handler);

    await bus.emit("user.created", {
      id: "1",
      email: "a@b.com",
    });
    expect(handler).not.toHaveBeenCalled();

    await channel.emit("user.created", {
      id: "2",
      email: "c@d.com",
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "user.created",
        channel: "room-123",
      })
    );
  });

  it("channel().subscribe accepts multiple event names", async () => {
    const bus = createTestEvent<Events>();
    const handler = vi.fn();
    const channel = bus.channel("room-123");

    await channel.subscribe({
      events: ["user.created", "user.deleted"] as const,
      onData: handler,
    });

    await channel.emit("user.created", { id: "1", email: "a@b.com" });
    await channel.emit("user.deleted", { id: "2" });

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("channel().subscribe options object enriches handler context", async () => {
    const bus = createTestEvent<Events>();
    const onData = vi.fn();
    const channel = bus.channel("room-123");

    await channel.subscribe({
      events: ["user.created"] as const,
      onData,
    });

    await channel.emit("user.created", { id: "1", email: "a@b.com" });

    expect(onData).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "user.created",
        channel: "room-123",
        payload: { id: "1", email: "a@b.com" },
      })
    );
  });

  it("channel().subscribe ignores user-supplied channels at runtime", async () => {
    const bus = createTestEvent<Events>();
    const onData = vi.fn();
    const channel = bus.channel("room-123");

    await channel.subscribe({
      events: ["user.created"] as const,
      onData,
      // @ts-expect-error — channels is not part of the public API
      channels: ["other-room"],
    });

    await channel.emit("user.created", { id: "1", email: "a@b.com" });

    expect(onData).toHaveBeenCalledTimes(1);
    expect(onData).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "user.created",
        channel: "room-123",
      })
    );
  });

  it("bus.subscribe options object enriches handler context", async () => {
    const bus = createTestEvent<Events>();
    const onData = vi.fn();

    await bus.subscribe({
      events: ["user.created"] as const,
      onData,
    });

    await bus.emit("user.created", { id: "1", email: "a@b.com" });

    expect(onData).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "user.created",
        channel: undefined,
        payload: { id: "1", email: "a@b.com" },
      })
    );
  });

  it("bus.subscribe without channels ignores channel-scoped emits", async () => {
    const bus = createTestEvent<Events>();
    const onData = vi.fn();

    await bus.subscribe({
      events: ["user.created"] as const,
      onData,
    });

    await bus.channel("room-123").emit("user.created", {
      id: "1",
      email: "a@b.com",
    });

    expect(onData).not.toHaveBeenCalled();
  });

  it("bus.subscribe with channels ignores unscoped emits", async () => {
    const bus = createTestEvent<Events>();
    const onData = vi.fn();

    await bus.subscribe({
      channels: ["room-123"],
      events: ["user.created"] as const,
      onData,
    });

    await bus.emit("user.created", { id: "1", email: "a@b.com" });
    expect(onData).not.toHaveBeenCalled();

    await bus.channel("room-123").emit("user.created", {
      id: "2",
      email: "c@d.com",
    });

    expect(onData).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "user.created",
        channel: "room-123",
      })
    );
  });

  it("channel().subscribe ignores channel-scoped emits on other channels", async () => {
    const bus = createTestEvent<Events>();
    const onData = vi.fn();
    const channel = bus.channel("room-123");

    await channel.subscribe({
      events: ["user.created"] as const,
      onData,
    });

    await bus.channel("room-456").emit("user.created", {
      id: "1",
      email: "a@b.com",
    });
    expect(onData).not.toHaveBeenCalled();

    await channel.emit("user.created", { id: "2", email: "c@d.com" });
    expect(onData).toHaveBeenCalledTimes(1);
  });

  describe("lifecycle hooks", () => {
    it("fires onPipelineStart and onPipelineEnd in order on successful emit", async () => {
      const order: string[] = [];
      const bus = createTestEvent<Events>({
        hooks: {
          onPipelineStart: (ctx) => {
            order.push(`start:${ctx.name}`);
          },
          onPipelineEnd: (ctx) => {
            order.push(`end:${ctx.name}`);
          },
        },
      });
      const handler = vi.fn(() => {
        order.push("listener");
      });

      bus.on("user.created", handler);
      await bus.emit("user.created", { id: "1", email: "a@b.com" });

      expect(order).toEqual([
        "start:user.created",
        "listener",
        "end:user.created",
      ]);
    });

    it("skips pipeline hooks on validation failure and routes to hooks.onValidationError", async () => {
      const onPipelineStart = vi.fn();
      const onPipelineEnd = vi.fn();
      const onValidationError = vi.fn();
      const onError = vi.fn();
      const bus = createTestEvent({
        schema: {
          "user.created": createMockSchema(() => ({
            issues: [{ message: "invalid" }],
          })),
        },
        hooks: {
          onPipelineStart,
          onPipelineEnd,
          onValidationError,
          onError,
        },
      });

      await expect(
        bus.emit("user.created", { id: "1", email: "bad" })
      ).rejects.toBeInstanceOf(EventValidationError);

      expect(onPipelineStart).not.toHaveBeenCalled();
      expect(onPipelineEnd).not.toHaveBeenCalled();
      expect(onValidationError).toHaveBeenCalledWith(
        expect.any(EventValidationError),
        expect.objectContaining({ name: "user.created" })
      );
      expect(onError).not.toHaveBeenCalled();
    });

    it("fires onPipelineEnd after listener errors routed to hooks.onError", async () => {
      const onPipelineStart = vi.fn();
      const onPipelineEnd = vi.fn();
      const onError = vi.fn();
      const bus = createTestEvent<Events>({
        hooks: {
          onPipelineStart,
          onPipelineEnd,
          onError,
        },
      });

      bus.on("user.created", () => {
        throw new Error("listener boom");
      });

      await bus.emit("user.created", { id: "1", email: "a@b.com" });

      expect(onPipelineStart).toHaveBeenCalledTimes(1);
      expect(onPipelineEnd).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        expect.any(EventListenerError),
        expect.objectContaining({ name: "user.created" })
      );
    });

    it("swallows hook throws without breaking emit", async () => {
      const bus = createTestEvent<Events>({
        hooks: {
          onPipelineStart: () => {
            throw new Error("hook boom");
          },
          onPipelineEnd: () => {
            throw new Error("hook boom");
          },
        },
      });
      const handler = vi.fn();

      bus.on("user.created", handler);
      await expect(
        bus.emit("user.created", { id: "1", email: "a@b.com" })
      ).resolves.toBeUndefined();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("fires root hooks for namespace emits", async () => {
      const onPipelineStart = vi.fn();
      const onPipelineEnd = vi.fn();
      const bus = createTestEvent<Events>({
        hooks: {
          onPipelineStart,
          onPipelineEnd,
        },
      });
      const auth = bus.namespace("auth");
      const handler = vi.fn();

      auth.on("login", handler);
      await auth.emit("login", { userId: "1" });

      expect(onPipelineStart).toHaveBeenCalledWith(
        expect.objectContaining({ name: "auth.login" })
      );
      expect(onPipelineEnd).toHaveBeenCalledWith(
        expect.objectContaining({ name: "auth.login" })
      );
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("fires onPipelineFinally after success and on middleware throw", async () => {
      const order: string[] = [];
      const passingBus = createTestEvent<Events>({
        hooks: {
          onPipelineStart: (ctx) => {
            order.push(`start:${ctx.name}`);
          },
          onPipelineEnd: (ctx) => {
            order.push(`end:${ctx.name}`);
          },
          onPipelineFinally: (ctx) => {
            order.push(`finally:${ctx.name}`);
          },
        },
      });

      passingBus.on("user.created", vi.fn());
      await passingBus.emit("user.created", { id: "1", email: "a@b.com" });
      expect(order).toEqual([
        "start:user.created",
        "end:user.created",
        "finally:user.created",
      ]);

      order.length = 0;
      const failingBus = createTestEvent<Events>({
        hooks: {
          onPipelineStart: (ctx) => {
            order.push(`start:${ctx.name}`);
          },
          onPipelineEnd: (ctx) => {
            order.push(`end:${ctx.name}`);
          },
          onPipelineFinally: (ctx) => {
            order.push(`finally:${ctx.name}`);
          },
        },
      });

      failingBus.use(() => {
        throw new Error("middleware boom");
      });
      failingBus.on("user.created", vi.fn());

      await expect(
        failingBus.emit("user.created", { id: "1", email: "a@b.com" })
      ).rejects.toThrow("middleware boom");
      expect(order).toEqual(["start:user.created", "finally:user.created"]);
    });

    it("skips onPipelineFinally when validation fails", async () => {
      const onPipelineFinally = vi.fn();
      const bus = createTestEvent({
        schema: {
          "user.created": createMockSchema(() => ({
            issues: [{ message: "invalid" }],
          })),
        },
        hooks: {
          onValidationError: vi.fn(),
          onPipelineFinally,
        },
      });

      await expect(
        bus.emit("user.created", { id: "1", email: "bad" })
      ).rejects.toBeInstanceOf(EventValidationError);

      expect(onPipelineFinally).not.toHaveBeenCalled();
    });
  });

  describe("error normalization", () => {
    it("routes Error instances to onError handlers", async () => {
      const onError = vi.fn((error: Error) => {
        expect(error).toBeInstanceOf(Error);
      });
      const bus = createTestEvent<Events>({ hooks: { onError } });

      bus.on("user.created", () => {
        throw new Error("listener boom");
      });

      await bus.emit("user.created", { id: "1", email: "a@b.com" });

      expect(onError).toHaveBeenCalledWith(
        expect.any(EventListenerError),
        expect.objectContaining({ name: "user.created" })
      );
    });

    it("rejects emit with Error when validation fails and no handler exists", async () => {
      const bus = createTestEvent({
        schema: {
          "user.created": createMockSchema(() => ({
            issues: [{ message: "invalid" }],
          })),
        },
      });

      await expect(
        bus.emit("user.created", { id: "1", email: "bad" })
      ).rejects.toBeInstanceOf(Error);
    });
  });

  describe("verbose logging", () => {
    it("logs emit, validation, listener, and hook diagnostics when verbose is true", async () => {
      const infoSpy = vi
        .spyOn(console, "info")
        .mockImplementation(() => undefined);
      const warnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);
      const errorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      try {
        const bus = createTestEvent({
          verbose: true,
          schema: {
            "user.created": createMockSchema((value) => {
              const payload = value as { email?: string };
              if (payload.email === "bad") {
                return { issues: [{ message: "invalid" }] };
              }
              return { value };
            }),
          },
          hooks: {
            onPipelineStart: () => {
              throw new Error("hook boom");
            },
          },
        });

        bus.on("user.created", () => {
          throw new Error("listener boom");
        });

        await bus.emit("user.created", { id: "1", email: "a@b.com" });

        expect(
          infoSpy.mock.calls.some(
            (call) =>
              typeof call[0] === "string" &&
              call[0].includes("[events] Emit: user.created")
          )
        ).toBe(true);
        expect(
          warnSpy.mock.calls.some(
            (call) =>
              typeof call[0] === "string" &&
              call[0].includes("[events] Listener error: user.created")
          )
        ).toBe(true);
        expect(
          errorSpy.mock.calls.some(
            (call) =>
              typeof call[0] === "string" &&
              call[0].includes("[events] Hook threw")
          )
        ).toBe(true);

        await expect(
          bus.emit("user.created", { id: "1", email: "bad" })
        ).rejects.toBeInstanceOf(Error);

        expect(
          warnSpy.mock.calls.some(
            (call) =>
              typeof call[0] === "string" &&
              call[0].includes("[events] Validation failed: user.created")
          )
        ).toBe(true);
      } finally {
        infoSpy.mockRestore();
        warnSpy.mockRestore();
        errorSpy.mockRestore();
      }
    });

    it("logs dispatch failures when verbose is true", async () => {
      const infoSpy = vi
        .spyOn(console, "info")
        .mockImplementation(() => undefined);
      const errorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      try {
        const bus = createTestEvent({
          verbose: true,
          stream: {
            append: () => Promise.reject(new Error("stream boom")),
            publish: () => Promise.resolve(),
            readAfter: () => Promise.resolve([]),
            subscribe: () => () => undefined,
            close: () => Promise.resolve(),
          },
        });

        bus.channel("demo").dispatch("user.created", {
          id: "1",
          email: "a@b.com",
        });

        await vi.waitFor(() => {
          expect(
            errorSpy.mock.calls.some(
              (call) =>
                typeof call[0] === "string" &&
                call[0].includes("[events] Dispatch failed: user.created")
            )
          ).toBe(true);
        });
      } finally {
        infoSpy.mockRestore();
        errorSpy.mockRestore();
      }
    });

    it("does not log when verbose is omitted", async () => {
      const infoSpy = vi
        .spyOn(console, "info")
        .mockImplementation(() => undefined);
      const warnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);
      const errorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      try {
        const bus = createTestEvent<Events>();
        bus.on("user.created", () => {
          throw new Error("listener boom");
        });

        await bus.emit("user.created", { id: "1", email: "a@b.com" });

        expect(infoSpy).not.toHaveBeenCalled();
        expect(warnSpy).not.toHaveBeenCalled();
        expect(errorSpy).not.toHaveBeenCalled();
      } finally {
        infoSpy.mockRestore();
        warnSpy.mockRestore();
        errorSpy.mockRestore();
      }
    });
  });
});
