import type { PhuQuocLuxEnv } from "../cloudflare-context";
import {
  parseWeatherContext,
  type WeatherContextSummary,
} from "../domain/weather-context";

const DEFAULT_WEATHER_RUNTIME_BASE =
  "https://weather.openphuquoc.com";
const RUNTIME_PATH = "/data/weather-runtime/current.json";
const FETCH_TIMEOUT_MS = 900;
const MEMORY_CACHE_MS = 60_000;

type CacheEntry = {
  value: WeatherContextSummary | null;
  cachedAt: number;
};

const memoryCache = new Map<string, CacheEntry>();

function runtimeBase(env: PhuQuocLuxEnv) {
  return (
    env.WEATHER_RUNTIME_BASE_URL ??
    DEFAULT_WEATHER_RUNTIME_BASE
  ).replace(/\/+$/, "");
}

export async function getWeatherContext(
  env: PhuQuocLuxEnv,
  pointId: string,
  now = new Date(),
): Promise<WeatherContextSummary | null> {
  const cacheKey = `${runtimeBase(env)}:${pointId}`;
  const cached = memoryCache.get(cacheKey);

  if (
    cached &&
    now.getTime() - cached.cachedAt < MEMORY_CACHE_MS
  ) {
    return cached.value;
  }

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    FETCH_TIMEOUT_MS,
  );

  try {
    const response = await fetch(
      `${runtimeBase(env)}${RUNTIME_PATH}`,
      {
        headers: {
          accept: "application/json",
          "user-agent": "phuquoclux-weather-context/1",
        },
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      memoryCache.set(cacheKey, {
        value: null,
        cachedAt: now.getTime(),
      });
      return null;
    }

    const payload = await response.json();
    const parsed = parseWeatherContext(payload, pointId, now);

    memoryCache.set(cacheKey, {
      value: parsed,
      cachedAt: now.getTime(),
    });

    return parsed;
  } catch {
    memoryCache.set(cacheKey, {
      value: null,
      cachedAt: now.getTime(),
    });
    return null;
  } finally {
    clearTimeout(timer);
  }
}
