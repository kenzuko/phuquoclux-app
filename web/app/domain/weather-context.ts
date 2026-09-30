export type WeatherContextStatus = "live" | "stale";
export type WeatherPointId =
  | "duong_dong"
  | "an_thoi"
  | "ganh_dau";

export type WeatherContextSummary = {
  status: WeatherContextStatus;
  pointId: WeatherPointId;
  pointName: string;
  temperatureC: number;
  rainRateMmH: number;
  rainLabel: string;
  sourceTime: string;
  ageMinutes: number;
  dataClass: "ESTIMATED_NOW";
};

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function finite(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function weatherRainLabel(rateMmH: number) {
  if (rateMmH < 0.1) return "Không mưa đáng kể";
  if (rateMmH < 2.5) return "Mưa nhẹ";
  if (rateMmH < 7.5) return "Mưa vừa";
  return "Mưa lớn";
}

export function parseWeatherContext(
  payload: unknown,
  pointId: WeatherPointId,
  now = new Date(),
): WeatherContextSummary | null {
  const root = record(payload);
  const localNow = record(root?.local_now);
  const points = record(localNow?.points);
  const point = record(points?.[pointId]);
  const rain = record(point?.rain);

  if (!localNow || !point || !rain) return null;

  const temperatureC = finite(point.temperature_c);
  const rainRateMmH = finite(rain.rain_rate_mm_h);
  const pointName =
    typeof point.name === "string" ? point.name.trim() : "";
  const sourceTime =
    typeof point.analysis_time === "string"
      ? point.analysis_time
      : typeof localNow.generated_at === "string"
        ? localNow.generated_at
        : "";

  if (
    temperatureC === null ||
    rainRateMmH === null ||
    !pointName ||
    !sourceTime
  ) {
    return null;
  }

  const sourceMs = Date.parse(sourceTime);
  if (!Number.isFinite(sourceMs)) return null;

  const ageMinutes = Math.max(
    0,
    Math.round((now.getTime() - sourceMs) / 60_000),
  );

  return {
    status: ageMinutes <= 30 ? "live" : "stale",
    pointId,
    pointName,
    temperatureC: Math.round(temperatureC * 10) / 10,
    rainRateMmH: Math.max(0, Math.round(rainRateMmH * 100) / 100),
    rainLabel: weatherRainLabel(Math.max(0, rainRateMmH)),
    sourceTime,
    ageMinutes,
    dataClass: "ESTIMATED_NOW",
  };
}
