import type { RequestHandler } from "express";
import type { AuthenticatedRequest } from "../types/auth";

/** Demo-only auth stub. Replace with verified session/JWT auth in production. */
export const demoAuth: RequestHandler = (req, _res, next) => {
  const authReq = req as AuthenticatedRequest;
  const userId = req.get("x-user-id");
  if (userId) {
    authReq.user = { id: userId };
  }
  next();
};
