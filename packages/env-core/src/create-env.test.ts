import { type } from "arktype";
import { pipe, string, url } from "valibot";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createEnv } from "./create-env";
import { InvalidEnvironmentVariablesError } from "./errors";

const RUNTIME_ENV_STRICT_MISSING = /runtimeEnvStrict is missing required keys/;
const CLIENT_PREFIX_REQUIRED = /must start with "NEXT_PUBLIC_"/;
const SERVER_CLIENT_OVERLAP = /cannot be defined in both server and client/;

const validServerRuntime = {
  DATABASE_URL: "https://example.com",
  OPEN_AI_API_KEY: "sk-test",
  NEXT_PUBLIC_API_URL: "https://api.example.com",
};

describe("createEnv with zod", () => {
  it("validates server and client on server", () => {
    const env = createEnv({
      clientPrefix: "NEXT_PUBLIC_",
      server: {
        DATABASE_URL: z.url(),
        OPEN_AI_API_KEY: z.string().min(1),
      },
      client: {
        NEXT_PUBLIC_API_URL: z.url(),
      },
      runtimeEnv: validServerRuntime,
      isServer: true,
    });

    expect(env.DATABASE_URL).toBe("https://example.com");
    expect(env.NEXT_PUBLIC_API_URL).toBe("https://api.example.com");
  });

  it("throws InvalidEnvironmentVariablesError for invalid server values", () => {
    expect(() =>
      createEnv({
        server: { DATABASE_URL: z.url() },
        runtimeEnv: { DATABASE_URL: "not-a-url" },
        isServer: true,
      })
    ).toThrow(InvalidEnvironmentVariablesError);
  });

  it("treats empty strings as undefined when enabled", () => {
    const env = createEnv({
      server: {
        PORT: z.coerce.number().default(3000),
      },
      runtimeEnv: { PORT: "" },
      emptyStringAsUndefined: true,
      isServer: true,
    });

    expect(env.PORT).toBe(3000);
  });

  it("uses runtimeEnvStrict mapping", () => {
    const env = createEnv({
      server: { DATABASE_URL: z.url() },
      runtimeEnvStrict: {
        DATABASE_URL: "https://example.com",
      },
      isServer: true,
    });

    expect(env.DATABASE_URL).toBe("https://example.com");
  });

  it("throws when runtimeEnvStrict is missing keys", () => {
    expect(() =>
      createEnv({
        server: { DATABASE_URL: z.url() },
        clientPrefix: "NEXT_PUBLIC_",
        client: { NEXT_PUBLIC_API_URL: z.url() },
        runtimeEnvStrict: {
          DATABASE_URL: "https://example.com",
        } as {
          DATABASE_URL: string;
          NEXT_PUBLIC_API_URL: string;
        },
        isServer: true,
      })
    ).toThrow(RUNTIME_ENV_STRICT_MISSING);
  });
});

