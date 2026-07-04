import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../types";

/** Demo-only auth stub. Replace with verified session/JWT auth in production. */
export const demoAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const userId = c.req.header("x-user-id");
  if (userId) {
    c.set("user", { id: userId });
  }
  await next();
};
