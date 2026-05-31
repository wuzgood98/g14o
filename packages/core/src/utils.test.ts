import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetcher,
  formatCurrency,
  formatGhsFromPesewas,
  formatStringList,
  isArray,
  isObject,
  parseNumber,
  stringifyParams,
} from "./utils";

const CURRENCY_PATTERN = /GH|₵|1,?000/;
const GHANA_AMOUNT_PATTERN = /1,?299/;

describe("parseNumber", () => {
  it("parses strings with radix", () => {
    expect(parseNumber("ff", { radix: 16 })).toBe(255);
  });

  it("returns numbers unchanged", () => {
    expect(parseNumber(42)).toBe(42);
  });
});

describe("isObject", () => {
  it("returns true for plain objects", () => {
    expect(isObject({ a: 1 })).toBe(true);
  });

  it("returns false for null, arrays, and primitives", () => {
    expect(isObject(null)).toBe(false);
    expect(isObject([])).toBe(false);
    expect(isObject("x")).toBe(false);
  });
});

describe("isArray", () => {
  it("returns true for arrays only", () => {
    expect(isArray([1])).toBe(true);
    expect(isArray({})).toBe(false);
  });
});

describe("formatCurrency", () => {
  it("formats GHS with en-GH locale", () => {
    expect(formatCurrency(1000)).toMatch(CURRENCY_PATTERN);
  });
});

describe("formatGhsFromPesewas", () => {
  it("converts pesewas to GHS", () => {
    expect(formatGhsFromPesewas(129_900)).toMatch(GHANA_AMOUNT_PATTERN);
  });
});

describe("stringifyParams", () => {
  it("sorts keys and joins array values", () => {
    expect(stringifyParams({ search: "john", page: 1, tags: ["a", "b"] })).toBe(
      "page=1&search=john&tags=a%2Cb"
    );
  });

  it("skips empty, null, and undefined values", () => {
    expect(stringifyParams({ a: "", b: null, c: undefined, d: 1 })).toBe("d=1");
  });
});

describe("formatStringList", () => {
  it("formats a conjunction list", () => {
    expect(formatStringList(["apples", "oranges", "pears"])).toBe(
      "apples, oranges, and pears"
    );
  });
});

describe("fetcher", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves parsed JSON on success with default throw", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 1 }),
      })
    );

    await expect(fetcher<{ id: number }>("/api/user")).resolves.toEqual({
      id: 1,
    });
  });

  it("rejects with Error on HTTP error with default throw", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: "Server error" }),
      })
    );

    await expect(fetcher("/api/user")).rejects.toThrow("Server error");
  });

  it("returns ok result on success when throw is false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ id: 1 }]),
      })
    );

    await expect(
      fetcher<{ id: number }[]>("/api/users", { throw: false })
    ).resolves.toEqual({ ok: true, data: [{ id: 1 }] });
  });

  it("returns error result on HTTP error when throw is false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: "Not found" }),
      })
    );

    const result = await fetcher("/api/user", { throw: false });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toBe("Not found");
      expect(result.status).toBe(404);
    }
  });

  it("serializes searchParams into the request URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetcher("/api/users", { searchParams: { page: 1 } });

    expect(fetchMock).toHaveBeenCalledWith("/api/users?page=1");
  });

  it("uses stringifiedParams as-is in the request URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetcher("/api/users", { stringifiedParams: "page=2&limit=10" });

    expect(fetchMock).toHaveBeenCalledWith("/api/users?page=2&limit=10");
  });

  it("throws TypeError when both param options are provided", async () => {
    await expect(
      fetcher("/api/users", {
        stringifiedParams: "page=1",
        searchParams: { page: 1 },
      } as unknown as Parameters<typeof fetcher>[1])
    ).rejects.toThrow(
      "fetcher: pass either stringifiedParams or searchParams, not both"
    );
  });

  it("returns error result on network failure when throw is false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error"))
    );

    const result = await fetcher("/api/users", { throw: false });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("Network error");
      expect(result.status).toBe(0);
    }
  });
});
