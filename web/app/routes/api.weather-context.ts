import type { LoaderFunctionArgs } from "react-router";
import { getWeatherContext } from "../services/weather-context.server";
import type { WeatherPointId } from "../domain/weather-context";

const allowedPoints = new Set<WeatherPointId>([
  "duong_dong",
  "an_thoi",
  "ganh_dau",
]);

function isWeatherPointId(value: string): value is WeatherPointId {
  return allowedPoints.has(value as WeatherPointId);
}

export async function loader({
  request,
  context,
}: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const pointId = url.searchParams.get("point") ?? "duong_dong";

  if (!isWeatherPointId(pointId)) {
    return Response.json(
      { ok: false, error: "unsupported_point" },
      {
        status: 400,
        headers: { "cache-control": "no-store" },
      },
    );
  }

  const weather = await getWeatherContext(
    context.cloudflare.env,
    pointId,
  );

  if (!weather) {
    return Response.json(
      { ok: false, error: "weather_unavailable" },
      {
        status: 503,
        headers: { "cache-control": "no-store" },
      },
    );
  }

  return Response.json(
    { ok: true, weather },
    {
      headers: {
        "cache-control": "public, max-age=30, s-maxage=60",
      },
    },
  );
}
