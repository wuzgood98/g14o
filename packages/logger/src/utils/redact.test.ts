import { describe, expect, it } from "vitest";
import { shouldLog } from "./levels";
import { redactMeta } from "./redact";

describe("shouldLog", () => {
  it("filters below-threshold levels", () => {
    expect(shouldLog("info", "debug")).toBe(false);
    expect(shouldLog("info", "info")).toBe(true);
    expect(shouldLog("info", "warn")).toBe(true);
    expect(shouldLog("info", "error")).toBe(true);
  });

  it("returns false for silent threshold", () => {
    expect(shouldLog("silent", "error")).toBe(false);
  });
});

describe("redactMeta", () => {
  it("redacts matching keys case-insensitively", () => {
    const meta = { Password: "secret", user: "alice" };
    expect(redactMeta(meta, ["password"])).toEqual({
      Password: "[REDACTED]",
      user: "alice",
    });
  });

  it("redacts nested objects and arrays without mutating the original", () => {
    const meta = {
      user: "alice",
      credentials: {
        token: "abc",
        profile: { authorization: "Bearer x" },
      },
      sessions: [{ password: "p1" }, { ok: true }],
    };

    const redacted = redactMeta(meta, ["token", "password", "authorization"]);

    expect(redacted).toEqual({
      user: "alice",
      credentials: {
        token: "[REDACTED]",
        profile: { authorization: "[REDACTED]" },
      },
      sessions: [{ password: "[REDACTED]" }, { ok: true }],
    });
    expect(meta.credentials.token).toBe("abc");
    expect(meta.sessions[0]?.password).toBe("p1");
  });

  it("returns a shallow copy when no keys match", () => {
    const meta = { user: "alice" };
    const redacted = redactMeta(meta, ["password"]);
    expect(redacted).toEqual({ user: "alice" });
    expect(redacted).not.toBe(meta);
  });

  it("replaces cyclic references instead of overflowing", () => {
    const meta: Record<string, unknown> = {
      user: "alice",
      password: "secret",
    };
    meta.self = meta;

    expect(() => redactMeta(meta, ["password"])).not.toThrow();
    expect(redactMeta(meta, ["password"])).toEqual({
      user: "alice",
      password: "[REDACTED]",
      self: "[Circular]",
    });
  });

  it("fully clones shared non-cyclic references", () => {
    const shared = { token: "abc", id: 1 };
    const meta = { left: shared, right: shared };

    const redacted = redactMeta(meta, ["token"]);

    expect(redacted).toEqual({
      left: { token: "[REDACTED]", id: 1 },
      right: { token: "[REDACTED]", id: 1 },
    });
    expect(redacted.left).not.toBe(redacted.right);
  });
});
