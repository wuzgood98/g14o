import { describe, expect, it } from "vitest";
import { normalizePlanName } from "../src/utils";

describe("normalizePlanName", () => {
  it("normalizes plan names", () => {
    expect(normalizePlanName(" Pro ")).toBe("pro");
  });
});
