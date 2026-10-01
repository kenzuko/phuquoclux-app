import { cloudflareRequestContext } from "../cloudflare-context";
import type { LoaderFunctionArgs } from "react-router";
import { exchangeManageBookingRequest } from "../services/manage-booking-exchange.server";

/**
 * Resource route only. It never renders the raw capability into HTML.
 * Current Worker runtime leaves manageBookingDatabase undefined, so even an
 * accidentally enabled flag cannot create a session without the reviewed DB
 * adapter being injected.
 */
export async function loader({
  request,
  params,
  context,
}: LoaderFunctionArgs) {
  const runtime = context.get(cloudflareRequestContext);

  return exchangeManageBookingRequest({
    request,
    rawAccessToken: params.token,
    env: runtime.env,
    database: runtime.manageBookingDatabase,
  });
}
