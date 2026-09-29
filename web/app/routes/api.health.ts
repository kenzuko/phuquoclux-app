import type { LoaderFunctionArgs } from "react-router";
import { getCommerceMode } from "../services/commerce-mode.server";

export async function loader({ context }: LoaderFunctionArgs) {
  const commerceMode = getCommerceMode(context.cloudflare.env);

  return Response.json({
    ok: true,
    service: "phuquoclux-web",
    architecture: "map-first-commerce",
    commerce: {
      mode: commerceMode,
      postgresConnected: false,
      paymentConnected: false,
      liveInventoryConnected: false,
      opsOutboxConnected: false,
    },
    time: new Date().toISOString(),
  });
}
