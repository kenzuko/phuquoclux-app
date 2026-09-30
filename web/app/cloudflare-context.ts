export type PhuQuocLuxEnv = {
  MAP_STYLE_URL?: string;
  WEATHER_RUNTIME_BASE_URL?: string;
  COMMERCE_MODE?: "prototype" | "live";
};

export type WorkerExecutionContext = {
  waitUntil?: (promise: Promise<unknown>) => void;
  passThroughOnException?: () => void;
};

declare module "react-router" {
  interface AppLoadContext {
    cloudflare: {
      env: PhuQuocLuxEnv;
      ctx: WorkerExecutionContext;
      requestId: string;
    };
  }
}
