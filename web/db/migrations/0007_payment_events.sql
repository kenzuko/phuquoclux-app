-- Normalized payment-event audit.
-- Raw webhook/provider bodies are intentionally excluded. Webhook idempotency
-- remains anchored by webhook_receipts(provider, provider_event_id).

create table if not exists payment_events (
  id uuid primary key,
  payment_id uuid not null references payments(id) on delete cascade,
  booking_id uuid not null references bookings(id) on delete cascade,
  provider text not null,
  provider_event_id text not null,
  event_type text not null check (
    event_type in (
      'payment_captured',
      'payment_failed',
      'refund_started',
      'refund_completed'
    )
  ),
  from_payment_status text not null check (
    from_payment_status in (
      'unpaid',
      'authorized',
      'paid',
      'partially_refunded',
      'refunded',
      'failed'
    )
  ),
  to_payment_status text not null check (
    to_payment_status in (
      'unpaid',
      'authorized',
      'paid',
      'partially_refunded',
      'refunded',
      'failed'
    )
  ),
  amount bigint not null check (amount >= 0),
  currency text not null check (currency = 'VND'),
  created_at timestamptz not null,
  unique (provider, provider_event_id)
);

create index if not exists payment_events_booking_idx
  on payment_events(booking_id, created_at);

create index if not exists payment_events_payment_idx
  on payment_events(payment_id, created_at);

comment on table payment_events is
  'Normalized payment audit only. Never persist raw webhook bodies, guest PII, payment secrets, or access/session capabilities.';
