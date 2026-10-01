import { cloudflareRequestContext } from "../cloudflare-context";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  exchangeManageBookingRequest,
  manageBookingExchangeConfigured,
} from "../services/manage-booking-exchange.server";
import { assertSameOriginMutation } from "../services/request-validation.server";

const MAX_EXCHANGE_BODY_BYTES = 1024;

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

async function readCapabilityFromSmallForm(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (
    !contentType
      .toLowerCase()
      .startsWith("application/x-www-form-urlencoded")
  ) {
    return undefined;
  }

  const reader = request.body?.getReader();
  if (!reader) return undefined;

  const decoder = new TextDecoder();
  let total = 0;
  let body = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_EXCHANGE_BODY_BYTES) {
        await reader.cancel();
        return undefined;
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
  } catch {
    return undefined;
  }

  const form = new URLSearchParams(body);
  const tokens = form.getAll("token");
  if (tokens.length !== 1) return undefined;

  const token = tokens[0];
  return token.length <= 64 ? token : undefined;
}

export async function loader(_args: LoaderFunctionArgs) {
  return methodNotAllowed();
}

export async function action({ request, context }: ActionFunctionArgs) {
  const runtime = context.get(cloudflareRequestContext);

  // Do not even read a bearer capability unless every non-secret runtime
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

  const rawAccessToken = await readCapabilityFromSmallForm(request);

  return exchangeManageBookingRequest({
    request,
    rawAccessToken,
    env: runtime.env,
    database: runtime.manageBookingDatabase,
  });
}
