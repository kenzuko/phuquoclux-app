import { createRequestHandler, RouterContextProvider } from "react-router";
import {
  cloudflareRequestContext,
  type PhuQuocLuxEnv,
  type WorkerExecutionContext,
} from "../app/cloudflare-context";
import {
  createHyperdrivePostgresTransactionManager,
} from "../app/repositories/hyperdrive-postgres.server";

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
  const manageLink =
    url.pathname === "/manage" || url.pathname.startsWith("/manage/");
  headers.set(
    "Referrer-Policy",
    manageLink ? "no-referrer" : "strict-origin-when-cross-origin",
  );
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
    url.pathname === "/bookings" ||
    manageLink;

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
    const routerContext = new RouterContextProvider();

    let manageBookingDatabase;
    if (env.HYPERDRIVE) {
      try {
        manageBookingDatabase =
          createHyperdrivePostgresTransactionManager(env.HYPERDRIVE);
      } catch {
        // Invalid/missing runtime binding fails closed. Never log a connection
        // string or turn this into a fallback credential path.
        manageBookingDatabase = undefined;
      }
    }

    routerContext.set(cloudflareRequestContext, {
      env,
      ctx,
      requestId,
      manageBookingDatabase,
    });
    const response = await requestHandler(request, routerContext);

    return withResponsePolicy(request, response, requestId);
  },
};
