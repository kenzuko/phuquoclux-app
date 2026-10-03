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

      return Response.json({
        ok: true,
        database: identity.rows[0]?.database_name ?? null,
        user: identity.rows[0]?.user_name ?? null,
        bookingsTable: table.rows[0]?.bookings_table ?? null,
        bookingCount: count.rows[0]?.booking_count ?? null,
        migrationLedgerDenied,
        migrationLedgerErrorCode,
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
