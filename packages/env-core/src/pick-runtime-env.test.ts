import { describe, expect, it } from "vitest";
import { assertStrictRuntimeKeys, pickRuntimeValues } from "./pick-runtime-env";

const RUNTIME_ENV_STRICT_MISSING = /runtimeEnvStrict is missing required keys/;

describe("pickRuntimeValues", () => {
  it("ignores inherited properties", () => {
    const runtime = Object.create({ FOO: "inherited" }) as Record<
      string,
      string
    >;

    const values = pickRuntimeValues(["FOO"], runtime, false);

    expect(values.FOO).toBeUndefined();
  });

  it("reads own properties and applies emptyStringAsUndefined", () => {
    const runtime = Object.create({ FOO: "inherited" }) as Record<
      string,
      string
    >;
    runtime.FOO = "";

    const values = pickRuntimeValues(["FOO"], runtime, true);

    expect(values.FOO).toBeUndefined();
  });
});

describe("assertStrictRuntimeKeys", () => {
  it("treats inherited-only keys as missing", () => {
    const runtime = Object.create({ BAR: "inherited" }) as Record<
      string,
      string
    >;

    expect(() => assertStrictRuntimeKeys(["BAR"], runtime)).toThrow(
      RUNTIME_ENV_STRICT_MISSING
    );
  });

  it("passes when keys are own properties", () => {
    const runtime = { BAR: "value" };

    expect(() => assertStrictRuntimeKeys(["BAR"], runtime)).not.toThrow();
  });
});
