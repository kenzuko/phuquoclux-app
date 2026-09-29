import {
  assertBookingTransition,
  assertQuoteBookable,
  canTransitionBooking,
  createBookingTransitionEvent,
} from "../app/domain/commerce.ts";
import { discover } from "../app/domain/discovery.ts";
import { getOffer, offersForProduct } from "../app/domain/offer.ts";
import {
  normalizeServiceDate,
  todayInPhuQuoc,
} from "../app/domain/service-date.ts";
import { createPrototypeBookingRequest } from "../app/services/booking.server.ts";
import { createPrototypeQuote } from "../app/services/quote.server.ts";
import {
  getCommerceMode,
} from "../app/services/commerce-mode.server.ts";

function ok(condition, message) {
  if (!condition) throw new Error(message);
}

function equal(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      `${message}\nexpected: ${String(expected)}\nactual: ${String(actual)}`,
    );
  }
}

async function run() {
  equal(getCommerceMode({}), "prototype", "commerce must fail-safe to prototype");
  equal(
    getCommerceMode({ COMMERCE_MODE: "live" }),
    "live",
    "explicit live mode must be readable",
  );

  const fixedNow = new Date("2026-09-29T12:00:00.000Z");
  equal(
    todayInPhuQuoc(fixedNow),
    "2026-09-29",
    "service date must use the Phu Quoc calendar day",
  );
  equal(
    normalizeServiceDate("2026-09-28", fixedNow),
    "2026-09-29",
    "past service date must be normalized to today",
  );
  equal(
    normalizeServiceDate("2026-10-02", fixedNow),
    "2026-10-02",
    "future service date must be preserved",
  );

  const tourOffers = offersForProduct("tour");
  equal(tourOffers.length, 2, "tour must expose two active offers");
  equal(
    getOffer("tour", "tour:private")?.price.basis,
    "per_booking",
    "private tour must price per booking",
  );

  const intent = discover({ q: "cano", category: "all" });
  equal(intent.products[0]?.type, "tour", "cano intent must rank tour first");
  ok(
    intent.entities.some((entity) => entity.id === "an-thoi"),
    "tour intent must keep its linked An Thoi map entity",
  );

  const northOnly = discover({
    category: "place",
    bounds: {
      west: 103.86,
      south: 10.32,
      east: 103.96,
      north: 10.42,
    },
  });
  ok(
    northOnly.entities.some((entity) => entity.id === "ganh-dau"),
    "viewport discovery must include Ganh Dau in the north island bounds",
  );
  ok(
    !northOnly.entities.some((entity) => entity.id === "duong-dong"),
    "viewport discovery must exclude Duong Dong outside the bounds",
  );

  const sharedQuote = await createPrototypeQuote({
    type: "tour",
    offerId: "tour:shared",
    pax: 3,
    serviceDate: "2026-10-02",
    requestId: "domain-check-shared",
  });
  equal(
    sharedQuote.total.amount,
    2_550_000,
    "per-person offer total must scale with pax",
  );
  equal(
    sharedQuote.availabilitySnapshot.state,
    "request",
    "manual provider must never fake live availability",
  );
  assertQuoteBookable(sharedQuote, new Date(sharedQuote.createdAt));

  const privateQuote = await createPrototypeQuote({
    type: "tour",
    offerId: "tour:private",
    pax: 6,
    serviceDate: "2026-10-02",
    requestId: "domain-check-private",
  });
  equal(
    privateQuote.total.amount,
    4_420_000,
    "per-booking offer total must not multiply by pax",
  );

  const booking = createPrototypeBookingRequest({
    requestId: "00000000-0000-4000-8000-000000000001",
    quote: sharedQuote,
    contact: {
      name: "Domain Check",
      email: "domain@example.com",
      phone: "+84900000000",
    },
  });
  equal(
    booking.state,
    "pending_confirmation",
    "request availability must create a pending-confirmation booking",
  );
  equal(booking.version, 1, "new booking version must start at 1");

  ok(
    canTransitionBooking("pending_confirmation", "pending_payment"),
    "request-first flow must allow confirmation before payment",
  );
  assertBookingTransition("pending_payment", "paid");

  const event = createBookingTransitionEvent(
    booking,
    "pending_payment",
    "provider approved request",
  );
  equal(event.version, 2, "transition event must increment booking version");
  equal(
    event.fromState,
    "pending_confirmation",
    "transition event must retain source state",
  );

  let invalidTransitionCaught = false;
  try {
    assertBookingTransition("fulfilled", "confirmed");
  } catch {
    invalidTransitionCaught = true;
  }
  ok(invalidTransitionCaught, "invalid state regression must be rejected");

  console.log("domain-check: PASS");
}

await run();
