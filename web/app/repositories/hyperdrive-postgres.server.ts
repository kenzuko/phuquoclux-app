/**
 * Cloudflare Hyperdrive -> PostgreSQL transaction adapter.
 *
 * Cloudflare documents node-postgres (pg) as the recommended JS driver for
 * Hyperdrive. This adapter keeps one pg Client pinned for the full transaction,
 * which is required by the booking repository contract.
 *
 * No Hyperdrive id or database credential belongs in source control. The
 * Worker receives only an optional binding whose connectionString is supplied
 * by Cloudflare at runtime.
 */
import { Client } from "pg";
import type {
  SqlResult,
  SqlTransaction,
  SqlTransactionManager,
} from "./postgres-booking-core.server";

export type HyperdriveBinding = {
  connectionString: string;
};

type PgClientLike = {
  connect(): Promise<void>;
  query<Row extends object = Record<string, unknown>>(
    sql: string,
    parameters?: readonly unknown[],
  ): Promise<{ rows: Row[] }>;
  end(): Promise<void>;
};

type PgClientFactory = () => PgClientLike;

function assertPostgresConnectionString(connectionString: string) {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("POSTGRES_CONNECTION_STRING_INVALID");
  }
  if (
    (url.protocol !== "postgres:" && url.protocol !== "postgresql:") ||
    !url.hostname
  ) {
    throw new Error("POSTGRES_CONNECTION_STRING_INVALID");
  }
}

/**
 * General pg-backed transaction manager. Exported so the exact transaction
 * semantics can be exercised by disposable PostgreSQL CI without Hyperdrive.
 */
export function createPostgresTransactionManager(
  connectionString: string,
  clientFactory?: PgClientFactory,
): SqlTransactionManager {
  assertPostgresConnectionString(connectionString);

  const createClient =
    clientFactory ??
    (() =>
      new Client({
        connectionString,
      }) as unknown as PgClientLike);

  return {
    async transaction<T>(
      work: (tx: SqlTransaction) => Promise<T>,
    ): Promise<T> {
      const client = createClient();
      await client.connect();

      let began = false;
      try {
        await client.query("BEGIN");
        began = true;

        const tx: SqlTransaction = {
          async query<Row extends object = Record<string, unknown>>(
            sql: string,
            parameters: readonly unknown[],
          ): Promise<SqlResult<Row>> {
            const result = await client.query<Row>(sql, parameters);
            return { rows: result.rows };
          },
        };

        const result = await work(tx);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        if (began) {
          try {
            await client.query("ROLLBACK");
          } catch {
            // Preserve the original transactional failure. Connection cleanup
            // still runs in finally.
          }
        }
        throw error;
      } finally {
        await client.end();
      }
    },
  };
}

/**
 * Hyperdrive exposes a PostgreSQL connection string. Creating the manager is
 * lazy: no network connection occurs until a repository starts a transaction.
 */
export function createHyperdrivePostgresTransactionManager(
  binding: HyperdriveBinding,
): SqlTransactionManager {
  if (
    !binding ||
    typeof binding.connectionString !== "string" ||
    !binding.connectionString
  ) {
    throw new Error("HYPERDRIVE_BINDING_INVALID");
  }
  return createPostgresTransactionManager(binding.connectionString);
}
