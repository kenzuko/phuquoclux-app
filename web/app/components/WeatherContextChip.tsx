import type { WeatherContextSummary } from "../domain/weather-context";

export function WeatherContextChip({
  weather,
}: {
  weather: WeatherContextSummary | null;
}) {
  if (!weather) return null;

  if (weather.status === "stale") {
    return (
      <a
        className="weather-context-chip weather-context-chip--stale"
        href="https://weather.openphuquoc.com"
        target="_blank"
        rel="noreferrer"
        aria-label="Mở thời tiết Phú Quốc. Dữ liệu hiện tại đang cập nhật chậm."
      >
        <span>☁</span>
        <span>
          <b>{weather.pointName}</b>
          <small>Thời tiết đang cập nhật</small>
        </span>
      </a>
    );
  }

  const icon = weather.rainRateMmH >= 0.1 ? "🌦" : "☀";

  return (
    <a
      className="weather-context-chip"
      href="https://weather.openphuquoc.com"
      target="_blank"
      rel="noreferrer"
      aria-label={
        `Mở thời tiết Phú Quốc. ${weather.pointName}, ` +
        `${weather.temperatureC} độ C, ${weather.rainLabel}.`
      }
    >
      <span>{icon}</span>
      <span>
        <b>
          {weather.pointName} · {Math.round(weather.temperatureC)}°C
        </b>
        <small>{weather.rainLabel}</small>
      </span>
    </a>
  );
}
