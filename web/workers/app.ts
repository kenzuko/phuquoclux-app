import { createRequestHandler } from "react-router";
import type {
  PhuQuocLuxEnv,
  WorkerExecutionContext,
} from "../app/cloudflare-context";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

function withSecurityHeaders(request: Request, response: Response) {
  const headers = new Headers(response.headers);

  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(self)",
  );

  if (new URL(request.url).protocol === "https:") {
    headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
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
    const response = await requestHandler(request, {
      cloudflare: { env, ctx },
    });

    return withSecurityHeaders(request, response);
  },
};
