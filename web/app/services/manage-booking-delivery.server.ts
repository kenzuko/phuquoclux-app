/**
 * Delivery boundary for future manage-booking links.
 *
 * This file defines link construction and provider contracts only. It does not
 * send email/SMS and must never log or persist the raw capability URL.
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

  return new URL(
    `/manage/${rawAccessToken}`,
    origin.origin,
  ).toString();
}
