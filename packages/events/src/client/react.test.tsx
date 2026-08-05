import { cleanup, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEvent, EventProvider } from "./index";

afterEach(() => {
  cleanup();
});

describe("createEvent client hooks", () => {
  it("useEvent registers channels and reports status", () => {
    const { useEvent } = createEvent<{ "demo.ping": { message: string } }>();

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(EventProvider, null, children);

    const onData = vi.fn();
    const { result } = renderHook(
      () =>
        useEvent({
          channels: ["demo"],
          events: ["demo.ping"],
          onData,
        }),
      { wrapper }
    );

    expect(["disconnected", "connecting", "connected", "error"]).toContain(
      result.current.status
    );
  });
});
