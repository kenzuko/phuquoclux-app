export type PhuQuocLuxEnv = {
  MAP_STYLE_URL?: string;
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
    };
  }
}
