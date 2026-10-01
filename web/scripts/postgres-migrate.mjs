#!/usr/bin/env node
import {
  applyMigrations,
  inspectMigrationPlan,
} from "./postgres-migrations.mjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Set DATABASE_URL. The value is never printed by this script.");
}

const args = new Set(process.argv.slice(2));
if (args.has("--plan") && args.has("--apply")) {
  throw new Error("Choose only one of --plan or --apply.");
}

const apply = args.has("--apply");
const result = apply
  ? await applyMigrations(
      connectionString,
      process.env.PQL_MIGRATION_CONFIRM,
    )
  : await inspectMigrationPlan(connectionString);

console.log(
  JSON.stringify(
    {
      mode: apply ? "apply" : "plan",
      database: result.database,
      host: result.host,
      applied: result.applied ?? [],
      migrations: result.migrations.map((item) => ({
        filename: item.filename,
        status: item.status,
        checksum: item.checksum,
      })),
    },
    null,
    2,
  ),
);
