# PhuQuocLux Weather Context V1

Date: 30/09/2026

## Purpose

PhuQuocLux may show a small destination-weather context inside its Map-first discovery experience.

This is not a second Weather product.

The specialized Weather system remains owned by:

- https://weather.openphuquoc.com
- JoTrip Weather runtime / Weather Lab

## Source boundary

Browser code in PhuQuocLux must not fetch raw Weather repositories, feature branches, GitHub raw files or legacy mirrors.

The PhuQuocLux server reads only the canonical public Weather runtime:

```
https://weather.openphuquoc.com/data/weather-runtime/current.json
```

The browser receives only a normalized, small summary from the page loader.

This preserves the Weather runtime source lock and avoids duplicating Weather data logic in the consumer app.

## V1 context

Home currently requests only the Dương Đông context:

- local temperature estimate;
- local rain-rate estimate;
- a human rain label;
- source freshness state.

The chip links to the full Weather product for detail.

## Freshness

The source timestamp is the point `analysis_time` when available.

Fallback is the normalized `local_now.generated_at`.

V1 states:

- `live`: age <= 30 minutes
- `stale`: age > 30 minutes
- unavailable: invalid payload, timeout, network failure or missing point

A stale value is never presented as live.

If the source is unavailable, PhuQuocLux simply omits the chip. Discovery and booking continue normally.

## Performance

Weather context is non-critical.

Rules:

- server-side fetch only;
- 900 ms timeout;
- best-effort in-isolate cache for 60 seconds;
- Weather failure must never block commerce or Map discovery beyond the timeout;
- no client polling in V1.

## Product boundary

Weather context must not:

- mark supplier inventory available;
- cancel or confirm a booking;
- silently remove a sellable product;
- infer marine operating permission;
- replace Weather/Marine operational decisions.

Any future weather-sensitive product rule requires an explicit provider/operations contract and a separate product decision layer.

## Human wording

The chip intentionally avoids model names, probabilities and technical weather diagnostics.

Current rain labels are a lightweight presentation transform:

- below 0.1 mm/h: Không mưa đáng kể
- below 2.5 mm/h: Mưa nhẹ
- below 7.5 mm/h: Mưa vừa
- 7.5 mm/h or above: Mưa lớn

The underlying value remains `ESTIMATED_NOW`, not a direct local observation.

## Configuration

Worker environment:

```
WEATHER_RUNTIME_BASE_URL=https://weather.openphuquoc.com
```

This remains configurable so staging can point to another canonical mirror without changing UI code.
