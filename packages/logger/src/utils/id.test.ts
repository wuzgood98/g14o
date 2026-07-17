import { afterEach, describe, expect, it, vi } from "vitest";
import { generateRequestId } from "./id";

describe("generateRequestId", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses crypto.randomUUID when available", () => {
    const randomUUID = vi
      .fn()
      .mockReturnValue("550e8400-e29b-41d4-a716-446655440000");
    vi.stubGlobal("crypto", { randomUUID });

    expect(generateRequestId()).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it("falls back to random bytes when randomUUID is unavailable", () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = index;
      }
      return bytes;
    });
    vi.stubGlobal("crypto", { getRandomValues });

    expect(generateRequestId()).toBe("000102030405060708090a0b");
    expect(getRandomValues).toHaveBeenCalledOnce();
  });

  it("falls back to timestamp and random when crypto is unavailable", () => {
    vi.stubGlobal("crypto", undefined);
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    vi.spyOn(Math, "random").mockReturnValue(0.123_456_789);

    expect(generateRequestId()).toBe("loyw3v284fzzzxjylrx");
  });
});
