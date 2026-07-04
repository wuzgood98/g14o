import type { MiddlewareHandler } from "hono";
import { describe, expectTypeOf, it } from "vitest";
import { createRateLimit } from "./create-rate-limit-client";

interface TestBindings {
  UPSTASH_REDIS_REST_TOKEN: string;
  UPSTASH_REDIS_REST_URL: string;
}

interface TestVariables {
  user: {
    id: string;
  };
}

interface TestEnv {
  Bindings: TestBindings;
  Variables: TestVariables;
}

describe("Hono Env type inference", () => {
  const { withRateLimit, middleware, userMiddleware } =
    createRateLimit<TestEnv>({
      env: "test",
    });

  it("types Context Bindings and Variables in withRateLimit handler", () => {
    withRateLimit((c) => {
      expectTypeOf(c.get("user")).toMatchTypeOf<{ id: string } | undefined>();
      expectTypeOf(c.env.UPSTASH_REDIS_REST_URL).toEqualTypeOf<string>();
      return c.json({ ok: true });
    });
  });

  it("types bound client handlers for app-level assignment", () => {
    const handler: MiddlewareHandler<TestEnv> = withRateLimit((c) => {
      expectTypeOf(c.get("user")).toMatchTypeOf<{ id: string } | undefined>();
      expectTypeOf(c.env.UPSTASH_REDIS_REST_TOKEN).toEqualTypeOf<string>();
      return c.json({ ok: true });
    });

    expectTypeOf(handler).toEqualTypeOf<MiddlewareHandler<TestEnv>>();
  });

  it("types Context Bindings in middleware identifierFn", () => {
    middleware({
      tier: "moderate",
      identifierFn: (c) => {
        expectTypeOf(c.env.UPSTASH_REDIS_REST_URL).toEqualTypeOf<string>();
        return "custom-id";
      },
    });
  });

  it("types Context Variables in userMiddleware getUserId", () => {
    userMiddleware((c) => {
      expectTypeOf(c.get("user")).toMatchTypeOf<{ id: string } | undefined>();
      return Promise.resolve(c.get("user")?.id ?? null);
    });
  });
});
