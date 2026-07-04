import type { Request, Response } from "express";
import { middleware } from "../lib/ratelimit";

export const statusMiddleware = middleware({ tier: "lenient" });

export function statusHandler(_req: Request, res: Response): void {
  res.json({
    ok: true,
    limit: res.getHeader("X-RateLimit-Limit"),
    remaining: res.getHeader("X-RateLimit-Remaining"),
  });
}
