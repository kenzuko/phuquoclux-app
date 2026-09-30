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
→ store token hash
→ deliver raw token
→ traveler opens manage-booking link
→ hash supplied token
→ match active grant
→ authorize booking access
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

## Current prototype

No guest access token is issued yet because PostgreSQL persistence and delivery channels are not connected.

The prototype My Bookings page therefore remains explicit about not being durable.

The architecture is ready for a real implementation without changing Product, Quote, Booking or Map flows.
