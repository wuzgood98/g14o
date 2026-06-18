import { runAuthMigrations } from "../lib/migrate.js";

await runAuthMigrations();
console.log("Paystack demo migrations complete.");
