-- Booking request idempotency binds a request UUID to its original payload.
-- One-time migration. Existing keys remain NULL and MUST fail closed on retry;
-- never guess or reconstruct their fingerprint from other records.
-- No public booking route or database connection is enabled by this migration.

alter table idempotency_keys
  add column request_fingerprint text;

alter table idempotency_keys
  add constraint idempotency_keys_fingerprint_format
  check (
    request_fingerprint is null
    or request_fingerprint ~ '^[0-9a-f]{64}$'
  );

comment on column idempotency_keys.request_fingerprint is
  'Hex HMAC-SHA256 of a server-normalized booking request using a private server key. NULL legacy rows cannot be retried automatically.';
