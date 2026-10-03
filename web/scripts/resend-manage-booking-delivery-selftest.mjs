import assert from "node:assert/strict";
import {
  createResendManageBookingDeliveryProvider,
  resendManageBookingDeliveryConfigured,
} from "../app/services/resend-manage-booking-delivery.server.ts";

const request = {
  bookingId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  channel: "email",
  destination: "guest@example.com",
  manageUrl: `https://booking.example/manage#${"a".repeat(64)}`,
  expiresAt: "2026-10-04T00:00:00.000Z",
};

assert.equal(
  resendManageBookingDeliveryConfigured({ apiKey: "re_test", from: "JoTrip <booking@example.com>" }),
  true,
);
assert.equal(resendManageBookingDeliveryConfigured({ apiKey: "", from: "x" }), false);
assert.throws(
  () => createResendManageBookingDeliveryProvider({ apiKey: "", from: "x" }),
  /RESEND_MANAGE_BOOKING_CONFIG_INVALID/,
);

let captured;
const success = createResendManageBookingDeliveryProvider({
  apiKey: "re_fake_test_key",
  from: "JoTrip <booking@example.com>",
  fetcher: async (url, init) => {
    captured = { url, init };
    return new Response(JSON.stringify({ id: "email_123" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
});
const successResult = await success.deliver(request);
assert.deepEqual(successResult, { accepted: true, providerMessageId: "email_123" });
assert.equal(captured.url, "https://api.resend.com/emails");
assert.equal(captured.init.method, "POST");
assert.equal(captured.init.headers.Authorization, "Bearer re_fake_test_key");
assert.equal(captured.init.headers["Content-Type"], "application/json");
assert.equal(
  captured.init.headers["Idempotency-Key"],
  "manage-booking/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
);
const body = JSON.parse(captured.init.body);
assert.equal(body.from, "JoTrip <booking@example.com>");
assert.deepEqual(body.to, ["guest@example.com"]);
assert.match(body.text, /https:\/\/booking\.example\/manage#/);
assert.match(body.text, /This link expires at 2026-10-04T00:00:00\.000Z/);

async function resultForStatus(status) {
  const provider = createResendManageBookingDeliveryProvider({
    apiKey: "re_fake",
    from: "booking@example.com",
    fetcher: async () => new Response("{}", { status }),
  });
  return provider.deliver(request);
}

assert.deepEqual(await resultForStatus(401), {
  accepted: false,
  errorCode: "DELIVERY_AUTH_FAILED",
});
assert.deepEqual(await resultForStatus(429), {
  accepted: false,
  errorCode: "DELIVERY_RATE_LIMITED",
});
assert.deepEqual(await resultForStatus(409), {
  accepted: false,
  errorCode: "DELIVERY_REJECTED",
});
assert.deepEqual(await resultForStatus(500), {
  accepted: false,
  errorCode: "DELIVERY_NETWORK",
});

const network = createResendManageBookingDeliveryProvider({
  apiKey: "re_fake",
  from: "booking@example.com",
  fetcher: async () => {
    throw new Error("raw provider detail must not escape");
  },
});
assert.deepEqual(await network.deliver(request), {
  accepted: false,
  errorCode: "DELIVERY_NETWORK",
});

const unsupported = createResendManageBookingDeliveryProvider({
  apiKey: "re_fake",
  from: "booking@example.com",
  fetcher: async () => {
    throw new Error("must not call provider for SMS");
  },
});
assert.deepEqual(
  await unsupported.deliver({ ...request, channel: "sms" }),
  { accepted: false, errorCode: "HANDLER_UNSUPPORTED_EVENT" },
);

console.log("resend-manage-booking-delivery-selftest: ok");
