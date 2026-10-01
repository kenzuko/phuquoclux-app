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

The repository now contains offline PostgreSQL guest-access and session contracts:

- raw manage-booking access tokens are 256-bit random capabilities;
- raw manage-booking session tokens are separate 256-bit random capabilities;
- PostgreSQL stores only SHA-256 hashes of both token types;
- a session can never outlive its parent access grant;
- revoking or expiring a parent grant invalidates its child sessions;
- session expiry and revocation fail closed;
- cookie serialization is locked to `__Host-pql_manage`, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, with no Domain attribute;
- duplicate or malformed session-cookie values fail closed;
- migrations `0003_booking_access_hash.sql` and `0004_booking_access_sessions.sql` reject malformed stored hashes;
- disposable PostgreSQL CI verifies access issue/redeem, session exchange/resolve, expiry, revocation, parent-grant invalidation and raw-token non-persistence.

The access grant is **not consumed automatically** during session exchange. Whether a delivered email/SMS link is one-time remains a later delivery-policy decision.

The repository now also contains a **disabled-by-default resource route** at `/manage/:token` and a delivery-provider boundary. The route is not active guest access:

- `MANAGE_BOOKING_EXCHANGE_ENABLED` is explicitly `false` in the Worker configuration;
- enabling the flag alone is insufficient: canonical HTTPS origin, explicit session TTL and an injected database transaction runtime are all required;
- the current Worker entrypoint injects no booking database runtime;
- while disabled, the route returns a generic 404, does not touch session storage and never sets a cookie;
- manage-link responses force `no-store`, `no-referrer` and `noindex`;
- on a fully configured future runtime, a valid capability exchanges to a distinct HttpOnly session and returns a 303 redirect to the clean `/bookings` URL;
- origin mismatch, malformed/unknown capability or missing runtime fails closed;
- the delivery contract has no email/SMS implementation and raw manage links must never be logged or persisted.

There is still no production database connection, delivery provider or authenticated My Bookings read model. The public checkout remains read-only and My Bookings remains empty.
