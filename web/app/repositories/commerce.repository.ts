import type {
  Booking,
  BookingEvent,
  BookingState,
  Quote,
  QuoteStatus,
} from "../domain/commerce";
import type {
  BookingAccessGrant,
  NewBookingAccessGrant,
} from "../domain/booking-access";

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
    expectedVersion: number,
    expectedFrom: BookingState,
    event: BookingEvent,
  ): Promise<Booking>;
}

export interface BookingAccessRepository {
  create(grant: NewBookingAccessGrant): Promise<BookingAccessGrant>;
  findByTokenHash(
    tokenHash: string,
  ): Promise<BookingAccessGrant | null>;
  revoke(id: string, revokedAt: string): Promise<void>;
  touch(id: string, lastUsedAt: string): Promise<void>;
}

export interface IdempotencyRepository {
  findBookingId(requestId: string): Promise<string | null>;
  claim(requestId: string, bookingId: string): Promise<boolean>;
}

export type CommerceRepositories = {
  quotes: QuoteRepository;
  bookings: BookingRepository;
  bookingAccess: BookingAccessRepository;
  idempotency: IdempotencyRepository;
};

/**
 * PostgreSQL is the future transactional source of truth.
 * No cache implementation should satisfy this interface in production.
 */
export interface CommerceRepositoryFactory {
  create(): Promise<CommerceRepositories>;
}
