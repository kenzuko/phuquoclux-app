import type { BookingState, PaymentStatus } from "./commerce";

export type DomainEventName =
  | "booking.requested"
  | "booking.state_changed"
  | "booking.confirmed"
  | "booking.cancel_requested"
  | "payment.state_changed";

export type DomainEvent<TPayload = Record<string, unknown>> = {
  id: string;
  name: DomainEventName;
  aggregateType: "booking" | "payment";
  aggregateId: string;
  occurredAt: string;
  version: number;
  payload: TPayload;
};

export type BookingRequestedPayload = {
  bookingId: string;
  productId: string;
  offerId: string;
  serviceDate: string;
  pax: number;
  state: BookingState;
};

export type BookingStateChangedPayload = {
  bookingId: string;
  fromState: BookingState;
  toState: BookingState;
};

export type PaymentStateChangedPayload = {
  bookingId: string;
  paymentId: string;
  status: PaymentStatus;
};

export function createDomainEvent<TPayload>(
  input: Omit<DomainEvent<TPayload>, "id" | "occurredAt">,
): DomainEvent<TPayload> {
  return {
    ...input,
    id: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
  };
}
