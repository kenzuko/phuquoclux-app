/**
 * Backend-only manage-booking session contract.
 *
 * A high-entropy delivery capability (email/SMS link later) is exchanged for a
 * distinct high-entropy session token. PostgreSQL stores only SHA-256 hashes of
 * both. No public route, Worker database binding, delivery provider, or live
 * checkout is enabled by this module.
 */
import { hashManageBookingToken } from "./postgres-booking-access.server";
import type { SqlTransactionManager } from "./postgres-booking-core.server";

export const MANAGE_BOOKING_SESSION_COOKIE = "__Host-pql_manage";

const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;
const HASH_PATTERN = /^[0-9a-f]{64}$/;

function hex(bytes: Uint8Array) {
  return [...bytes]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function generateManageBookingSessionToken() {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return hex(bytes);
}

export async function hashManageBookingSessionToken(rawToken: string) {
  if (!TOKEN_PATTERN.test(rawToken)) return null;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(rawToken),
  );
  const result = hex(new Uint8Array(digest));
  if (!HASH_PATTERN.test(result)) {
    throw new Error("BOOKING_SESSION_HASH_INVALID");
  }
  return result;
}

export type IssuedManageBookingSession = {
  rawSessionToken: string;
  bookingId: string;
  sessionId: string;
  expiresAt: string;
};

export type ResolvedManageBookingSession = {
  sessionId: string;
  bookingId: string;
  accessGrantId: string;
  expiresAt: string;
};

/**
 * Atomically validate an access capability and create a server-side session.
 *
 * Requested session expiry is capped to the access-grant expiry so a cookie can
 * never outlive the capability that authorized it. The access grant is not
 * consumed/revoked here; one-time-link policy remains a later delivery decision.
 */
