const INTERNAL_BASE = "https://phuquoclux.invalid";
const allowedReturnPaths = new Set(["/", "/map"]);

export function safeReturnTo(
  raw: string | null | undefined,
  fallback = "/map",
) {
  if (!raw || raw.length > 1800 || raw.startsWith("//")) {
    return fallback;
  }

  try {
    const url = new URL(raw, INTERNAL_BASE);
    if (url.origin !== INTERNAL_BASE) return fallback;
    if (!allowedReturnPaths.has(url.pathname)) return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}

export function withReturnTo(
  relativeUrl: string,
  returnTo: string,
) {
  const target = new URL(relativeUrl, INTERNAL_BASE);
  target.searchParams.set(
    "returnTo",
    safeReturnTo(returnTo, "/"),
  );
  return `${target.pathname}${target.search}`;
}
