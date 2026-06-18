import { getMigrations } from "better-auth/db/migration";
import { auth } from "@/lib/auth";

export async function runAuthMigrations(): Promise<void> {
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();
}
