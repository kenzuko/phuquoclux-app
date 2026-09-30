/**
 * Driver-neutral guest manage-booking capability contract.
 *
 * Offline/backend-only: no public route, cookie/session exchange, email/SMS
 * delivery, analytics, Worker database binding, or production activation.
 *
 * Security properties:
 * - raw tokens are 256 bits of cryptographically secure randomness;
 * - raw tokens are never persisted;
 * - PostgreSQL stores only a SHA-256 lowercase hex digest;
 * - redemption fails closed for malformed, unknown, expired or revoked tokens;
 * - a successful redemption touches last_used_at but does not rotate/revoke the
 *   capability. Session exchange/rotation belongs to a later public-access step.
 */
import type { BookingAccessGrant } from "../domain/booking-access";
import { isBookingAccessActive } from "../domain/booking-access";
import type {
  SqlTransaction,
  SqlTransactionManager,
} from "./postgres-booking-core.server";

export type IssuedManageBookingAccess = {
  /** Deliver out-of-band exactly as returned. Never persist or log it. */
  rawToken: string;
  expiresAt: string;
};

export type RedeemedManageBookingAccess = {
  grantId: string;
  bookingId: string;
  purpose: "manage_booking";
};

const RAW_TOKEN_BYTES = 32;
const RAW_TOKEN_PATTERN = /^[0-9a-f]{64}$/;
const HASH_PATTERN = /^[0-9a-f]{64}$/;

function hex(bytes: Uint8Array) {
  return [...bytes]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function generateManageBookingToken() {
  const bytes = new Uint8Array(RAW_TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return hex(bytes);
}

export async function hashManageBookingToken(rawToken: string) {
  // Do not trim or case-normalize a bearer capability. Any mutation must fail.
  if (!RAW_TOKEN_PATTERN.test(rawToken)) {
    return null;
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(rawToken),
  );
  const result = hex(new Uint8Array(digest));
  if (!HASH_PATTERN.test(result)) {
    throw new Error("BOOKING_ACCESS_HASH_INVALID");
  }
  return result;
}

function rowToGrant(row: {
  id: string;
  booking_id: string;
  purpose: string;
  token_hash: string;
  created_at: Date | string;
  expires_at: Date | string;
  revoked_at: Date | string | null;
  last_used_at: Date | string | null;
}): BookingAccessGrant {
  if (row.purpose !== "manage_booking" || !HASH_PATTERN.test(row.token_hash)) {
    throw new Error("BOOKING_ACCESS_RECORD_INVALID");
  }
  return {
    id: row.id,
    bookingId: row.booking_id,
    purpose: "manage_booking",
    tokenHash: row.token_hash,
    createdAt: new Date(row.created_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
    revokedAt: row.revoked_at
      ? new Date(row.revoked_at).toISOString()
      : undefined,
    lastUsedAt: row.last_used_at
      ? new Date(row.last_used_at).toISOString()
      : undefined,
  };
}

async function requireBooking(tx: SqlTransaction, bookingId: string) {
  const result = await tx.query<{ id: string }>(
    "select id from bookings where id = $1",
    [bookingId],
  );
  if (!result.rows[0]) {
    throw new Error("BOOKING_NOT_FOUND");
  }
}

/**
 * Mint one manage-booking capability for an already-persisted booking.
 *
 * The caller owns expiry policy. This layer only requires a real future
 * timestamp; it does not invent a production TTL.
 */
export async function issueManageBookingAccess(
  database: SqlTransactionManager,
  bookingId: string,
  expiresAt: string,
  now = new Date(),
): Promise<IssuedManageBookingAccess> {
  const expiry = new Date(expiresAt);
  if (
    !Number.isFinite(expiry.getTime()) ||
    expiry.getTime() <= now.getTime()
  ) {
    throw new Error("BOOKING_ACCESS_EXPIRY_INVALID");
  }

  const rawToken = generateManageBookingToken();
  const tokenHash = await hashManageBookingToken(rawToken);
  if (!tokenHash) {
    throw new Error("BOOKING_ACCESS_TOKEN_GENERATION_FAILED");
  }
  const grantId = crypto.randomUUID();

  await database.transaction(async (tx) => {
    await requireBooking(tx, bookingId);
    await tx.query(
      `insert into booking_access_tokens
        (id, booking_id, purpose, token_hash, created_at, expires_at)
       values ($1, $2, 'manage_booking', $3, $4, $5)`,
      [
        grantId,
        bookingId,
        tokenHash,
        now.toISOString(),
        expiry.toISOString(),
      ],
    );
  });

  return {
    rawToken,
    expiresAt: expiry.toISOString(),
  };
}

/**
 * Validate a raw capability and resolve only the internal booking identity.
 * No guest PII or booking payload is returned by this boundary.
 */
export async function redeemManageBookingAccess(
  database: SqlTransactionManager,
  rawToken: string,
  now = new Date(),
): Promise<RedeemedManageBookingAccess | null> {
  const tokenHash = await hashManageBookingToken(rawToken);
  if (!tokenHash) return null;

  return database.transaction(async (tx) => {
    const result = await tx.query<{
      id: string;
      booking_id: string;
      purpose: string;
      token_hash: string;
      created_at: Date | string;
      expires_at: Date | string;
      revoked_at: Date | string | null;
      last_used_at: Date | string | null;
    }>(
      `select id, booking_id, purpose, token_hash, created_at, expires_at,
              revoked_at, last_used_at
         from booking_access_tokens
        where token_hash = $1
          and purpose = 'manage_booking'
        for update`,
      [tokenHash],
    );
    const row = result.rows[0];
    if (!row) return null;

    const grant = rowToGrant(row);
    if (!isBookingAccessActive(grant, now)) return null;

    const touched = await tx.query<{ id: string }>(
      `update booking_access_tokens
          set last_used_at = $2
        where id = $1
          and revoked_at is null
          and expires_at > $2
        returning id`,
      [grant.id, now.toISOString()],
    );
    if (!touched.rows[0]) return null;

    return {
      grantId: grant.id,
      bookingId: grant.bookingId,
      purpose: grant.purpose,
    };
  });
}

export async function revokeManageBookingAccess(
  database: SqlTransactionManager,
  grantId: string,
  bookingId: string,
  now = new Date(),
) {
  return database.transaction(async (tx) => {
    const result = await tx.query<{ id: string }>(
      `update booking_access_tokens
          set revoked_at = coalesce(revoked_at, $3)
        where id = $1
          and booking_id = $2
          and purpose = 'manage_booking'
        returning id`,
      [grantId, bookingId, now.toISOString()],
    );
    return Boolean(result.rows[0]);
  });
}
