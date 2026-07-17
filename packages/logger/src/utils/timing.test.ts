import { afterEach, describe, expect, it, vi } from "vitest";
import { monotonicNow } from "./timing";

describe("monotonicNow", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses performance.now when available", () => {
    const performanceNow = vi.fn().mockReturnValue(123.456);
    vi.stubGlobal("performance", { now: performanceNow });

    expect(monotonicNow()).toBe(123.456);
    expect(performanceNow).toHaveBeenCalledOnce();
  });

  it("falls back to Date.now when performance is unavailable", () => {
    vi.stubGlobal("performance", undefined);
    const dateNow = vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);

    expect(monotonicNow()).toBe(1_700_000_000_000);
    expect(dateNow).toHaveBeenCalledOnce();
  });
});
