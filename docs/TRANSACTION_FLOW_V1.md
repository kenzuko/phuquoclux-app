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

- Guest checkout first.
- Product detail does not pretend availability is confirmed until the availability layer exists.
- Payment is explicitly a prototype; no fake transaction.
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
