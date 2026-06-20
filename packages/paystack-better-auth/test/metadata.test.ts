import { describe, expect, it } from "vitest";
import {
  checkoutMetadata,
  customerMetadata,
  subscriptionMetadata,
} from "../src/metadata";

describe("metadata guards", () => {
  it("strips unsafe keys from user metadata merges", () => {
    const merged = customerMetadata.set(
      { userId: "user_1" },
      {
        __proto__: { polluted: true },
        constructor: { polluted: true },
        prototype: { polluted: true },
        plan: "pro",
      }
    );

    expect(merged).toEqual({
      userId: "user_1",
      plan: "pro",
    });
    expect(Object.prototype).not.toHaveProperty("polluted");
  });

  it("gives internal fields priority over user metadata", () => {
    const merged = subscriptionMetadata.set(
      { userId: "user_1", referenceId: "ref_1" },
      { userId: "user_attacker", referenceId: "ref_attacker" }
    );

    expect(merged.userId).toBe("user_1");
    expect(merged.referenceId).toBe("ref_1");
  });

  it("merges checkout metadata safely", () => {
    const merged = checkoutMetadata.set(
      { userId: "user_1", referenceId: "ref_1" },
      { __proto__: { polluted: true }, source: "checkout" }
    );

    expect(merged).toEqual({
      userId: "user_1",
      referenceId: "ref_1",
      source: "checkout",
    });
  });

  it("extracts customer metadata fields", () => {
    expect(customerMetadata.get({ userId: "user_1" })).toEqual({
      userId: "user_1",
    });
    expect(customerMetadata.get({ userId: 123 })).toEqual({
      userId: undefined,
    });
  });

  it("stores and reads supersedeSubscriptionCode in subscription metadata", () => {
    const merged = subscriptionMetadata.set(
      {
        userId: "user_1",
        referenceId: "ref_1",
        supersedeSubscriptionCode: "SUB_old",
      },
      { planName: "pro" }
    );

    expect(merged.supersedeSubscriptionCode).toBe("SUB_old");
    expect(subscriptionMetadata.get(merged).supersedeSubscriptionCode).toBe(
      "SUB_old"
    );
  });
});
