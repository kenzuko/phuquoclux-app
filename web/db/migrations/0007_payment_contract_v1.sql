-- PhuQuocLux Payment Contract V1 - tracked production migration.
-- Provider-neutral schema only. This does not activate checkout, webhooks,
-- Hyperdrive, a concrete payment provider, or live commerce.

create table if not exists payment_intents_v1 (
  id uuid primary key,
  booking_id uuid not null unique references bookings(id) on delete cascade,
  quote_id uuid not null references quotes(id),
  status text not null check (
    status in (
      'pending', 'authorized', 'paid', 'refund_pending',
      'partially_refunded', 'refunded', 'failed'
    )
  ),
  version bigint not null default 1 check (version > 0),
  amount bigint not null check (amount > 0),
  currency text not null default 'VND' check (currency in ('VND')),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (id, booking_id)
);

create index if not exists payment_intents_v1_booking_idx
  on payment_intents_v1(booking_id);

create table if not exists payment_attempts_v1 (
  id uuid primary key,
  intent_id uuid not null references payment_intents_v1(id) on delete cascade,
  provider text not null
    check (
      char_length(provider) between 1 and 64
      and provider ~ '^[a-z0-9][a-z0-9._-]*$'
    ),
  request_key uuid not null unique,
  provider_reference text,
  status text not null check (
    status in (
      'created', 'authorized', 'paid', 'partially_refunded',
      'refunded', 'failed'
    )
  ),
  amount bigint not null check (amount > 0),
  currency text not null default 'VND' check (currency in ('VND')),
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists payment_attempts_v1_intent_idx
  on payment_attempts_v1(intent_id, created_at);

create unique index if not exists payment_attempts_v1_provider_ref_uidx
  on payment_attempts_v1(provider, provider_reference)
  where provider_reference is not null;

create table if not exists payment_receipts_v1 (
  provider text not null,
  provider_event_id text not null
    check (char_length(provider_event_id) between 1 and 200),
  attempt_id uuid not null references payment_attempts_v1(id),
  payload_hash text not null
    check (payload_hash ~ '^[0-9a-f]{64}$'),
  event_status text not null check (
    event_status in (
      'authorized', 'paid', 'partially_refunded', 'refunded', 'failed'
    )
  ),
  result_payment_status text check (
    result_payment_status is null or result_payment_status in (
      'unpaid', 'authorized', 'paid', 'partially_refunded', 'refunded', 'failed'
    )
  ),
  result_booking_state text check (
    result_booking_state is null or result_booking_state in (
      'draft', 'pending_payment', 'paid', 'pending_confirmation', 'confirmed',
      'fulfilled', 'cancel_requested', 'cancelled', 'refund_pending',
      'refunded', 'failed', 'expired'
    )
  ),
  result_booking_version bigint check (
    result_booking_version is null or result_booking_version > 0
  ),
  received_at timestamptz not null,
  processed_at timestamptz,
  primary key (provider, provider_event_id)
);

create index if not exists payment_receipts_v1_attempt_idx
  on payment_receipts_v1(attempt_id, received_at);

comment on table payment_intents_v1 is
  'Payment Contract V1 intent ledger. Provider-neutral and versioned.';
comment on table payment_attempts_v1 is
  'Provider-neutral payment attempts. No provider secrets or guest PII.';
comment on table payment_receipts_v1 is
  'Replay-safe verified event receipts. Stores stable identifiers and SHA-256 payload hashes, never raw webhook bodies.';
