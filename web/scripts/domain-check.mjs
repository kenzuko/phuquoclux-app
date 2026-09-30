import {
  assertBookingTransition,
  assertQuoteBookable,
  assertQuotePayable,
  canTransitionBooking,
  createBookingTransitionEvent,
} from "../app/domain/commerce.ts";
import {
  getProductBySlug,
  mapCoordinateScopeCopy,
  mapVerificationLabel,
  productsForMapEntity,
} from "../app/domain/catalog.ts";
import {
  assertCatalogValid,
  validateCatalog,
} from "../app/domain/catalog-validation.ts";
import { discover } from "../app/domain/discovery.ts";
import { boundsForEntities } from "../app/domain/map-bounds.ts";
import {
  cancellationPolicyLabel,
  confirmationPolicyLabel,
  findOffer,
  fromPriceForProduct,
  getOffer,
  maxPaxForProduct,
  offerSupportsPax,
  priceCertaintyForProduct,
  offersForProduct,
} from "../app/domain/offer.ts";
import { priceOffer } from "../app/domain/pricing.ts";
import {
  formatServiceDate,
  normalizeServiceDate,
  todayInPhuQuoc,
} from "../app/domain/service-date.ts";
import {
  homeUrl,
  mapUrl,
  normalizePax,
  productSlugUrl,
  tripIntentFromUrl,
} from "../app/domain/trip-intent.ts";
import { buildTripProjection } from "../app/domain/trip.ts";
import {
  safeReturnTo,
  withReturnTo,
} from "../app/domain/navigation.ts";
import { isBookingAccessActive } from "../app/domain/booking-access.ts";
import {
  parseWeatherContext,
  weatherRainLabel,
} from "../app/domain/weather-context.ts";
import { createPrototypeBookingRequest } from "../app/services/booking.server.ts";
import {
  readFlightNumber,
  readInteger,
} from "../app/services/request-validation.server.ts";
import { createPrototypeQuote } from "../app/services/quote.server.ts";
import {
  getCommerceMode,
} from "../app/services/commerce-mode.server.ts";
import {
  auditSupplierIntake,
  expectedSupplierIntakeOffers,
  validateSupplierIntakeRow,
} from "../app/domain/supplier-intake.ts";
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

  const supplierNow = new Date("2026-10-01T10:00:00.000Z");
  const supplierRows = expectedSupplierIntakeOffers().map((offer) => ({
    offer_id: offer.offerId,
    provider_id: offer.providerId,
    source_type: "supplier",
    source_reference: "SYNTHETIC-TEST-REFERENCE",
    price_verified_at_utc: "2026-10-01T09:00:00Z",
    valid_from: "2026-10-01",
    valid_through: "2026-12-31",
    pricing_mode: offer.pricingMode,
    price_basis: offer.priceBasis,
    flat_vnd: offer.pricingMode === "flat" ? "123456" : "",
    unit_rates_vnd:
      offer.pricingMode === "unit_mix"
        ? offer.unitCodes.map((code, index) => `${code}=${123456 + index}`).join(";")
        : "",
    max_pax: offer.maxPax ? String(offer.maxPax) : "",
    cancellation_policy_reference: "SYNTHETIC-CANCEL-POLICY",
    confirmation_policy_reference: "SYNTHETIC-CONFIRM-POLICY",
    inventory_mode: offer.inventoryMode,
  }));

  const supplierAudit = auditSupplierIntake(supplierRows, supplierNow);
  equal(
    supplierAudit.readyForOpsReviewCount,
    supplierAudit.expectedOfferCount,
    "complete synthetic supplier evidence should be ready for manual Ops review",
  );
  equal(
    supplierAudit.liveCommerceEligibleCount,
    0,
    "offline supplier intake must never activate live commerce",
  );
  equal(
    supplierAudit.fileIssues.length,
    0,
    "complete supplier intake must cover each active Offer exactly once",
  );

  const unsafeSupplierRow = {
    ...supplierRows[0],
    source_type: "prototype",
    source_reference: "",
    valid_through: "2026-09-30",
  };
  const unsafeSupplierAssessment = validateSupplierIntakeRow(
    unsafeSupplierRow,
    supplierNow,
  );
  ok(
    !unsafeSupplierAssessment.readyForOpsReview,
    "prototype or expired supplier evidence must fail closed",
  );
  ok(
    unsafeSupplierAssessment.issues.some(
      (issue) => issue.code === "SOURCE_TYPE_INVALID",
    ),
    "prototype source must never count as supplier evidence",
  );
  ok(
    unsafeSupplierAssessment.issues.some(
      (issue) => issue.code === "PRICE_EVIDENCE_EXPIRED",
    ),
    "expired price evidence must be rejected",
  );

  const duplicateSupplierAudit = auditSupplierIntake(
    [...supplierRows, supplierRows[0]],
    supplierNow,
  );
  ok(
    duplicateSupplierAudit.fileIssues.some(
      (issue) => issue.code === "OFFER_DUPLICATE_IN_FILE",
    ),
    "duplicate supplier Offer rows must fail file-level validation",
  );

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
    weatherRainLabel(0),
    "Không mưa đáng kể",
    "weather context must keep dry conditions human-readable",
  );
  equal(
    weatherRainLabel(3),
    "Mưa vừa",
    "weather context must translate moderate rain rate",
  );
  const weatherContext = parseWeatherContext(
    {
      local_now: {
        generated_at: "2026-09-29T11:55:00.000Z",
        points: {
          duong_dong: {
            name: "Dương Đông",
            analysis_time: "2026-09-29T11:55:00.000Z",
            temperature_c: 29.6,
            rain: { rain_rate_mm_h: 0.05 },
          },
        },
      },
    },
    "duong_dong",
    new Date("2026-09-29T12:00:00.000Z"),
  );
  equal(
    weatherContext?.status,
    "live",
    "fresh normalized Weather runtime must surface as live context",
  );
  equal(
    weatherContext?.rainLabel,
    "Không mưa đáng kể",
    "weather chip must use normalized human rain label",
  );
  equal(
    normalizeServiceDate("2026-09-28", fixedNow),
    "2026-09-29",
    "past service date must be normalized to today",
  );

  equal(
    normalizeServiceDate("2026-02-30", fixedNow),
    "2026-09-29",
    "impossible service date must fail safe to today",
  );
  equal(
    formatServiceDate("2026-10-02"),
    "02/10/2026",
    "traveler-facing date must not depend on browser timezone",
  );
  const staleWeatherContext = parseWeatherContext(
    {
      local_now: {
        generated_at: "2026-09-29T10:00:00.000Z",
        points: {
          duong_dong: {
            name: "Dương Đông",
            temperature_c: 28,
            rain: { rain_rate_mm_h: 0 },
          },
        },
      },
    },
    "duong_dong",
    new Date("2026-09-29T12:00:00.000Z"),
  );
  equal(
    staleWeatherContext?.status,
    "stale",
    "stale Weather runtime must never be labeled live",
  );

  equal(normalizePax(null), 2, "missing pax should default to 2");
  equal(normalizePax(""), 2, "empty pax should default to 2");
  equal(normalizePax(undefined), 2, "undefined pax should default to 2");
  equal(normalizePax("1"), 1, "explicit solo traveler must be preserved");
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

  equal(
    homeUrl(intent),
    "/?date=2026-10-02&pax=4",
    "Home URL must carry trip intent",
  );
  equal(
    safeReturnTo("/map?q=cano&date=2026-10-02&pax=4"),
    "/map?q=cano&date=2026-10-02&pax=4",
    "safe return path must preserve internal Map state",
  );
  equal(
    safeReturnTo("https://evil.example/path", "/map"),
    "/map",
    "external return targets must be rejected",
  );
  equal(
    withReturnTo(
      "/product/tour-3-dao-cano?date=2026-10-02&pax=4",
      "/map?q=cano&date=2026-10-02&pax=4",
    ),
    "/product/tour-3-dao-cano?date=2026-10-02&pax=4&returnTo=%2Fmap%3Fq%3Dcano%26date%3D2026-10-02%26pax%3D4",
    "Product links must retain an encoded internal return target",
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

  const anThoiEntity = discoveryIntentEntity("an-thoi");
  equal(
    mapVerificationLabel(anThoiEntity),
    "Khu vực đã xác minh",
    "verified area must not be labeled as an exact location",
  );
  ok(
    mapCoordinateScopeCopy(anThoiEntity).includes("không phải điểm đón"),
    "area scope copy must explicitly reject exact-pickup interpretation",
  );

  const tourOffers = offersForProduct("tour-three-islands-cano");
  equal(tourOffers.length, 2, "tour product must expose two active offers");

  equal(
    findOffer("tour-three-islands-cano", "not-a-real-offer"),
    undefined,
    "strict Offer lookup must not silently substitute another Offer",
  );
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

  equal(
    priceCertaintyForProduct("tour-three-islands-cano"),
    "estimated",
    "prototype headline pricing must remain explicitly estimated",
  );

  const sedan = getOffer(
    "airport-private-transfer",
    "airport-private-transfer:sedan",
  );
  ok(Boolean(sedan), "transfer sedan offer must exist");
  equal(
    maxPaxForProduct("airport-private-transfer"),
    16,
    "transfer max pax must come from the largest active vehicle",
  );
  ok(
    !offerSupportsPax(sedan, 5),
    "sedan must reject pax above its declared capacity",
  );

  ok(
    sedan.requiredOperationalFields?.includes("hotel_or_pickup"),
    "transfer must require destination / hotel before request submission",
  );
  ok(
    sedan.requiredOperationalFields?.includes("flight_number"),
    "airport pickup must require the flight number before request submission",
  );

  ok(
    sedan.operationalFields.includes("luggage_count"),
    "airport transfer must collect luggage count for vehicle planning",
  );

  const transferForm = new FormData();
  transferForm.set("flightNumber", "vn 1825");
  transferForm.set("luggageCount", "3");
  equal(
    readFlightNumber(transferForm, "flightNumber", true),
    "VN1825",
    "flight number input must be normalized before Ops receives it",
  );
  equal(
    readInteger(transferForm, "luggageCount", {
      min: 0,
      max: 20,
    }),
    3,
    "luggage count must remain a bounded integer",
  );

  equal(
    confirmationPolicyLabel(sedan),
    "Cần JoTrip xác nhận",
    "request-first Offers must expose a clear traveler confirmation label",
  );
  ok(
    cancellationPolicyLabel(sedan).includes("JoTrip xác nhận"),
    "provider-defined cancellation must not be presented as a fake fixed policy",
  );

  let capacityCaught = false;
  try {
    priceOffer(sedan, 5);
  } catch (error) {
    capacityCaught =
      error instanceof Error &&
      error.message === "OFFER_CAPACITY_EXCEEDED";
  }
  ok(
    capacityCaught,
    "server pricing must reject an over-capacity vehicle offer",
  );

  const discoveryIntent = discover({ q: "cano", category: "all" });
  equal(
    discoveryIntent.products[0]?.productId,
    "tour-three-islands-cano",
    "cano intent must rank the tour product first",
  );

  const typoIntent = discover({ q: "hon thm", category: "all" });
  equal(
    typoIntent.products[0]?.productId,
    "hon-thom-cable-car",
    "one-character typo in a meaningful search token must still resolve",
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
    "Hòn Thơm text search must keep the ticket product",
  );
  equal(
    honThomInArea.products[0]?.spatialMatch,
    "linked",
    "Hòn Thơm product must use verified shared destination anchors",
  );
  const sunsetTownAnchor = honThomInArea.entities.find(
    (entity) => entity.id === "sunset-town",
  );
  ok(
    Boolean(sunsetTownAnchor),
    "Hòn Thơm discovery must expose the verified Sunset Town area anchor",
  );
  equal(
    sunsetTownAnchor?.coordinateScope,
    "area",
    "Sunset Town anchor must remain an area, not an exact cable-car gate",
  );
  equal(
    sunsetTownAnchor?.provenance.system,
    "openpq",
    "shared Hòn Thơm coordinates must retain OpenPQ provenance",
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


function discoveryIntentEntity(id) {
  const result = discover({ category: "all" });
  const entity = result.entities.find((item) => item.id === id);
  if (!entity) throw new Error(`missing MapEntity: ${id}`);
  return entity;
}
