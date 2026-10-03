import { hashManageBookingToken } from "./postgres-booking-access.server";
import type {
  SqlTransaction,
  SqlTransactionManager,
} from "./postgres-booking-core.server";

export type IssuedManageBookingDeliveryAccess = {
  grantId: string;
  rawToken: string;
  expiresAt: string;
  reused: boolean;
};

const SECRET_HEX_PATTERN = /^[0-9a-f]{64}$/;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const DERIVATION_DOMAIN = "phuquoclux/manage-booking/delivery/v1";

function bytesFromHex(value: string) {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function hex(bytes: Uint8Array) {
  return [...bytes]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Import a 256-bit server secret used only to re-derive delivery capabilities.
 * The secret belongs in a Worker secret, never wrangler vars or source control.
 */
export async function importManageBookingDeliveryDerivationKey(secretHex: string) {
  if (!SECRET_HEX_PATTERN.test(secretHex)) {
    throw new Error("MANAGE_BOOKING_DELIVERY_KEY_INVALID");
  }
  return crypto.subtle.importKey(
    "raw",
    bytesFromHex(secretHex),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/**
 * Deterministically derive the 256-bit raw bearer capability from server-only
 * key material plus a random persisted grant id. PostgreSQL still stores only
 * SHA-256(rawToken), never the raw capability itself.
 */
export async function deriveManageBookingDeliveryToken(
  derivationKey: CryptoKey,
  grantId: string,
  bookingId: string,
) {
  const payload = new TextEncoder().encode(
    `${DERIVATION_DOMAIN}\n${grantId}\n${bookingId}`,
  );
  const signature = await crypto.subtle.sign("HMAC", derivationKey, payload);
  const rawToken = hex(new Uint8Array(signature));
  if (!HASH_PATTERN.test(rawToken)) {
    throw new Error("MANAGE_BOOKING_DELIVERY_TOKEN_INVALID");
  }
  return rawToken;
}

async function requireBooking(tx: SqlTransaction, bookingId: string) {
  const result = await tx.query<{ id: string }>(
    "select id from bookings where id = $1",
    [bookingId],
  );
  if (!result.rows[0]) throw new Error("BOOKING_NOT_FOUND");
}

/**
 * Return a stable manage-booking capability across delivery retries without
 * persisting the raw token. Existing random/manual grants are ignored because
 * only a grant whose stored digest matches this derivation scheme is reusable.
 *
 * This makes an outbox retry reproduce the same email payload, which is
 * required for provider idempotency keys to suppress duplicate sends safely.
 */
export async function issueOrReuseManageBookingDeliveryAccess(
  database: SqlTransactionManager,
  bookingId: string,
  expiresAt: string,
  derivationKey: CryptoKey,
  now = new Date(),
): Promise<IssuedManageBookingDeliveryAccess> {
  const expiry = new Date(expiresAt);
  if (
    !Number.isFinite(expiry.getTime()) ||
    expiry.getTime() <= now.getTime()
  ) {
    throw new Error("BOOKING_ACCESS_EXPIRY_INVALID");
  }

  return database.transaction(async (tx) => {
    await requireBooking(tx, bookingId);

    const existing = await tx.query<{
      id: string;
      token_hash: string;
      expires_at: Date | string;
    }>(
      `select id, token_hash, expires_at
         from booking_access_tokens
        where booking_id = $1
          and purpose = 'manage_booking'
          and revoked_at is null
          and expires_at > $2
        order by created_at desc
        for update`,
      [bookingId, now.toISOString()],
    );

    for (const row of existing.rows) {
      if (!HASH_PATTERN.test(row.token_hash)) continue;
      const candidate = await deriveManageBookingDeliveryToken(
        derivationKey,
        row.id,
        bookingId,
      );
      const candidateHash = await hashManageBookingToken(candidate);
      if (candidateHash === row.token_hash) {
        return {
          grantId: row.id,
          rawToken: candidate,
          expiresAt: new Date(row.expires_at).toISOString(),
          reused: true,
        };
      }
    }

    const grantId = crypto.randomUUID();
    const rawToken = await deriveManageBookingDeliveryToken(
      derivationKey,
      grantId,
      bookingId,
    );
    const tokenHash = await hashManageBookingToken(rawToken);
    if (!tokenHash) {
      throw new Error("BOOKING_ACCESS_TOKEN_GENERATION_FAILED");
    }

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

    return {
      grantId,
      rawToken,
      expiresAt: expiry.toISOString(),
      reused: false,
    };
  });
}
