import { cloudflareRequestContext } from "../cloudflare-context";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  exchangeManageBookingRequest,
  manageBookingExchangeConfigured,
} from "../services/manage-booking-exchange.server";
import { assertSameOriginMutation } from "../services/request-validation.server";

function methodNotAllowed() {
  return new Response("Method not allowed", {
    status: 405,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
      Allow: "POST",
    },
  });
}

export async function loader(_args: LoaderFunctionArgs) {
  return methodNotAllowed();
}

export async function action({ request, context }: ActionFunctionArgs) {
  const runtime = context.get(cloudflareRequestContext);

  // Do not even parse a bearer token unless every non-secret runtime
  // prerequisite and the reviewed DB transaction adapter are present.
  if (
    !manageBookingExchangeConfigured(runtime.env) ||
    !runtime.manageBookingDatabase
  ) {
    return exchangeManageBookingRequest({
      request,
      rawAccessToken: undefined,
      env: runtime.env,
      database: runtime.manageBookingDatabase,
    });
  }

  assertSameOriginMutation(request);

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 1024) {
    return exchangeManageBookingRequest({
      request,
      rawAccessToken: undefined,
      env: runtime.env,
      database: runtime.manageBookingDatabase,
    });
  }

  let rawAccessToken: string | undefined;
  try {
    const form = await request.formData();
    const candidate = form.get("token");
    rawAccessToken =
      typeof candidate === "string" && candidate.length <= 64
        ? candidate
        : undefined;
  } catch {
    rawAccessToken = undefined;
  }

  return exchangeManageBookingRequest({
    request,
    rawAccessToken,
    env: runtime.env,
    database: runtime.manageBookingDatabase,
  });
}
