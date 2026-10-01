# Guest booking access V1

Date: 29/09/2026

## Why this exists

PhuQuocLux allows guest checkout.

That means a traveler must be able to return to a booking later without being forced to create an account first.

The access mechanism must not rely on:

- booking ids in public URLs;
- email address in query parameters;
- browser-only state;
- predictable reference numbers as authentication.

## Decision

Confirmed or pending bookings may issue an opaque **manage-booking access token**.

The raw token is:

- generated with cryptographically secure randomness;
- delivered to the traveler out-of-band, such as email/SMS;
- used only as a capability to retrieve/manage the intended booking.

The database stores only:

- token hash;
- booking id;
- purpose;
- expiry;
- revocation/use timestamps.

The raw token is never persisted.

## Access lifecycle

```
Booking created
→ issue opaque access token
→ store access-token hash
→ deliver raw token
→ traveler opens manage-booking link
→ validate active access grant
→ mint a distinct random session token
→ store only the session-token hash
→ set Secure + HttpOnly + SameSite=Lax host cookie
→ redirect to a clean URL
→ resolve subsequent requests from the session cookie
```

## Security rules

- token must be high entropy;
- raw token must not appear in logs;
- query strings containing raw capability tokens must be scrubbed from analytics;
- expired/revoked tokens fail closed;
- a token grants access only to one booking and one purpose;
- changing an email or phone number does not silently mint a new grant;
- staff/Ops access is a separate authorization path.

## URL handling

Production may use a short-lived URL such as:

`/manage/<opaque-token>`

After validation, the app should exchange that capability for a secure HttpOnly session/cookie and redirect to a clean URL so the raw token does not stay in browser history longer than necessary.

## Current implementation state

The repository now contains an offline PostgreSQL guest-access contract:

- raw manage-booking tokens are 256-bit random capabilities;
- the database stores only a SHA-256 hash;
- expiry and revocation fail closed;
- successful redemption resolves only the internal booking identity and updates `last_used_at`;
- migration `0003_booking_access_hash.sql` rejects non-hash token storage;
- disposable PostgreSQL CI verifies issue, redeem, expiry, revocation and unknown-booking rollback.

This contract is **not wired to a public route**. No raw token is currently delivered by email/SMS, exchanged for an HttpOnly session, or exposed in analytics.

The public checkout therefore remains read-only and My Bookings remains empty until the delivery/session boundary and production database connection are implemented and reviewed.
