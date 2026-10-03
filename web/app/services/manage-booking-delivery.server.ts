/**
 * Delivery boundary for manage-booking links.
 *
 * Provider implementations receive the raw capability only in memory. They must
 * never log or persist the raw capability URL. Provider-specific failures are
 * reduced to stable error codes before they can reach durable outbox state.
 */
export type ManageBookingDeliveryChannel = "email" | "sms";

export type ManageBookingDeliveryRequest = {
  bookingId: string;
  channel: ManageBookingDeliveryChannel;
  destination: string;
  manageUrl: string;
  expiresAt: string;
};

export type ManageBookingDeliveryResult = {
  accepted: boolean;
  providerMessageId?: string;
  errorCode?: string;
};

export interface ManageBookingDeliveryProvider {
  deliver(
    input: ManageBookingDeliveryRequest,
  ): Promise<ManageBookingDeliveryResult>;
}

const RAW_ACCESS_TOKEN_PATTERN = /^[0-9a-f]{64}$/;

export function buildManageBookingLink(
  canonicalOrigin: string,
  rawAccessToken: string,
) {
  if (!RAW_ACCESS_TOKEN_PATTERN.test(rawAccessToken)) {
    throw new Error("MANAGE_BOOKING_LINK_TOKEN_INVALID");
  }

  const origin = new URL(canonicalOrigin);
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    (origin.pathname !== "/" && origin.pathname !== "")
  ) {
    throw new Error("MANAGE_BOOKING_CANONICAL_ORIGIN_INVALID");
  }

  const manageUrl = new URL("/manage", origin.origin);
  // Fragment is intentionally client-side only: CDNs, access logs, referrers
  // and the first HTTP request never receive the raw bearer capability.
  manageUrl.hash = rawAccessToken;
  return manageUrl.toString();
}