export async function exchangeManageBookingAccessForSession(
  database: SqlTransactionManager,
  rawAccessToken: string,
  requestedExpiresAt: string,
  now = new Date(),
): Promise<IssuedManageBookingSession | null> {
  const accessHash = await hashManageBookingToken(rawAccessToken);
  if (!accessHash) return null;

  const requestedExpiry = new Date(requestedExpiresAt);
  if (
    !Number.isFinite(requestedExpiry.getTime()) ||
    requestedExpiry.getTime() <= now.getTime()
  ) {
    throw new Error("BOOKING_SESSION_EXPIRY_INVALID");
  }

  return database.transaction(async (tx) => {
    const grants = await tx.query<{
      id: string;
      booking_id: string;
      expires_at: Date | string;
      revoked_at: Date | string | null;
    }>(
      `select id, booking_id, expires_at, revoked_at
         from booking_access_tokens
        where token_hash = $1
          and purpose = 'manage_booking'
        for update`,
      [accessHash],
    );
    const grant = grants.rows[0];
    if (!grant) return null;

    const grantExpiry = new Date(grant.expires_at);
    if (
      grant.revoked_at ||
      !Number.isFinite(grantExpiry.getTime()) ||
      grantExpiry.getTime() <= now.getTime()
    ) {
      return null;
    }

    const actualExpiry =
      requestedExpiry.getTime() <= grantExpiry.getTime()
        ? requestedExpiry
        : grantExpiry;

    if (actualExpiry.getTime() <= now.getTime()) return null;

    const rawSessionToken = generateManageBookingSessionToken();
    const sessionHash = await hashManageBookingSessionToken(rawSessionToken);
    if (!sessionHash) {
      throw new Error("BOOKING_SESSION_TOKEN_GENERATION_FAILED");
    }
    const sessionId = crypto.randomUUID();

    await tx.query(
      `update booking_access_tokens
          set last_used_at = $2
        where id = $1
          and revoked_at is null
          and expires_at > $2`,
      [grant.id, now.toISOString()],
    );

    await tx.query(
      `insert into booking_access_sessions
        (id, booking_id, access_grant_id, session_hash, created_at, expires_at)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        sessionId,
        grant.booking_id,
        grant.id,
        sessionHash,
        now.toISOString(),
        actualExpiry.toISOString(),
      ],
    );

    return {
      rawSessionToken,
      bookingId: grant.booking_id,
      sessionId,
      expiresAt: actualExpiry.toISOString(),
    };
  });
}

/**
 * Resolve a cookie token to an internal booking identity only.
 *
 * Revoking or expiring the parent grant invalidates all child sessions without
 * requiring a second fan-out write.
 */
export async function resolveManageBookingSession(
  database: SqlTransactionManager,
  rawSessionToken: string,
  now = new Date(),
): Promise<ResolvedManageBookingSession | null> {
  const sessionHash = await hashManageBookingSessionToken(rawSessionToken);
  if (!sessionHash) return null;

  return database.transaction(async (tx) => {
    const sessions = await tx.query<{
      id: string;
      booking_id: string;
      access_grant_id: string;
      expires_at: Date | string;
    }>(
      `select s.id, s.booking_id, s.access_grant_id, s.expires_at
         from booking_access_sessions s
         join booking_access_tokens g
           on g.id = s.access_grant_id
          and g.booking_id = s.booking_id
        where s.session_hash = $1
          and s.revoked_at is null
          and s.expires_at > $2
          and g.purpose = 'manage_booking'
          and g.revoked_at is null
          and g.expires_at > $2
        for update of s`,
      [sessionHash, now.toISOString()],
    );
    const session = sessions.rows[0];
    if (!session) return null;

    const touched = await tx.query<{ id: string }>(
      `update booking_access_sessions
          set last_used_at = $2
        where id = $1
          and revoked_at is null
          and expires_at > $2
        returning id`,
      [session.id, now.toISOString()],
    );
    if (!touched.rows[0]) return null;

    return {
      sessionId: session.id,
      bookingId: session.booking_id,
      accessGrantId: session.access_grant_id,
      expiresAt: new Date(session.expires_at).toISOString(),
    };
  });
}

export async function revokeManageBookingSession(
  database: SqlTransactionManager,
  sessionId: string,
  bookingId: string,
  now = new Date(),
) {
  return database.transaction(async (tx) => {
    const result = await tx.query<{ id: string }>(
      `update booking_access_sessions
          set revoked_at = coalesce(revoked_at, $3)
        where id = $1
          and booking_id = $2
        returning id`,
      [sessionId, bookingId, now.toISOString()],
    );
    return Boolean(result.rows[0]);
  });
}

/**
 * Cookie helpers are pure and route-agnostic. A later exchange route can set
 * this header and immediately redirect away from /manage/<raw-capability>.
 */
export function serializeManageBookingSessionCookie(
  rawSessionToken: string,
  expiresAt: string,
) {
  if (!TOKEN_PATTERN.test(rawSessionToken)) {
    throw new Error("BOOKING_SESSION_COOKIE_TOKEN_INVALID");
  }
  const expiry = new Date(expiresAt);
  if (!Number.isFinite(expiry.getTime())) {
    throw new Error("BOOKING_SESSION_COOKIE_EXPIRY_INVALID");
  }

  return [
    `${MANAGE_BOOKING_SESSION_COOKIE}=${rawSessionToken}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Expires=${expiry.toUTCString()}`,
  ].join("; ");
}

export function clearManageBookingSessionCookie() {
  return [
    `${MANAGE_BOOKING_SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ].join("; ");
}

/**
 * Duplicate cookie names are ambiguous and therefore rejected instead of
 * choosing whichever value a framework/browser happened to parse first.
 */
export function readManageBookingSessionCookie(cookieHeader: string | null) {
  if (!cookieHeader) return null;

  const matches = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${MANAGE_BOOKING_SESSION_COOKIE}=`))
    .map((part) => part.slice(MANAGE_BOOKING_SESSION_COOKIE.length + 1));

  if (matches.length !== 1) return null;
  return TOKEN_PATTERN.test(matches[0]) ? matches[0] : null;
}
