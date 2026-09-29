import { createRequestHandler } from "react-router";
import type {
  PhuQuocLuxEnv,
  WorkerExecutionContext,
} from "../app/cloudflare-context";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

function withResponsePolicy(
  request: Request,
  response: Response,
  requestId: string,
) {
  const headers = new Headers(response.headers);
  const url = new URL(request.url);

  headers.set("X-Request-Id", requestId);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(self)",
  );

  if (url.protocol === "https:") {
    headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }

  const sensitivePage =
    url.pathname.startsWith("/checkout/") ||
    url.pathname === "/bookings";

  if (sensitivePage) {
    headers.set("Cache-Control", "private, no-store, max-age=0");
    headers.set("Pragma", "no-cache");
    headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  if (url.pathname === "/api/health") {
    headers.set("Cache-Control", "no-store");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(
    request: Request,
    env: PhuQuocLuxEnv,
    ctx: WorkerExecutionContext,
  ) {
    const requestId = crypto.randomUUID();
    const response = await requestHandler(request, {
      cloudflare: { env, ctx, requestId },
    });

    return withResponsePolicy(request, response, requestId);
  },
};
