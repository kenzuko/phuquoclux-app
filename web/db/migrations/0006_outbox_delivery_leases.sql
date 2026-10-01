-- Durable outbox leasing and retry state.
-- Network delivery happens outside the booking write transaction. Workers claim
-- committed rows with a short lease so a crashed worker can be recovered safely.

alter table outbox_events
  drop constraint if exists outbox_events_status_check;

alter table outbox_events
  add constraint outbox_events_status_check
  check (status in ('pending', 'processing', 'published', 'failed'));

alter table outbox_events
  add column if not exists lease_token uuid,
  add column if not exists leased_at timestamptz,
  add column if not exists lease_expires_at timestamptz;

alter table outbox_events
  add constraint outbox_events_lease_shape_check
  check (
    (
      status = 'processing'
      and lease_token is not null
      and leased_at is not null
      and lease_expires_at is not null
      and lease_expires_at > leased_at
    )
    or
    (
      status <> 'processing'
      and lease_token is null
      and leased_at is null
      and lease_expires_at is null
    )
  );

create index if not exists outbox_events_pending_ready_idx
  on outbox_events(next_attempt_at, created_at, id)
  where status = 'pending';

create index if not exists outbox_events_processing_lease_idx
  on outbox_events(lease_expires_at, created_at, id)
  where status = 'processing';

comment on column outbox_events.lease_token is
  'Opaque worker lease. Ack/retry must match the current lease or fail closed.';

comment on column outbox_events.lease_expires_at is
  'Expired processing leases may be reclaimed by another worker.';

comment on column outbox_events.last_error is
  'Stable sanitized delivery error code only. Never store raw provider errors or guest PII.';
