import { describe, expect, it, vi } from "vitest";
import { EventValidationError } from "../errors/event-validation-error";
import { createTestEvent } from "../test-utils/create-test-event";
import { createMockSchema } from "../test-utils/schema";
import { createPipelineLog } from "./create-pipeline-log";

describe("createPipelineLog", () => {
  it("records middleware and error entries via hooks", async () => {
    const store = createPipelineLog();
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
            return { value: value as { email: string; id: string } };
          }
          return { issues: [{ message: "invalid email" }] };
        }),
      },
      hooks: store.hooks,
    });

    bus.on("user.created", vi.fn());
    await bus.emit("user.created", { id: "1", email: "a@b.com" });

    expect(store.getMiddlewareLog()).toEqual([
      "→ user.created",
      "← user.created",
    ]);
    expect(store.getErrorLog()).toEqual([]);

    await expect(
      bus.emit("user.created", { id: "1", email: "bad" })
    ).rejects.toBeInstanceOf(EventValidationError);

    expect(store.getErrorLog()).toHaveLength(1);
    expect(store.getErrorLog()[0]).toBeInstanceOf(EventValidationError);
  });

  it("notifies subscribers and clears logs", async () => {
    const store = createPipelineLog({ maxEntries: 2 });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const bus = createTestEvent<Record<string, unknown>>({
      hooks: store.hooks,
    });

    bus.on("demo.ping", vi.fn());
    await bus.emit("demo.ping", { message: "hello" });

    expect(listener).toHaveBeenCalled();
    expect(store.getMiddlewareLog()).toEqual(["→ demo.ping", "← demo.ping"]);

    store.clearLogs();
    expect(store.getMiddlewareLog()).toEqual([]);
    expect(store.getErrorLog()).toEqual([]);

    unsubscribe();
  });

  it("trims entries to maxEntries", async () => {
    const store = createPipelineLog({ maxEntries: 2 });
    const bus = createTestEvent<Record<string, unknown>>({
      hooks: store.hooks,
    });

    bus.on("demo.ping", vi.fn());
    await bus.emit("demo.ping", { message: "one" });
    await bus.emit("demo.ping", { message: "two" });

    expect(store.getMiddlewareLog()).toEqual(["→ demo.ping", "← demo.ping"]);
  });
});
