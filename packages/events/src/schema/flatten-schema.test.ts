import { describe, expect, it } from "vitest";
import { createMockSchema } from "../test-utils/schema";
import { flattenSchema } from "./flatten-schema";

describe("flattenSchema", () => {
  it("passes through flat dotted keys unchanged", () => {
    const leaf = createMockSchema((value) => ({ value }));
    const flat = flattenSchema({
      "demo.ping": leaf,
      "auth.login": leaf,
    });

    expect(Object.keys(flat)).toEqual(["demo.ping", "auth.login"]);
    expect(flat["demo.ping"]).toBe(leaf);
  });

  it("flattens nested namespace groups to dotted keys", () => {
    const alert = createMockSchema((value) => ({ value }));
    const info = createMockSchema((value) => ({ value }));

    const flat = flattenSchema({
      notification: {
        alert,
        info,
      },
    });

    expect(Object.keys(flat)).toEqual([
      "notification.alert",
      "notification.info",
    ]);
    expect(flat["notification.alert"]).toBe(alert);
    expect(flat["notification.info"]).toBe(info);
  });

  it("supports mixed flat and nested keys", () => {
    const ping = createMockSchema((value) => ({ value }));
    const alert = createMockSchema((value) => ({ value }));

    const flat = flattenSchema({
      "demo.ping": ping,
      notification: {
        alert,
      },
    });

    expect(Object.keys(flat)).toEqual(["demo.ping", "notification.alert"]);
  });
});
