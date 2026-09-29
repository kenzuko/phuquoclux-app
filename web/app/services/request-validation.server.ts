export function assertSameOriginMutation(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("Origin");
  const fetchSite = request.headers.get("Sec-Fetch-Site");

  if (origin && origin !== requestUrl.origin) {
    throw new Response("Cross-origin mutation rejected", { status: 403 });
  }

  if (fetchSite === "cross-site") {
    throw new Response("Cross-site mutation rejected", { status: 403 });
  }
}

type TextRule = {
  required?: boolean;
  maxLength: number;
};

export function readText(
  form: FormData,
  key: string,
  rule: TextRule,
) {
  const value = String(form.get(key) ?? "").trim();

  if (rule.required && !value) {
    throw new Response(`Missing field: ${key}`, { status: 400 });
  }

  if (value.length > rule.maxLength) {
    throw new Response(`Field too long: ${key}`, { status: 400 });
  }

  return value;
}

export function readEmail(form: FormData, key = "email") {
  const value = readText(form, key, { required: true, maxLength: 254 });
  const emailLike = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailLike.test(value)) {
    throw new Response("Invalid email", { status: 400 });
  }

  return value;
}

export function readPhone(form: FormData, key = "phone") {
  const value = readText(form, key, { required: true, maxLength: 32 });
  const phoneLike = /^[0-9+()\-.\s]{6,32}$/;

  if (!phoneLike.test(value)) {
    throw new Response("Invalid phone", { status: 400 });
  }

  return value;
}

export function readUuid(form: FormData, key: string) {
  const value = readText(form, key, { required: true, maxLength: 36 });
  const uuidLike =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidLike.test(value)) {
    throw new Response(`Invalid identifier: ${key}`, { status: 400 });
  }

  return value;
}
