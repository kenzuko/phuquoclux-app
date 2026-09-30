import type { PhuQuocLuxEnv } from "../cloudflare-context";

export type CommerceMode = "prototype" | "live";

export function getCommerceMode(env: PhuQuocLuxEnv): CommerceMode {
  return env.COMMERCE_MODE === "live" ? "live" : "prototype";
}

export function assertPrototypeCommerce(mode: CommerceMode) {
  if (mode !== "prototype") {
    throw new Response(
      "Prototype commerce is disabled while COMMERCE_MODE=live",
      { status: 503 },
    );
  }
}
