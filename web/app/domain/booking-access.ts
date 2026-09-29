export type BookingAccessPurpose = "manage_booking";

export type BookingAccessGrant = {
  id: string;
  bookingId: string;
  purpose: BookingAccessPurpose;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
  lastUsedAt?: string;
};

export type NewBookingAccessGrant = Omit<
  BookingAccessGrant,
  "id" | "createdAt" | "lastUsedAt" | "revokedAt"
>;

export function isBookingAccessActive(
  grant: BookingAccessGrant,
  now = new Date(),
) {
  return (
    !grant.revokedAt &&
    new Date(grant.expiresAt).getTime() > now.getTime()
  );
}
