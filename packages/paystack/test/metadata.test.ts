import { describe, expect, it } from "vitest";
import { parseSafeMetadata } from "../src/metadata";

describe("parseSafeMetadata", () => {
  it("parses stored metadata without prototype pollution", () => {
    const parsed = parseSafeMetadata(
      JSON.stringify({
        userId: "user_1",
        __proto__: { polluted: true },
      })
    );

    expect(parsed).toEqual({ userId: "user_1" });
    expect(Object.prototype).not.toHaveProperty("polluted");
  });

  it("returns undefined for invalid metadata json", () => {
    expect(parseSafeMetadata("{invalid")).toBeUndefined();
    expect(parseSafeMetadata(null)).toBeUndefined();
  });
});
