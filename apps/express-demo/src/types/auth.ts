import type { Request } from "express";

export type AuthenticatedRequest = Request & {
  user?: { id: string };
};

export function getAuthenticatedUserId(req: Request): Promise<string | null> {
  return Promise.resolve((req as AuthenticatedRequest).user?.id ?? null);
}
