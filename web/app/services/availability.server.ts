import type {
  AvailabilityRequest,
  AvailabilityResult,
} from "../domain/commerce";
import type { Offer } from "../domain/offer";
import type { ProviderAdapter } from "../domain/provider";
import { ManualRequestProviderAdapter } from "../providers/manual-request.server";

const providers: Record<string, ProviderAdapter> = {
  "jotrip-manual-request": new ManualRequestProviderAdapter(),
};

export async function checkAvailabilityForOffer(
  offer: Offer,
  input: AvailabilityRequest,
  requestId: string = crypto.randomUUID(),
): Promise<AvailabilityResult> {
  const provider = providers[offer.providerId];

  if (!provider) {
    return {
      state: "unknown",
      checkedAt: new Date().toISOString(),
      source: "manual",
      note: `Provider adapter not configured: ${offer.providerId}`,
    };
  }

  return provider.checkAvailability(input, {
    providerId: provider.id,
    requestId,
    now: new Date().toISOString(),
  });
}

export function providerForOffer(offer: Offer) {
  return providers[offer.providerId];
}
