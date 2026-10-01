import { cloudflareRequestContext } from "../cloudflare-context";
import type { LoaderFunctionArgs } from "react-router";
import { getCommerceMode } from "../services/commerce-mode.server";
import { manageBookingExchangeConfigured } from "../services/manage-booking-exchange.server";

export async function loader({ context }: LoaderFunctionArgs) {
  const runtime = context.get(cloudflareRequestContext);
  const commerceMode = getCommerceMode(runtime.env);
  const manageBookingExchangeConfigReady =
    manageBookingExchangeConfigured(runtime.env);
  const manageBookingDatabaseInjected = Boolean(
    runtime.manageBookingDatabase,
  );
  const mapStyleUrl = runtime.env.MAP_STYLE_URL ?? "";
  const mapStyleProductionReady =
    Boolean(mapStyleUrl) &&
    !mapStyleUrl.includes("demotiles.maplibre.org");
  const weatherRuntimeConfigured = Boolean(
    runtime.env.WEATHER_RUNTIME_BASE_URL,
  );

  return Response.json({
    ok: true,
    service: "phuquoclux-web",
    architecture: "map-first-commerce",
    readiness: {
      productionDeployEnabled: false,
      mapStyleProductionReady,
      weatherRuntimeConfigured,
      manageBookingExchangeConfigReady,
      manageBookingDatabaseInjected,
    },
    commerce: {
      mode: commerceMode,
      postgresConnected: false,
      paymentConnected: false,
      liveInventoryConnected: false,
      guestBookingAccessConnected: false,
      manageBookingDeliveryConnected: false,
      opsOutboxConnected: false,
    },
    time: new Date().toISOString(),
  });
}
