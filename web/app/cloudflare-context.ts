import { createContext } from "react-router";

export type PhuQuocLuxEnv = {
  MAP_STYLE_URL?: string;
  WEATHER_RUNTIME_BASE_URL?: string;
  COMMERCE_MODE?: "prototype" | "live";
};

export type WorkerExecutionContext = {
  waitUntil?: (promise: Promise<unknown>) => void;
  passThroughOnException?: () => void;
};

export const cloudflareRequestContext = createContext<{
  env: PhuQuocLuxEnv;
  ctx: WorkerExecutionContext;
  requestId: string;
}>();
