import type { LoaderFunctionArgs } from "react-router";
import { getCommerceMode } from "../services/commerce-mode.server";

export async function loader({ context }: LoaderFunctionArgs) {
  const commerceMode = getCommerceMode(context.cloudflare.env);
  const mapStyleUrl = context.cloudflare.env.MAP_STYLE_URL ?? "";
  const mapStyleProductionReady =
    Boolean(mapStyleUrl) &&
    !mapStyleUrl.includes("demotiles.maplibre.org");

  return Response.json({
    ok: true,
    service: "phuquoclux-web",
    architecture: "map-first-commerce",
    readiness: {
      productionDeployEnabled: false,
      mapStyleProductionReady,
    },
    commerce: {
      mode: commerceMode,
      postgresConnected: false,
      paymentConnected: false,
      liveInventoryConnected: false,
      guestBookingAccessConnected: false,
      opsOutboxConnected: false,
    },
    time: new Date().toISOString(),
  });
}
