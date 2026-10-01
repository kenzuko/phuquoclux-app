import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const MIGRATION_NAME_PATTERN = /^\d{4}_[a-z0-9_]+\.sql$/;
const MIGRATION_LOCK_KEY = "phuquoclux-schema-migrations-v1";
const SYSTEM_DATABASES = new Set(["postgres", "template0", "template1"]);
const migrationsDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../db/migrations",
);

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

export function parsePostgresTarget(connectionString) {
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("MIGRATION_DATABASE_URL_INVALID");
  }

  if (
    (url.protocol !== "postgres:" && url.protocol !== "postgresql:") ||
    !url.hostname
  ) {
    throw new Error("MIGRATION_DATABASE_URL_INVALID");
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!database || database.includes("/")) {
    throw new Error("MIGRATION_DATABASE_NAME_INVALID");
  }

  return {
    database,
    host: url.hostname,
  };
}

export function loadMigrationFiles() {
  const names = readdirSync(migrationsDir)
    .filter((name) => MIGRATION_NAME_PATTERN.test(name))
    .sort();

  if (names.length === 0) {
    throw new Error("MIGRATIONS_NOT_FOUND");
  }

  return names.map((name) => {
    const path = resolve(migrationsDir, name);
    const sql = readFileSync(path, "utf8");
    if (!sql.trim()) {
      throw new Error(`MIGRATION_EMPTY:${name}`);
    }
    return {
      name,
      sql,
      checksum: sha256(sql),
    };
  });
}

async function assertConnectedDatabase(client, expectedDatabase) {
  const result = await client.query("select current_database() as database");
  const actual = result.rows[0]?.database;
  if (actual !== expectedDatabase) {
    throw new Error(
      `MIGRATION_DATABASE_MISMATCH:expected=${expectedDatabase}:actual=${String(actual)}`,
    );
  }
}

async function ledgerExists(client) {
  const result = await client.query(
    "select to_regclass('public.pql_schema_migrations') as ledger",
  );
  return Boolean(result.rows[0]?.ledger);
}

async function assertNoUntrackedPublicTables(client) {
  const result = await client.query(
    `select tablename
       from pg_catalog.pg_tables
      where schemaname = 'public'
        and tablename <> 'pql_schema_migrations'
      order by tablename asc`,
  );
  if (result.rows.length > 0) {
    throw new Error(
      `MIGRATION_UNTRACKED_SCHEMA_REFUSED:${result.rows
        .map((row) => row.tablename)
        .join(",")}`,
    );
  }
}

async function readLedger(client) {
  if (!(await ledgerExists(client))) return [];

  const result = await client.query(
    `select filename, checksum, applied_at
       from pql_schema_migrations
       order by filename asc`,
  );

  return result.rows.map((row) => ({
    filename: row.filename,
    checksum: row.checksum,
    appliedAt:
      row.applied_at instanceof Date
        ? row.applied_at.toISOString()
        : new Date(row.applied_at).toISOString(),
  }));
}

function reconcilePlan(files, ledger) {
  const filesByName = new Map(files.map((file) => [file.name, file]));
  const ledgerByName = new Map(ledger.map((row) => [row.filename, row]));

  for (const row of ledger) {
    const file = filesByName.get(row.filename);
    if (!file) {
      throw new Error(`MIGRATION_LEDGER_UNKNOWN_ENTRY:${row.filename}`);
    }
    if (file.checksum !== row.checksum) {
      throw new Error(`MIGRATION_CHECKSUM_MISMATCH:${row.filename}`);
    }
  }

  return files.map((file) => ({
    filename: file.name,
    checksum: file.checksum,
    status: ledgerByName.has(file.name) ? "applied" : "pending",
  }));
}

export async function inspectMigrationPlan(connectionString) {
  const target = parsePostgresTarget(connectionString);
  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    await assertConnectedDatabase(client, target.database);
    const files = loadMigrationFiles();
    const hasLedger = await ledgerExists(client);
    if (!hasLedger) {
      await assertNoUntrackedPublicTables(client);
    }
    const ledger = hasLedger ? await readLedger(client) : [];
    return {
      database: target.database,
      host: target.host,
      migrations: reconcilePlan(files, ledger),
    };
  } finally {
    await client.end();
  }
}

async function ensureLedger(client) {
  await client.query("BEGIN");
  try {
    await client.query(
      `create table if not exists pql_schema_migrations (
         filename text primary key,
         checksum text not null
           check (checksum ~ '^[0-9a-f]{64}$'),
         applied_at timestamptz not null default now()
       )`,
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export async function applyMigrations(connectionString, confirmation) {
  const target = parsePostgresTarget(connectionString);

  if (SYSTEM_DATABASES.has(target.database.toLowerCase())) {
    throw new Error(`MIGRATION_SYSTEM_DATABASE_REFUSED:${target.database}`);
  }

  const expectedConfirmation = `APPLY:${target.database}`;
  if (confirmation !== expectedConfirmation) {
    throw new Error(
      `MIGRATION_CONFIRMATION_REQUIRED:${expectedConfirmation}`,
    );
  }

  const client = new pg.Client({ connectionString });
  await client.connect();
  let lockHeld = false;

  try {
    await assertConnectedDatabase(client, target.database);
    await client.query(
      "select pg_advisory_lock(hashtext($1))",
      [MIGRATION_LOCK_KEY],
    );
    lockHeld = true;

    const hasLedger = await ledgerExists(client);
    if (!hasLedger) {
      await assertNoUntrackedPublicTables(client);
    }
    await ensureLedger(client);

    const files = loadMigrationFiles();
    const ledger = await readLedger(client);
    const plan = reconcilePlan(files, ledger);
    const pending = plan.filter((item) => item.status === "pending");

    for (const item of pending) {
      const file = files.find((entry) => entry.name === item.filename);
      if (!file) throw new Error("MIGRATION_INTERNAL_FILE_LOOKUP_FAILED");

      await client.query("BEGIN");
      try {
        await client.query(file.sql);
        await client.query(
          `insert into pql_schema_migrations
             (filename, checksum, applied_at)
           values ($1, $2, now())`,
          [file.name, file.checksum],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    const finalLedger = await readLedger(client);
    const finalPlan = reconcilePlan(files, finalLedger);

    return {
      database: target.database,
      host: target.host,
      applied: pending.map((item) => item.filename),
      migrations: finalPlan,
    };
  } finally {
    if (lockHeld) {
      try {
        await client.query(
          "select pg_advisory_unlock(hashtext($1))",
          [MIGRATION_LOCK_KEY],
        );
      } catch {
        // The connection close below also releases session advisory locks.
      }
    }
    await client.end();
  }
}
