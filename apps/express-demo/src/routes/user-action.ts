import type { Request, Response } from "express";
import { userMiddleware } from "../lib/ratelimit";
import { getAuthenticatedUserId } from "../types/auth";

export const userActionMiddleware = userMiddleware(getAuthenticatedUserId, {
  tier: "auth",
});

export function userActionHandler(_req: Request, res: Response): void {
  res.json({ ok: true, message: "User action completed" });
}
