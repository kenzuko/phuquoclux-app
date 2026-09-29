-- PhuQuocLux commerce core
-- PostgreSQL migration draft - not wired to production yet.

create table if not exists products (
  id text primary key,
  slug text not null unique,
  product_type text not null
    check (product_type in ('tour', 'ticket', 'transfer')),
  name text not null,
  status text not null default 'active'
    check (status in ('active', 'paused', 'retired')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists offers (
  id text primary key,
  product_id text not null references products(id),
  provider_id text not null,
  status text not null
    check (status in ('active', 'paused', 'retired')),
  availability_mode text not null
    check (availability_mode in ('request', 'live', 'scheduled')),
  price_amount bigint not null check (price_amount >= 0),
  price_currency text not null default 'VND'
    check (price_currency in ('VND')),
  price_basis text not null
    check (price_basis in ('per_person', 'per_booking')),
  price_source text not null
    check (price_source in ('prototype', 'jotrip', 'supplier', 'provider_api')),
  policy jsonb not null default '{}'::jsonb,
  operational_fields jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists offers_product_id_idx
  on offers(product_id);

create table if not exists quotes (
  id uuid primary key,
  product_id text not null references products(id),
  offer_id text not null references offers(id),
  status text not null
    check (status in ('active', 'expired', 'accepted', 'void')),
  service_date date not null,
  pax integer not null check (pax > 0),
  total_amount bigint not null check (total_amount >= 0),
  currency text not null default 'VND'
    check (currency in ('VND')),
  availability_snapshot jsonb not null,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  check (expires_at > created_at)
);

create index if not exists quotes_offer_date_idx
  on quotes(offer_id, service_date);

create table if not exists quote_lines (
  quote_id uuid not null references quotes(id) on delete cascade,
  line_no integer not null,
  code text not null,
  label text not null,
  quantity integer not null check (quantity > 0),
  unit_price_amount bigint not null check (unit_price_amount >= 0),
  total_amount bigint not null check (total_amount >= 0),
  currency text not null default 'VND'
    check (currency in ('VND')),
  primary key (quote_id, line_no)
);

create table if not exists bookings (
  id uuid primary key,
  request_id uuid not null unique,
  customer_id text,
  guest_name text not null,
  guest_email text not null,
  guest_phone text not null,
  product_id text not null references products(id),
  offer_id text not null references offers(id),
  quote_id uuid not null references quotes(id),
  state text not null check (
    state in (
      'draft',
      'pending_payment',
      'paid',
      'pending_confirmation',
      'confirmed',
      'fulfilled',
      'cancel_requested',
      'cancelled',
      'refund_pending',
      'refunded',
      'failed',
      'expired'
    )
  ),
  version bigint not null default 1 check (version > 0),
  payment_status text not null check (
    payment_status in (
      'unpaid',
      'authorized',
      'paid',
      'partially_refunded',
      'refunded',
      'failed'
    )
  ),
  service_date date not null,
  pax integer not null check (pax > 0),
  total_amount bigint not null check (total_amount >= 0),
  currency text not null default 'VND'
    check (currency in ('VND')),
  operational_data jsonb not null default '{}'::jsonb,
  voucher_ref text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists bookings_guest_email_idx
  on bookings(lower(guest_email));

create index if not exists bookings_service_date_idx
  on bookings(service_date);

create index if not exists bookings_state_idx
  on bookings(state);

create table if not exists booking_events (
  id uuid primary key,
  booking_id uuid not null references bookings(id) on delete cascade,
  from_state text not null,
  to_state text not null,
  version bigint not null check (version > 1),
  reason text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  unique (booking_id, version)
);

create index if not exists booking_events_booking_idx
  on booking_events(booking_id, created_at);

create table if not exists payments (
  id uuid primary key,
  booking_id uuid not null references bookings(id),
  provider text not null,
  provider_reference text,
  status text not null check (
    status in (
      'unpaid',
      'authorized',
      'paid',
      'partially_refunded',
      'refunded',
      'failed'
    )
  ),
  amount bigint not null check (amount >= 0),
  currency text not null default 'VND'
    check (currency in ('VND')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists payments_provider_ref_uidx
  on payments(provider, provider_reference)
  where provider_reference is not null;

create table if not exists outbox_events (
  id uuid primary key,
  event_name text not null,
  aggregate_type text not null,
  aggregate_id text not null,
  aggregate_version bigint not null check (aggregate_version > 0),
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'published', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz,
  published_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (aggregate_type, aggregate_id, aggregate_version, event_name)
);

create index if not exists outbox_events_pending_idx
  on outbox_events(status, next_attempt_at, created_at);

create table if not exists webhook_receipts (
  provider text not null,
  provider_event_id text not null,
  processed_at timestamptz not null,
  payload_hash text,
  primary key (provider, provider_event_id)
);

create table if not exists idempotency_keys (
  request_id uuid primary key,
  scope text not null,
  resource_type text not null,
  resource_id text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

comment on table products is
  'Stable product identity. Slug is public-facing and may change without changing id.';

comment on table bookings is
  'Authoritative booking ledger. Cache/Map state must never replace this table.';

comment on table outbox_events is
  'Transactional integration outbox. Ops/provider notifications are published from committed domain events, not inline checkout side effects.';

comment on column bookings.version is
  'Optimistic concurrency version. Every state transition must increment this value.';
