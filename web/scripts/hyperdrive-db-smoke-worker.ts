import { Client } from "pg";

type Env = {
  HYPERDRIVE: {
    connectionString: string;
  };
};

export default {
  async fetch(_request: Request, env: Env): Promise<Response> {
    const client = new Client({ connectionString: env.HYPERDRIVE.connectionString });

    try {
      await client.connect();

      const identity = await client.query<{
        database_name: string;
        user_name: string;
      }>("select current_database() as database_name, current_user as user_name");

      const table = await client.query<{ bookings_table: string | null }>(
        "select to_regclass('public.bookings')::text as bookings_table",
      );

      const count = await client.query<{ booking_count: string }>(
        "select count(*)::text as booking_count from public.bookings",
      );

      let migrationLedgerDenied = false;
      let migrationLedgerErrorCode: string | null = null;

      try {
        await client.query("select count(*) from public.pql_schema_migrations");
      } catch (error) {
        const candidate = error as { code?: string; message?: string };
        migrationLedgerErrorCode = candidate.code ?? null;
        migrationLedgerDenied =
          candidate.code === "42501" ||
          /permission denied/i.test(candidate.message ?? "");
      }

      const smokeRequestId = crypto.randomUUID();
      let writeInserted = false;
      let writeVisibleInsideTransaction = false;

      await client.query("begin");
      try {
        const inserted = await client.query<{ request_id: string }>(
          `insert into public.idempotency_keys
            (request_id, scope, resource_type, resource_id, expires_at)
           values ($1::uuid, 'hyperdrive_smoke', 'smoke', 'rollback-only', now() + interval '5 minutes')
           returning request_id::text as request_id`,
          [smokeRequestId],
        );
        writeInserted = inserted.rows[0]?.request_id === smokeRequestId;

        const visible = await client.query<{ row_count: string }>(
          "select count(*)::text as row_count from public.idempotency_keys where request_id = $1::uuid",
          [smokeRequestId],
        );
        writeVisibleInsideTransaction = visible.rows[0]?.row_count === "1";
      } finally {
        await client.query("rollback");
      }

      const afterRollback = await client.query<{ row_count: string }>(
        "select count(*)::text as row_count from public.idempotency_keys where request_id = $1::uuid",
        [smokeRequestId],
      );
      const writeRolledBack = afterRollback.rows[0]?.row_count === "0";

      return Response.json({
        ok: true,
        database: identity.rows[0]?.database_name ?? null,
        user: identity.rows[0]?.user_name ?? null,
        bookingsTable: table.rows[0]?.bookings_table ?? null,
        bookingCount: count.rows[0]?.booking_count ?? null,
        migrationLedgerDenied,
        migrationLedgerErrorCode,
        writeInserted,
        writeVisibleInsideTransaction,
        writeRolledBack,
      });
    } catch (error) {
      const candidate = error as { code?: string; message?: string };
      return Response.json(
        {
          ok: false,
          errorCode: candidate.code ?? null,
          error: candidate.message ?? String(error),
        },
        { status: 500 },
      );
    } finally {
      await client.end().catch(() => undefined);
    }
  },
};