describe("createEnv client guard", () => {
  it("throws when accessing server variables on the client", () => {
    const env = createEnv({
      server: { DATABASE_URL: z.url() },
      clientPrefix: "NEXT_PUBLIC_",
      client: { NEXT_PUBLIC_API_URL: z.url() },
      runtimeEnv: validServerRuntime,
      isServer: false,
    });

    expect(() => env.DATABASE_URL).toThrow(
      "Attempted to access server environment variable(s) on the client: DATABASE_URL"
    );
    expect(env.NEXT_PUBLIC_API_URL).toBe("https://api.example.com");
  });

  it("does not list server keys in Object.keys on the client", () => {
    const env = createEnv({
      server: { DATABASE_URL: z.url() },
      clientPrefix: "NEXT_PUBLIC_",
      client: { NEXT_PUBLIC_API_URL: z.url() },
      runtimeEnv: validServerRuntime,
      isServer: false,
    });

    expect(Object.keys(env)).toEqual(["NEXT_PUBLIC_API_URL"]);
  });

  it("calls onInvalidAccess before throwing", () => {
    const onInvalidAccess = vi.fn();
    const env = createEnv({
      server: { SECRET: z.string() },
      runtimeEnv: { SECRET: "hidden" },
      isServer: false,
      onInvalidAccess,
    });

    expect(() => env.SECRET).toThrow();
    expect(onInvalidAccess).toHaveBeenCalledWith("SECRET");
  });

  it("throws when accessing undeclared keys on the client", () => {
    const env = createEnv({
      server: { DATABASE_URL: z.url() },
      clientPrefix: "NEXT_PUBLIC_",
      client: { NEXT_PUBLIC_API_URL: z.url() },
      runtimeEnv: validServerRuntime,
      isServer: false,
    });

    expect(() => (env as Record<string, unknown>).NOT_DECLARED).toThrow(
      "Attempted to access server environment variable(s) on the client: NOT_DECLARED"
    );
  });

  it("does not throw for ignored interop properties on the client", () => {
    const env = createEnv({
      clientPrefix: "NEXT_PUBLIC_",
      client: { NEXT_PUBLIC_API_URL: z.url() },
      runtimeEnv: { NEXT_PUBLIC_API_URL: "https://api.example.com" },
      isServer: false,
    });

    expect(env.__esModule).toBeUndefined();
    expect(env.$$typeof).toBeUndefined();
  });

  it("allows symbol access on the client without throwing", () => {
    const env = createEnv({
      clientPrefix: "NEXT_PUBLIC_",
      client: { NEXT_PUBLIC_API_URL: z.url() },
      runtimeEnv: { NEXT_PUBLIC_API_URL: "https://api.example.com" },
      isServer: false,
    });

    expect(Reflect.get(env, Symbol.iterator)).toBeUndefined();
  });
});

describe("createEnv server proxy transparency", () => {
  it("reads server and client keys on the server", () => {
    const env = createEnv({
      server: { DATABASE_URL: z.url() },
      clientPrefix: "NEXT_PUBLIC_",
      client: { NEXT_PUBLIC_API_URL: z.url() },
      runtimeEnv: validServerRuntime,
      isServer: true,
    });

    expect(env.DATABASE_URL).toBe("https://example.com");
    expect(env.NEXT_PUBLIC_API_URL).toBe("https://api.example.com");
  });

  it("returns undefined for unknown keys on the server", () => {
    const env = createEnv({
      server: { DATABASE_URL: z.url() },
      runtimeEnv: { DATABASE_URL: "https://example.com" },
      isServer: true,
    });

    expect((env as Record<string, unknown>).UNKNOWN_KEY).toBeUndefined();
  });
});

describe("createEnv prefix and overlap rules", () => {
  it("rejects client keys without the configured prefix", () => {
    expect(() =>
      createEnv({
        clientPrefix: "NEXT_PUBLIC_",
        client: { API_URL: z.url() },
        runtimeEnv: { API_URL: "https://example.com" },
        isServer: true,
      } as never)
    ).toThrow(CLIENT_PREFIX_REQUIRED);
  });

  it("rejects duplicate keys in server and client", () => {
    expect(() =>
      createEnv({
        server: { SHARED: z.string() },
        client: { SHARED: z.string() },
        runtimeEnv: { SHARED: "x" },
        isServer: true,
      })
    ).toThrow(SERVER_CLIENT_OVERLAP);
  });
});

describe("createEnv with valibot", () => {
  it("validates with valibot schemas", () => {
    const env = createEnv({
      server: {
        DATABASE_URL: pipe(string(), url()),
      },
      runtimeEnv: { DATABASE_URL: "https://example.com" },
      isServer: true,
    });

    expect(env.DATABASE_URL).toBe("https://example.com");
  });
});

describe("createEnv with arktype", () => {
  it("validates with arktype schemas", () => {
    const env = createEnv({
      server: {
        DATABASE_URL: type("string.url"),
      },
      runtimeEnv: { DATABASE_URL: "https://example.com" },
      isServer: true,
    });

    expect(env.DATABASE_URL).toBe("https://example.com");
  });
});
