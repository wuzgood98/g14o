import type { Context as HonoContext } from "hono";

export interface Bindings {
  TOKEN: string;
}

export interface Variables {
  user: {
    id: string;
  };
}

export interface AppEnv {
  Bindings: Bindings;
  Variables: Variables;
}

export type Context = HonoContext<AppEnv>;
