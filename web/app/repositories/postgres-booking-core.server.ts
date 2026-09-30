/**
 * Driver-neutral PostgreSQL booking writer. Offline contract only:
 * no Worker bindings, pool, public route, payment, or delivery integration.
 *
 * The caller must supply a single-connection PostgreSQL transaction manager.
 * The transaction MUST commit only if every statement and callback succeeds.
 * No caller may use a cache, independent queries, or a connection pool
 * without transaction pinning to satisfy this interface.
 */
import type { Booking, Quote } from "../domain/commerce";
import { assertQuoteBookable } from "../domain/commerce";

export type SqlResult<Row> = { rows: Row[] };
export type SqlTransaction = {
  query<Row extends object = Record<string, unknown>>(
    sql: string,
    parameters: readonly unknown[],
  ): Promise<SqlResult<Row>>;
};
export type SqlTransactionManager = {
  transaction<T>(work: (tx: SqlTransaction) => Promise<T>): Promise<T>;
};

export type DurableBookingRequest = {
  quote: Quote;
  booking: Booking;
  /** Server-only secret CryptoKey: HMAC-SHA256. Never accept from a guest. */
  fingerprintKey: CryptoKey;
};
export type DurableBookingResult = {
  outcome: "created" | "already_exists";
  bookingId: string;
};

function verifyRequest(input: DurableBookingRequest) {
  const { quote, booking } = input;
  if (
    quote.id !== booking.quoteId ||
    quote.productId !== booking.productId ||
    quote.productType !== booking.productType ||
    quote.offerId !== booking.offerId ||
    quote.serviceDate !== booking.serviceDate ||
    quote.pax !== booking.pax ||
    quote.total.amount !== booking.total.amount ||
    quote.total.currency !== booking.total.currency
  ) {
    throw new Error("BOOKING_QUOTE_MISMATCH");
  }
  if (
    booking.state !== "pending_confirmation" ||
    booking.paymentStatus !== "unpaid" ||
    booking.version !== 1 ||
    booking.voucherRef ||
    quote.availabilitySnapshot.state !== "request" ||
    quote.availabilitySnapshot.source !== "manual"
  ) {
    throw new Error("DURABLE_WRITER_MANUAL_REQUEST_ONLY");
  }
  if (
    !booking.contact.name.trim() ||
    !booking.contact.phone.trim() ||
    !booking.contact.email.trim()
  ) {
    throw new Error("BOOKING_CONTACT_REQUIRED");
  }
  if (
    !Number.isSafeInteger(quote.total.amount) ||
    quote.total.amount <= 0 ||
    quote.total.currency !== "VND" ||
    !Number.isSafeInteger(quote.pax) ||
    quote.pax <= 0 ||
    quote.pax > 20 ||
    !quote.lines.length ||
    quote.lines.some(
      (line) =>
        !Number.isSafeInteger(line.quantity) ||
        line.quantity <= 0 ||
        !Number.isSafeInteger(line.total.amount) ||
        line.total.amount < 0 ||
        !Number.isSafeInteger(line.unitPrice.amount) ||
        line.unitPrice.amount < 0 ||
        line.total.amount !== line.quantity * line.unitPrice.amount ||
        line.total.currency !== "VND" ||
        line.unitPrice.currency !== "VND",
    ) ||
    quote.lines.reduce((sum, line) => sum + line.total.amount, 0) !==
      quote.total.amount
  ) {
    throw new Error("QUOTE_TOTAL_INVALID");
  }
}

