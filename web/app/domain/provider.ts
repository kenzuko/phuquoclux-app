import type {
  AvailabilityRequest,
  AvailabilityResult,
  Booking,
  Quote,
} from "./commerce";

export type ProviderCapability =
  | "availability"
  | "pricing"
  | "hold"
  | "confirm"
  | "modify"
  | "cancel"
  | "voucher";

export type ProviderContext = {
  providerId: string;
  requestId: string;
  now: string;
};

export type ConfirmBookingInput = {
  booking: Booking;
  quote: Quote;
};

export type ProviderConfirmation = {
  providerReference: string;
  confirmedAt: string;
  voucherRef?: string;
};

export interface ProviderAdapter {
  readonly id: string;
  readonly capabilities: ReadonlySet<ProviderCapability>;

  checkAvailability(
    input: AvailabilityRequest,
    context: ProviderContext,
  ): Promise<AvailabilityResult>;

  createQuote?(
    input: AvailabilityRequest,
    context: ProviderContext,
  ): Promise<Quote>;

  confirmBooking?(
    input: ConfirmBookingInput,
    context: ProviderContext,
  ): Promise<ProviderConfirmation>;

  cancelBooking?(
    booking: Booking,
    context: ProviderContext,
  ): Promise<{ cancelledAt: string; providerReference?: string }>;

  getVoucher?(
    booking: Booking,
    context: ProviderContext,
  ): Promise<{ voucherRef: string }>;
}

export function supports(
  adapter: ProviderAdapter,
  capability: ProviderCapability,
) {
  return adapter.capabilities.has(capability);
}
