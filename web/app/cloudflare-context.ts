import { createContext } from "react-router";
import type { SqlTransactionManager } from "./repositories/postgres-booking-core.server";
import type { HyperdriveBinding } from "./repositories/hyperdrive-postgres.server";

export type PhuQuocLuxEnv = {
  MAP_STYLE_URL?: string;
  WEATHER_RUNTIME_BASE_URL?: string;
  COMMERCE_MODE?: "prototype" | "live";
  /**
   * Public manage-link exchange stays disabled unless every runtime dependency
   * is explicitly configured. Merely deploying code never enables it.
   */
  MANAGE_BOOKING_EXCHANGE_ENABLED?: "true" | "false";
  MANAGE_BOOKING_CANONICAL_ORIGIN?: string;
  MANAGE_BOOKING_SESSION_TTL_MINUTES?: string;
  /** Cloudflare runtime binding. No id/credential is stored in source. */
  HYPERDRIVE?: HyperdriveBinding;
};

export type WorkerExecutionContext = {
  waitUntil?: (promise: Promise<unknown>) => void;
  passThroughOnException?: () => void;
};

export const cloudflareRequestContext = createContext<{
  env: PhuQuocLuxEnv;
  ctx: WorkerExecutionContext;
  requestId: string;
  /**
   * Injected only by a future reviewed production database adapter.
   * Current Worker entrypoint deliberately leaves this undefined.
   */
  manageBookingDatabase?: SqlTransactionManager;
}>();
