import { createRequestHandler } from "react-router";
import type {
  PhuQuocLuxEnv,
  WorkerExecutionContext,
} from "../app/cloudflare-context";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(
    request: Request,
    env: PhuQuocLuxEnv,
    ctx: WorkerExecutionContext,
  ) {
    return requestHandler(request, {
      cloudflare: { env, ctx },
    });
  },
};
