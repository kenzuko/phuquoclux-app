import type {
  Booking,
  BookingEvent,
  BookingState,
  Quote,
  QuoteStatus,
} from "../domain/commerce";

export interface QuoteRepository {
  save(quote: Quote): Promise<void>;
  findById(id: string): Promise<Quote | null>;
  updateStatus(id: string, status: QuoteStatus): Promise<void>;
}

export interface BookingRepository {
  create(booking: Booking): Promise<void>;
  findById(id: string): Promise<Booking | null>;
  findByRequestId(requestId: string): Promise<Booking | null>;
  transition(
    id: string,
    expectedFrom: BookingState,
    event: BookingEvent,
  ): Promise<Booking>;
}

export interface IdempotencyRepository {
  findBookingId(requestId: string): Promise<string | null>;
  claim(requestId: string, bookingId: string): Promise<boolean>;
}

export type CommerceRepositories = {
  quotes: QuoteRepository;
  bookings: BookingRepository;
  idempotency: IdempotencyRepository;
};

/**
 * PostgreSQL is the future transactional source of truth.
 * No cache implementation should satisfy this interface in production.
 */
export interface CommerceRepositoryFactory {
  create(): Promise<CommerceRepositories>;
}
