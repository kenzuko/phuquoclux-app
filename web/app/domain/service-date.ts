const PHU_QUOC_TIME_ZONE = "Asia/Ho_Chi_Minh";

function partsInTimeZone(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PHU_QUOC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
  };
}

export function todayInPhuQuoc(now = new Date()) {
  const { year, month, day } = partsInTimeZone(now);
  return `${year}-${month}-${day}`;
}

function isValidCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function normalizeServiceDate(
  candidate: string | undefined,
  now = new Date(),
) {
  const today = todayInPhuQuoc(now);

  if (!candidate || !isValidCalendarDate(candidate)) {
    return today;
  }

  return candidate >= today ? candidate : today;
}

export const serviceTimeZone = PHU_QUOC_TIME_ZONE;


export function formatServiceDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;

  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}
