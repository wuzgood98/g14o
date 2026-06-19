import { DatabaseSync } from "node:sqlite";
import { env } from "@/lib/env";

export const sqlite = new DatabaseSync(env.SQLITE_DATABASE_PATH);
