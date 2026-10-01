-- Bind every manage-booking session to an access grant for the SAME booking.
-- Code already creates matching pairs; this makes the invariant database-owned.

alter table booking_access_tokens
  add constraint booking_access_tokens_id_booking_uidx
  unique (id, booking_id);

alter table booking_access_sessions
  add constraint booking_access_sessions_grant_booking_fkey
  foreign key (access_grant_id, booking_id)
  references booking_access_tokens(id, booking_id)
  on delete cascade;

comment on constraint booking_access_sessions_grant_booking_fkey
  on booking_access_sessions is
  'Prevents a session authorized by booking A from being rebound to booking B.';
