import type {
  Booking,
  BookingOperationalData,
  BookingContact,
  Quote,
} from "../domain/commerce";

export type PrototypeBookingRequestInput = {
  requestId: string;
  quote: Quote;
  contact: BookingContact;
  operationalData?: BookingOperationalData;
};

/**
 * Creates an ephemeral booking-shaped object for validating state transitions.
 *
 * It is NOT persisted. PostgreSQL/repository wiring must replace this before
 * any production checkout is enabled.
 */
export function createPrototypeBookingRequest(
  input: PrototypeBookingRequestInput,
): Booking {
  const now = new Date().toISOString();
  const availability = input.quote.availabilitySnapshot.state;

  const state: Booking["state"] =
    availability === "request"
      ? "pending_confirmation"
      : availability === "available" || availability === "limited"
        ? "pending_payment"
        : "failed";

  return {
    id: crypto.randomUUID(),
    requestId: input.requestId,
    contact: input.contact,
    productType: input.quote.productType,
    productId: input.quote.productId,
    offerId: input.quote.offerId,
    quoteId: input.quote.id,
    state,
    paymentStatus: "unpaid",
    serviceDate: input.quote.serviceDate,
    pax: input.quote.pax,
    total: input.quote.total,
    operationalData: input.operationalData,
    createdAt: now,
    updatedAt: now,
  };
}
