import { runAuthMigrations } from "@/lib/migrate";

export async function GET() {
  await runAuthMigrations();
  return Response.json({ ok: true, message: "Migrations complete" });
}
