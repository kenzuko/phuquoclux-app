# PhuQuocLux V1 transaction + post-booking flow

## Locked prototype flow

```
Home / Map
   ↓
Product Detail
   ↓
Offer / option + date + pax
   ↓
Checkout
   ↓
Booking confirmation
   ↓
My Bookings
```

## Why this flow exists

The map is the acquisition/discovery language, but transaction state must remain independent of the map.

### Home / Map
Answers: where is it, what is around me, what can I buy?

### Product Detail
Answers: what exactly is this, what is included, where does it happen, how much does my selected option cost?

### Checkout
Answers: who is booking, what operational information is needed, what will be charged/confirmed?

### My Bookings
Answers: what happens now, where is my voucher, when/where do I meet, who helps me if something changes?

## Prototype rules

- Guest checkout is the planned production journey, not an operational capability today.
- Product detail does not pretend availability is confirmed until the availability layer exists.
- The current public checkout previews the selection without collecting guest data or accepting a booking; POST fails with HTTP 503.
- My Bookings is empty until durable booking storage and guest access exist. Query parameters cannot assert a confirmed booking.
- Payment is not enabled; no fake transaction, fake request receipt or fake confirmation.
- Route/map preview is informative, not the source of booking truth.
- Different verticals ask for different operational data.
- Booking remains the post-purchase source of truth.

## Next architecture work after UX review

- formal Product / Offer schemas;
- Availability contract;
- Quote lifecycle;
- Booking state machine;
- provider adapter interfaces;
- production map provider decision;
- production frontend stack decision.
