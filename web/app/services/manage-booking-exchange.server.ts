import type { PhuQuocLuxEnv } from "../cloudflare-context";
import type { SqlTransactionManager } from "../repositories/postgres-booking-core.server";
import {
  exchangeManageBookingAccessForSession,
  serializeManageBookingSessionCookie,
} from "../repositories/postgres-booking-session.server";

const RAW_ACCESS_TOKEN_PATTERN = /^[0-9a-f]{64}$/;
const MIN_SESSION_TTL_MINUTES = 5;
const MAX_SESSION_TTL_MINUTES = 24 * 60;

function securityHeaders() {
  return new Headers({
    "Cache-Control": "private, no-store, max-age=0",
    "Pragma": "no-cache",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow",
    "Content-Security-Policy":
      "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  });
}

function hiddenNotFound() {
  return new Response("Not found", {
    status: 404,
    headers: securityHeaders(),
  });
}

function unavailable() {
  return new Response("Manage booking is unavailable", {
    status: 503,
    headers: securityHeaders(),
  });
}

function parseConfiguredOrigin(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== "/" && url.pathname !== "")
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function sessionTtlMinutes(value: string | undefined) {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < MIN_SESSION_TTL_MINUTES ||
    parsed > MAX_SESSION_TTL_MINUTES
  ) {
    return null;
  }
  return parsed;
}

export function manageBookingExchangeConfigured(env: PhuQuocLuxEnv) {
  return (
    env.MANAGE_BOOKING_EXCHANGE_ENABLED === "true" &&
    parseConfiguredOrigin(env.MANAGE_BOOKING_CANONICAL_ORIGIN) !== null &&
    sessionTtlMinutes(env.MANAGE_BOOKING_SESSION_TTL_MINUTES) !== null
  );
}

export async function exchangeManageBookingRequest(input: {
  request: Request;
  rawAccessToken: string | undefined;
  env: PhuQuocLuxEnv;
  database?: SqlTransactionManager;
  now?: Date;
}) {
  const { request, rawAccessToken, env, database } = input;
  const now = input.now ?? new Date();

  // Disabled must look exactly like an unknown route, without touching DB.
  if (env.MANAGE_BOOKING_EXCHANGE_ENABLED !== "true") {
    return hiddenNotFound();
  }

  const canonicalOrigin = parseConfiguredOrigin(
    env.MANAGE_BOOKING_CANONICAL_ORIGIN,
  );
  const ttlMinutes = sessionTtlMinutes(
    env.MANAGE_BOOKING_SESSION_TTL_MINUTES,
  );
  if (!canonicalOrigin || ttlMinutes === null || !database) {
    return unavailable();
  }

  // Host-header/origin drift is never allowed to mint a cookie on an
  // unexpected origin.
  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== canonicalOrigin) {
    return hiddenNotFound();
  }

  if (
    request.method !== "GET" ||
    !rawAccessToken ||
    !RAW_ACCESS_TOKEN_PATTERN.test(rawAccessToken)
  ) {
    return hiddenNotFound();
  }

  const requestedExpiry = new Date(
    now.getTime() + ttlMinutes * 60 * 1000,
  ).toISOString();

  let session;
  try {
    session = await exchangeManageBookingAccessForSession(
      database,
      rawAccessToken,
      requestedExpiry,
      now,
    );
  } catch {
    // Never reflect DB/provider detail into a capability endpoint.
    return unavailable();
  }

  if (!session) return hiddenNotFound();

  const headers = securityHeaders();
  headers.set(
    "Set-Cookie",
    serializeManageBookingSessionCookie(
      session.rawSessionToken,
      session.expiresAt,
    ),
  );
  // Relative Location avoids reconstructing a URL from untrusted request data.
  headers.set("Location", "/bookings");

  return new Response(null, {
    status: 303,
    headers,
  });
}
