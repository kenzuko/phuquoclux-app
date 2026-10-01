/**
 * Authenticated, guest-safe booking read model.
 *
 * Authorization and booking read happen in the same PostgreSQL transaction.
 * The caller supplies only the opaque session cookie; there is no booking id,
 * email, phone or query-string selector that can widen access.
 */
import type {
  BookingOperationalData,
  BookingState,
  PaymentStatus,
  QuotePriceState,
} from "../domain/commerce";
import { hashManageBookingSessionToken } from "./postgres-booking-session.server";
import type { SqlTransactionManager } from "./postgres-booking-core.server";

export type ManagedBookingView = {
  productId: string;
  offerId: string;
  state: BookingState;
  paymentStatus: PaymentStatus;
  priceState: QuotePriceState;
  serviceDate: string;
  pax: number;
  total: {
    amount: number;
    currency: "VND";
  };
  operationalData?: Pick<
    BookingOperationalData,
    "hotelOrPickup" | "flightNumber" | "luggageCount"
  >;
  voucherRef?: string;
  updatedAt: string;
};

const bookingStates = new Set<BookingState>([
  "draft",
  "pending_payment",
  "paid",
  "pending_confirmation",
  "confirmed",
  "fulfilled",
  "cancel_requested",
  "cancelled",
  "refund_pending",
  "refunded",
  "failed",
  "expired",
]);

const paymentStates = new Set<PaymentStatus>([
  "unpaid",
  "authorized",
  "paid",
  "partially_refunded",
  "refunded",
  "failed",
]);

const priceStates = new Set<QuotePriceState>(["estimated", "final"]);

function safeInteger(value: unknown) {
  const parsed =
    typeof value === "string" && /^-?\d+$/.test(value)
      ? Number(value)
      : value;
  return typeof parsed === "number" &&
    Number.isSafeInteger(parsed)
    ? parsed
    : null;
}

function optionalString(value: unknown, maxLength: number) {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value !== "string" || value.length > maxLength) {
    throw new Error("MANAGED_BOOKING_RECORD_INVALID");
  }
  return value;
}

function safeOperationalData(value: unknown): ManagedBookingView["operationalData"] {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("MANAGED_BOOKING_RECORD_INVALID");
  }

  const source = value as Record<string, unknown>;
  const hotelOrPickup = optionalString(source.hotelOrPickup, 300);
  const flightNumber = optionalString(source.flightNumber, 16);
  const luggageCount =
    source.luggageCount === null || source.luggageCount === undefined
      ? undefined
      : safeInteger(source.luggageCount);

  if (
    luggageCount !== undefined &&
    (luggageCount === null || luggageCount < 0 || luggageCount > 20)
  ) {
    throw new Error("MANAGED_BOOKING_RECORD_INVALID");
  }

  if (
    hotelOrPickup === undefined &&
    flightNumber === undefined &&
    luggageCount === undefined
  ) {
    return undefined;
  }

  return {
    hotelOrPickup,
    flightNumber,
    luggageCount,
  };
}

function rowToManagedBooking(row: {
  product_id: unknown;
  offer_id: unknown;
  state: unknown;
  payment_status: unknown;
  price_state: unknown;
  service_date: unknown;
  pax: unknown;
  total_amount: unknown;
  currency: unknown;
  operational_data: unknown;
  voucher_ref: unknown;
  updated_at: unknown;
}): ManagedBookingView {
  if (
    typeof row.product_id !== "string" ||
    !row.product_id ||
    typeof row.offer_id !== "string" ||
    !row.offer_id ||
    !bookingStates.has(row.state as BookingState) ||
    !paymentStates.has(row.payment_status as PaymentStatus) ||
    !priceStates.has(row.price_state as QuotePriceState) ||
    row.currency !== "VND"
  ) {
    throw new Error("MANAGED_BOOKING_RECORD_INVALID");
  }

  const serviceDate =
    row.service_date instanceof Date
      ? row.service_date.toISOString().slice(0, 10)
      : String(row.service_date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
    throw new Error("MANAGED_BOOKING_RECORD_INVALID");
  }

  const pax = safeInteger(row.pax);
  const amount = safeInteger(row.total_amount);
  if (
    pax === null ||
    pax <= 0 ||
    pax > 20 ||
    amount === null ||
    amount < 0
  ) {
    throw new Error("MANAGED_BOOKING_RECORD_INVALID");
  }

  const updated = new Date(row.updated_at as string | Date);
  if (!Number.isFinite(updated.getTime())) {
    throw new Error("MANAGED_BOOKING_RECORD_INVALID");
  }

  return {
    productId: row.product_id,
    offerId: row.offer_id,
    state: row.state as BookingState,
    paymentStatus: row.payment_status as PaymentStatus,
    priceState: row.price_state as QuotePriceState,
    serviceDate,
    pax,
    total: { amount, currency: "VND" },
    operationalData: safeOperationalData(row.operational_data),
    voucherRef: optionalString(row.voucher_ref, 240),
    updatedAt: updated.toISOString(),
  };
}

export async function readManagedBookingBySession(
  database: SqlTransactionManager,
  rawSessionToken: string,
  now = new Date(),
): Promise<ManagedBookingView | null> {
  const sessionHash = await hashManageBookingSessionToken(rawSessionToken);
  if (!sessionHash) return null;

  return database.transaction(async (tx) => {
    const result = await tx.query<{
      session_id: string;
      product_id: unknown;
      offer_id: unknown;
      state: unknown;
      payment_status: unknown;
      price_state: unknown;
      service_date: unknown;
      pax: unknown;
      total_amount: unknown;
      currency: unknown;
      operational_data: unknown;
      voucher_ref: unknown;
      updated_at: unknown;
    }>(
      `select s.id as session_id,
              b.product_id, b.offer_id, b.state, b.payment_status,
              q.price_state, b.service_date, b.pax, b.total_amount, b.currency,
              b.operational_data, b.voucher_ref, b.updated_at
         from booking_access_sessions s
         join booking_access_tokens g
           on g.id = s.access_grant_id
          and g.booking_id = s.booking_id
         join bookings b on b.id = s.booking_id
         join quotes q on q.id = b.quote_id
        where s.session_hash = $1
          and s.revoked_at is null
          and s.expires_at > $2
          and g.purpose = 'manage_booking'
          and g.revoked_at is null
          and g.expires_at > $2
        for update of s`,
      [sessionHash, now.toISOString()],
    );

    const row = result.rows[0];
    if (!row) return null;

    const touched = await tx.query<{ id: string }>(
      `update booking_access_sessions
          set last_used_at = $2
        where id = $1
          and revoked_at is null
          and expires_at > $2
        returning id`,
      [row.session_id, now.toISOString()],
    );
    if (!touched.rows[0]) return null;

    return rowToManagedBooking(row);
  });
}
