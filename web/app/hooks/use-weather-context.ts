import { useEffect, useState } from "react";
import type {
  WeatherContextSummary,
  WeatherPointId,
} from "../domain/weather-context";

export function useWeatherContext(
  pointId: WeatherPointId | undefined,
) {
  const [weather, setWeather] =
    useState<WeatherContextSummary | null>(null);

  useEffect(() => {
    setWeather(null);
    if (!pointId) return;

    const controller = new AbortController();

    void fetch(
      `/api/context/weather?point=${encodeURIComponent(pointId)}`,
      {
        headers: { accept: "application/json" },
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        if (!response.ok) return null;
        const payload = (await response.json()) as {
          ok?: boolean;
          weather?: WeatherContextSummary;
        };
        return payload.ok ? payload.weather ?? null : null;
      })
      .then((value) => {
        if (value) setWeather(value);
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [pointId]);

  return weather;
}
