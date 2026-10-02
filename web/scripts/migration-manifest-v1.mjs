#!/usr/bin/env node
import { loadMigrationFiles } from "./postgres-migrations.mjs";

const manifest = loadMigrationFiles().map((migration) => ({
  filename: migration.name,
  sha256: migration.checksum,
}));

console.log("PQL_MIGRATION_MANIFEST_V1=" + JSON.stringify(manifest));
