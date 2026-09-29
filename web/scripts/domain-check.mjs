import {
  assertBookingTransition,
  assertQuoteBookable,
  assertQuotePayable,
  canTransitionBooking,
  createBookingTransitionEvent,
} from "../app/domain/commerce.ts";
import {
  getProductBySlug,
  productsForMapEntity,
} from "../app/domain/catalog.ts";
import {
  assertCatalogValid,
  validateCatalog,
} from "../app/domain/catalog-validation.ts";
import { discover } from "../app/domain/discovery.ts";
import { boundsForEntities } from "../app/domain/map-bounds.ts";
import {
  fromPriceForProduct,
  getOffer,
  offersForProduct,
} from "../app/domain/offer.ts";
import {
  formatServiceDate,
  normalizeServiceDate,
  todayInPhuQuoc,
} from "../app/domain/service-date.ts";
import {
  mapUrl,
  normalizePax,
  productSlugUrl,
  tripIntentFromUrl,
} from "../app/domain/trip-intent.ts";
import { buildTripProjection } from "../app/domain/trip.ts";
import { isBookingAccessActive } from "../app/domain/booking-access.ts";
import { createPrototypeBookingRequest } from "../app/services/booking.server.ts";
import { createPrototypeQuote } from "../app/services/quote.server.ts";
import {
  getCommerceMode,
} from "../app/services/commerce-mode.server.ts";
import {
  parsePrototypeQuoteReceipt,
  reconcilePrototypeQuote,
  serializePrototypeQuoteReceipt,
} from "../app/services/prototype-quote-receipt.server.ts";

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
  equal(validateCatalog().length, 0, "catalog must have no integrity issues");
  assertCatalogValid();

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
    formatServiceDate("2026-10-02"),
    "02/10/2026",
    "traveler-facing date must not depend on browser timezone",
  );
  equal(normalizePax("99"), 20, "trip pax must be capped at 20");
  const intent = tripIntentFromUrl(
    new URL("https://phuquoclux.com/map?date=2026-10-02&pax=4"),
  );
  equal(intent.date, "2026-10-02", "trip intent must preserve service date");
  equal(intent.pax, 4, "trip intent must preserve pax");
  equal(
    productSlugUrl("tour-3-dao-cano", intent),
    "/product/tour-3-dao-cano?date=2026-10-02&pax=4",
    "product URL must carry trip intent",
  );
  equal(
    mapUrl(intent),
    "/map?date=2026-10-02&pax=4",
    "map URL must carry trip intent",
  );
  ok(
    isBookingAccessActive(
      {
        id: "grant-1",
        bookingId: "booking-1",
        purpose: "manage_booking",
        tokenHash: "hash",
        createdAt: "2026-09-29T00:00:00.000Z",
        expiresAt: "2026-10-01T00:00:00.000Z",
      },
      new Date("2026-09-30T00:00:00.000Z"),
    ),
    "unexpired guest booking access must be active",
  );
  ok(
    !isBookingAccessActive(
      {
        id: "grant-2",
        bookingId: "booking-1",
        purpose: "manage_booking",
        tokenHash: "hash2",
        createdAt: "2026-09-29T00:00:00.000Z",
        expiresAt: "2026-10-01T00:00:00.000Z",
        revokedAt: "2026-09-30T00:00:00.000Z",
      },
      new Date("2026-09-30T12:00:00.000Z"),
    ),
    "revoked guest booking access must fail closed",
  );

  equal(
    getProductBySlug("tour-3-dao-cano")?.id,
    "tour-three-islands-cano",
    "route slug must resolve to stable product identity",
  );
  equal(
    productsForMapEntity("an-thoi")[0]?.id,
    "tour-three-islands-cano",
    "MapEntity must resolve related Products without owning a direct commerce href",
  );

  const tourOffers = offersForProduct("tour-three-islands-cano");
  equal(tourOffers.length, 2, "tour product must expose two active offers");
  equal(
    getOffer(
      "tour-three-islands-cano",
      "tour-three-islands-cano:private",
    )?.pricing.mode,
    "flat",
    "private tour must use flat pricing",
  );
  equal(
    fromPriceForProduct("tour-three-islands-cano"),
    850_000,
    "tour from-price must be derived from active offers",
  );
  equal(
    fromPriceForProduct("hon-thom-cable-car"),
    700_000,
    "ticket from-price must use the configured headline unit",
  );

  const discoveryIntent = discover({ q: "cano", category: "all" });
  equal(
    discoveryIntent.products[0]?.productId,
    "tour-three-islands-cano",
    "cano intent must rank the tour product first",
  );

  const honThomInArea = discover({
    q: "hòn thơm",
    bounds: {
      west: 103.95,
      south: 9.98,
      east: 104.05,
      north: 10.08,
    },
  });
  equal(
    honThomInArea.products[0]?.productId,
    "hon-thom-cable-car",
    "text search must keep a matching unlocated product",
  );
  equal(
    honThomInArea.products[0]?.spatialMatch,
    "unlocated",
    "matching product without verified anchor must stay explicitly unlocated",
  );
  ok(
    !honThomInArea.entities.some((entity) => entity.category === "ticket"),
    "unlocated product must not create a fake map pin",
  );

  const canoFocus = boundsForEntities(discoveryIntent.entities);
  ok(Boolean(canoFocus), "search result entities must produce focus bounds");
  ok(
    canoFocus.west < 104.015 && canoFocus.east > 104.015,
    "search focus bounds must contain An Thoi longitude",
  );
  ok(
    canoFocus.south < 10.0191 && canoFocus.north > 10.0191,
    "search focus bounds must contain An Thoi latitude",
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
    "viewport discovery must include Ganh Dau in north-island bounds",
  );
  ok(
    !northOnly.entities.some((entity) => entity.id === "duong-dong"),
    "viewport discovery must exclude Duong Dong outside the bounds",
  );

  const sharedQuote = await createPrototypeQuote({
    productId: "tour-three-islands-cano",
    offerId: "tour-three-islands-cano:shared",
    pax: 3,
    serviceDate: "2026-10-02",
    requestId: "domain-check-shared",
  });
  equal(
    sharedQuote.total.amount,
    2_550_000,
    "per-person tour must scale with pax",
  );
  equal(
    sharedQuote.availabilitySnapshot.state,
    "request",
    "manual provider must never fake live availability",
  );
  assertQuoteBookable(sharedQuote, new Date(sharedQuote.createdAt));
  equal(
    sharedQuote.priceState,
    "estimated",
    "prototype offer pricing must be explicitly estimated",
  );

  let payableEstimateRejected = false;
  try {
    assertQuotePayable(sharedQuote, new Date(sharedQuote.createdAt));
  } catch {
    payableEstimateRejected = true;
  }
  ok(
    payableEstimateRejected,
    "estimated Quote must never be accepted as payable",
  );

  const familyTicket = await createPrototypeQuote({
    productId: "hon-thom-cable-car",
    offerId: "hon-thom-cable-car:standard",
    pax: 3,
    unitQuantities: {
      adult: 2,
      child: 1,
    },
    serviceDate: "2026-10-02",
    requestId: "domain-check-ticket",
  });
  equal(
    familyTicket.pax,
    3,
    "mixed ticket quantities must produce total traveler count",
  );
  equal(
    familyTicket.lines.length,
    2,
    "mixed ticket quantities must create separate quote lines",
  );
  equal(
    familyTicket.total.amount,
    1_904_000,
    "mixed adult and child ticket pricing must total correctly",
  );

  const receipt = parsePrototypeQuoteReceipt(
    serializePrototypeQuoteReceipt(familyTicket),
    new Date(familyTicket.createdAt),
  );
  const reconciled = reconcilePrototypeQuote(receipt, familyTicket);
  equal(
    reconciled.id,
    familyTicket.id,
    "checkout must retain the displayed Quote identity",
  );

  let changedCompositionCaught = false;
  try {
    reconcilePrototypeQuote(receipt, {
      ...familyTicket,
      lines: familyTicket.lines.map((line, index) =>
        index === 0
          ? { ...line, quantity: line.quantity + 1 }
          : line,
      ),
    });
  } catch {
    changedCompositionCaught = true;
  }
  ok(
    changedCompositionCaught,
    "changed ticket composition must invalidate the displayed Quote",
  );

  const privateQuote = await createPrototypeQuote({
    productId: "tour-three-islands-cano",
    offerId: "tour-three-islands-cano:private",
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

  const trip = buildTripProjection([
    booking,
    {
      ...booking,
      id: "00000000-0000-4000-8000-000000000002",
      requestId: "00000000-0000-4000-8000-000000000003",
      serviceDate: "2026-10-03",
      state: "confirmed",
    },
    {
      ...booking,
      id: "00000000-0000-4000-8000-000000000004",
      requestId: "00000000-0000-4000-8000-000000000005",
      state: "cancelled",
    },
  ]);
  equal(trip.bookingCount, 2, "Trip must exclude cancelled bookings");
  equal(trip.days.length, 2, "Trip must group visible bookings by service date");
  equal(trip.days[0]?.date, "2026-10-02", "Trip days must be chronological");

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