/** Only a server-owned key hashes personal fields and the commercial terms. */
export async function bookingRequestFingerprint(
  input: DurableBookingRequest,
): Promise<string> {
  verifyRequest(input);
  if (input.fingerprintKey.algorithm.name !== "HMAC") {
    throw new Error("BOOKING_FINGERPRINT_KEY_INVALID");
  }
  const { quote, booking } = input;
  const canonical = JSON.stringify({
    requestId: booking.requestId,
    productId: booking.productId,
    offerId: booking.offerId,
    serviceDate: booking.serviceDate,
    pax: booking.pax,
    currency: booking.total.currency,
    amount: booking.total.amount,
    priceState: quote.priceState,
    lines: quote.lines.map((line) => [
      line.code,
      line.quantity,
      line.unitPrice.amount,
      line.total.amount,
    ]),
    name: booking.contact.name.trim(),
    email: booking.contact.email.trim().toLowerCase(),
    phone: booking.contact.phone.trim(),
    operationalData: {
      hotelOrPickup: booking.operationalData?.hotelOrPickup ?? "",
      flightNumber: booking.operationalData?.flightNumber ?? "",
      luggageCount: booking.operationalData?.luggageCount ?? null,
      guestNote: booking.operationalData?.guestNote ?? "",
    },
  });
  const bytes = new TextEncoder().encode(canonical);
  const signature = await crypto.subtle.sign("HMAC", input.fingerprintKey, bytes);
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Atomically create a manual-request booking + Quote + outbox event.
 * The unique idempotency INSERT serializes concurrent same-key requests under
 * PostgreSQL READ COMMITTED; replay returns only an internal booking id.
 *
 * No token is issued here, no customer data is returned, and this function
 * MUST NOT be wired to public checkout until guest access/delivery are ready.
 */
export async function persistManualBookingRequest(
  database: SqlTransactionManager,
  input: DurableBookingRequest,
  now = new Date(),
): Promise<DurableBookingResult> {
  const { quote, booking } = input;
  const fingerprint = await bookingRequestFingerprint(input);

  return database.transaction(async (tx) => {
    const claim = await tx.query<{ request_id: string }>(
      `insert into idempotency_keys
        (request_id, scope, resource_type, resource_id, request_fingerprint)
       values ($1, 'booking.request', 'booking', $2, $3)
       on conflict (request_id) do nothing
       returning request_id`,
      [booking.requestId, booking.id, fingerprint],
    );
    if (!claim.rows.length) {
      const previous = await tx.query<{
        scope: string;
        resource_type: string;
        resource_id: string;
        request_fingerprint: string | null;
      }>(
        `select scope, resource_type, resource_id, request_fingerprint
           from idempotency_keys where request_id = $1`,
        [booking.requestId],
      );
      const old = previous.rows[0];
      if (
        !old ||
        old.scope !== "booking.request" ||
        old.resource_type !== "booking" ||
        old.request_fingerprint !== fingerprint
      ) {
        throw new Error("BOOKING_REQUEST_ID_REUSED_WITH_DIFFERENT_INPUT");
      }
      const existing = await tx.query<{ id: string; request_id: string }>(
        `select id, request_id from bookings where id = $1`,
        [old.resource_id],
      );
      if (
        !existing.rows[0] ||
        existing.rows[0].request_id !== booking.requestId
      ) {
        throw new Error("BOOKING_IDEMPOTENCY_RECORD_INCONSISTENT");
      }
      return { outcome: "already_exists", bookingId: old.resource_id };
    }

    // Only a new booking must have a currently bookable Quote. A retry can
    // retrieve an existing result even after the initial Quote expires.
    assertQuoteBookable(quote, now);

    await tx.query(
      `insert into quotes
        (id, product_id, offer_id, status, price_state, service_date, pax,
         total_amount, currency, availability_snapshot, created_at, expires_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12)`,
      [
        quote.id,
        quote.productId,
        quote.offerId,
        quote.status,
        quote.priceState,
        quote.serviceDate,
        quote.pax,
        quote.total.amount,
        quote.total.currency,
        JSON.stringify(quote.availabilitySnapshot),
        quote.createdAt,
        quote.expiresAt,
      ],
    );
    for (const [index, line] of quote.lines.entries()) {
      await tx.query(
        `insert into quote_lines
          (quote_id, line_no, code, label, quantity, unit_price_amount,
           total_amount, currency)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          quote.id,
          index + 1,
          line.code,
          line.label,
          line.quantity,
          line.unitPrice.amount,
          line.total.amount,
          line.total.currency,
        ],
      );
    }
    await tx.query(
      `insert into bookings
        (id, request_id, customer_id, guest_name, guest_email, guest_phone,
         product_id, offer_id, quote_id, state, version, payment_status,
         service_date, pax, total_amount, currency, operational_data,
         created_at, updated_at)
       values
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
         $13, $14, $15, $16, $17::jsonb, $18, $19)`,
      [
        booking.id,
        booking.requestId,
        booking.customerId ?? null,
        booking.contact.name,
        booking.contact.email,
        booking.contact.phone,
        booking.productId,
        booking.offerId,
        booking.quoteId,
        booking.state,
        booking.version,
        booking.paymentStatus,
        booking.serviceDate,
        booking.pax,
        booking.total.amount,
        booking.total.currency,
        JSON.stringify(booking.operationalData ?? {}),
        booking.createdAt,
        booking.updatedAt,
      ],
    );
    // Ops notifications are never synchronous with booking creation.
    // The eventual publisher may only consume this committed outbox row.
    await tx.query(
      `insert into outbox_events
        (id, event_name, aggregate_type, aggregate_id, aggregate_version,
         payload, status, created_at)
       values ($1, $2, $3, $4, $5, $6::jsonb, 'pending', $7)`,
      [
        crypto.randomUUID(),
        "booking.requested",
        "booking",
        booking.id,
        booking.version,
        JSON.stringify({
          bookingId: booking.id,
          productId: booking.productId,
          offerId: booking.offerId,
          serviceDate: booking.serviceDate,
          pax: booking.pax,
          state: booking.state,
        }),
        booking.createdAt,
      ],
    );
    return { outcome: "created", bookingId: booking.id };
  });
}
