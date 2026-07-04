import type { Request, Response } from "express";
import { userMiddleware } from "../lib/ratelimit";

export const userActionMiddleware = userMiddleware(
  async (req) => req.get("x-user-id") ?? null,
  { tier: "auth" }
);

export function userActionHandler(_req: Request, res: Response): void {
  res.json({ ok: true, message: "User action completed" });
}
