import type {
  ManageBookingDeliveryProvider,
  ManageBookingDeliveryRequest,
  ManageBookingDeliveryResult,
} from "./manage-booking-delivery.server";

type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export type ResendManageBookingDeliveryConfig = {
  apiKey: string;
  from: string;
  subject?: string;
  fetcher?: FetchLike;
};

const RESEND_EMAIL_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_SUBJECT = "Manage your Phu Quoc booking";

function configuredString(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export function resendManageBookingDeliveryConfigured(
  config: Partial<ResendManageBookingDeliveryConfig>,
) {
  return Boolean(configuredString(config.apiKey) && configuredString(config.from));
}

function deliveryFailure(status: number): ManageBookingDeliveryResult {
  if (status === 401 || status === 403) {
    return { accepted: false, errorCode: "DELIVERY_AUTH_FAILED" };
  }
  if (status === 408 || status === 504) {
    return { accepted: false, errorCode: "DELIVERY_TIMEOUT" };
  }
  if (status === 429) {
    return { accepted: false, errorCode: "DELIVERY_RATE_LIMITED" };
  }
  if (status === 400 || status === 409 || status === 422) {
    return { accepted: false, errorCode: "DELIVERY_REJECTED" };
  }
  if (status >= 500) {
    return { accepted: false, errorCode: "DELIVERY_NETWORK" };
  }
  return { accepted: false, errorCode: "DELIVERY_FAILED" };
}

function messageText(input: ManageBookingDeliveryRequest) {
  return [
    "Your Phu Quoc booking request has been received.",
    "",
    "Open this private link to view or manage your booking:",
    input.manageUrl,
    "",
    `This link expires at ${input.expiresAt}.`,
    "If you did not make this request, you can ignore this email.",
  ].join("\n");
}

export function createResendManageBookingDeliveryProvider(
  config: ResendManageBookingDeliveryConfig,
): ManageBookingDeliveryProvider {
  const apiKey = configuredString(config.apiKey);
  const from = configuredString(config.from);
  if (!apiKey || !from) {
    throw new Error("RESEND_MANAGE_BOOKING_CONFIG_INVALID");
  }

  const subject = configuredString(config.subject) ?? DEFAULT_SUBJECT;
  const fetcher = config.fetcher ?? fetch;

  return {
    async deliver(input) {
      if (input.channel !== "email") {
        return {
          accepted: false,
          errorCode: "HANDLER_UNSUPPORTED_EVENT",
        };
      }

      let response: Response;
      try {
        response = await fetcher(RESEND_EMAIL_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            // Stable for one initial manage-link delivery per booking. Resend
            // deduplicates identical retries for 24 hours.
            "Idempotency-Key": `manage-booking/${input.bookingId}`,
          },
          body: JSON.stringify({
            from,
            to: [input.destination],
            subject,
            text: messageText(input),
          }),
        });
      } catch {
        return { accepted: false, errorCode: "DELIVERY_NETWORK" };
      }

      if (!response.ok) return deliveryFailure(response.status);

      let providerMessageId: string | undefined;
      try {
        const payload = (await response.json()) as { id?: unknown };
        if (typeof payload.id === "string" && payload.id.length > 0) {
          providerMessageId = payload.id;
        }
      } catch {
        // Delivery acceptance is determined by HTTP status. A malformed success
        // body must not cause a second email to be sent on retry.
      }

      return {
        accepted: true,
        ...(providerMessageId ? { providerMessageId } : {}),
      };
    },
  };
}
