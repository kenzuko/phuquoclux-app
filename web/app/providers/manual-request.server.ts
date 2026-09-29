import type {
  AvailabilityRequest,
  AvailabilityResult,
} from "../domain/commerce";
import type {
  ProviderAdapter,
  ProviderContext,
} from "../domain/provider";

export class ManualRequestProviderAdapter implements ProviderAdapter {
  readonly id = "jotrip-manual-request";
  readonly capabilities = new Set(["availability"] as const);

  async checkAvailability(
    _input: AvailabilityRequest,
    context: ProviderContext,
  ): Promise<AvailabilityResult> {
    const checkedAt = context.now;
    const expiresAt = new Date(
      new Date(checkedAt).getTime() + 5 * 60 * 1000,
    ).toISOString();

    return {
      state: "request",
      checkedAt,
      expiresAt,
      source: "manual",
      note:
        "Provider inventory chưa được nối. Yêu cầu cần JoTrip/supplier xác nhận.",
    };
  }
}
