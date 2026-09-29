import type {
  AvailabilityRequest,
  AvailabilityResult,
} from "../domain/commerce";
import type { ProductType } from "../domain/catalog";
import type { ProviderAdapter } from "../domain/provider";
import { ManualRequestProviderAdapter } from "../providers/manual-request.server";

const manualRequest = new ManualRequestProviderAdapter();

const providerByProductType: Record<ProductType, ProviderAdapter> = {
  tour: manualRequest,
  ticket: manualRequest,
  transfer: manualRequest,
};

export async function checkAvailabilityForProduct(
  type: ProductType,
  input: AvailabilityRequest,
): Promise<AvailabilityResult> {
  const provider = providerByProductType[type];

  return provider.checkAvailability(input, {
    providerId: provider.id,
    requestId: crypto.randomUUID(),
    now: new Date().toISOString(),
  });
}

export function providerForProduct(type: ProductType) {
  return providerByProductType[type];
}
