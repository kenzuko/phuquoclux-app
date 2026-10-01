-- Server-side manage-booking sessions.
-- A delivered access capability may later be exchanged for a short-lived
-- HttpOnly cookie. Raw session tokens are never stored; only SHA-256 hashes.
-- This migration does not add a public route or activate guest checkout.

create table if not exists booking_access_sessions (
  id uuid primary key,
  booking_id uuid not null references bookings(id) on delete cascade,
  access_grant_id uuid not null references booking_access_tokens(id) on delete cascade,
  session_hash text not null unique
    check (session_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  check (expires_at > created_at)
);

create index if not exists booking_access_sessions_booking_idx
  on booking_access_sessions(booking_id, expires_at);

create index if not exists booking_access_sessions_grant_idx
  on booking_access_sessions(access_grant_id, expires_at);

comment on table booking_access_sessions is
  'Server-side guest manage-booking sessions. A session is valid only while both the session and its parent access grant are active.';

comment on column booking_access_sessions.session_hash is
  'Lowercase SHA-256 hex digest of a 256-bit random session token. Raw cookie value is never persisted.';
