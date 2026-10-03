import assert from "node:assert/strict";
import {
  deriveManageBookingDeliveryToken,
  importManageBookingDeliveryDerivationKey,
  issueOrReuseManageBookingDeliveryAccess,
} from "../app/repositories/postgres-booking-delivery-access.server.ts";

const bookingId = "11111111-2222-4333-8444-555555555555";
const now = new Date("2026-10-03T07:30:00.000Z");
const expiresAt = "2026-10-04T07:30:00.000Z";
const keyA = await importManageBookingDeliveryDerivationKey("11".repeat(32));
const keyB = await importManageBookingDeliveryDerivationKey("22".repeat(32));

await assert.rejects(
  () => importManageBookingDeliveryDerivationKey("too-short"),
  /MANAGE_BOOKING_DELIVERY_KEY_INVALID/,
);

const fixedGrant = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const tokenA1 = await deriveManageBookingDeliveryToken(keyA, fixedGrant, bookingId);
const tokenA2 = await deriveManageBookingDeliveryToken(keyA, fixedGrant, bookingId);
const tokenB = await deriveManageBookingDeliveryToken(keyB, fixedGrant, bookingId);
assert.match(tokenA1, /^[0-9a-f]{64}$/);
assert.equal(tokenA1, tokenA2);
assert.notEqual(tokenA1, tokenB);

const grants = [
  {
    id: "99999999-8888-4777-8666-555555555555",
    booking_id: bookingId,
    token_hash: "f".repeat(64),
    created_at: now.toISOString(),
    expires_at: expiresAt,
    revoked_at: null,
  },
];

const database = {
  async transaction(work) {
    return work({
      async query(sql, parameters) {
        const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();
        if (normalized.startsWith("select id from bookings")) {
          return { rows: parameters[0] === bookingId ? [{ id: bookingId }] : [] };
        }
        if (
          normalized.startsWith("select id, token_hash, expires_at") &&
          normalized.includes("from booking_access_tokens")
        ) {
          const asOf = new Date(parameters[1]).getTime();
          return {
            rows: [...grants]
              .filter(
                (row) =>
                  row.booking_id === parameters[0] &&
                  row.revoked_at === null &&
                  new Date(row.expires_at).getTime() > asOf,
              )
              .reverse()
              .map(({ id, token_hash, expires_at }) => ({ id, token_hash, expires_at })),
          };
        }
        if (normalized.startsWith("insert into booking_access_tokens")) {
          grants.push({
            id: parameters[0],
            booking_id: parameters[1],
            token_hash: parameters[2],
            created_at: parameters[3],
            expires_at: parameters[4],
            revoked_at: null,
          });
          return { rows: [] };
        }
        throw new Error(`unexpected SQL in selftest: ${normalized}`);
      },
    });
  },
};

const first = await issueOrReuseManageBookingDeliveryAccess(
  database,
  bookingId,
  expiresAt,
  keyA,
  now,
);
assert.equal(first.reused, false);
assert.match(first.rawToken, /^[0-9a-f]{64}$/);
assert.equal(grants.length, 2);
assert.notEqual(grants[1].token_hash, first.rawToken);
assert.equal(Object.hasOwn(grants[1], "rawToken"), false);

const retry = await issueOrReuseManageBookingDeliveryAccess(
  database,
  bookingId,
  expiresAt,
  keyA,
  new Date(now.getTime() + 1000),
);
assert.equal(retry.reused, true);
assert.equal(retry.grantId, first.grantId);
assert.equal(retry.rawToken, first.rawToken);
assert.equal(retry.expiresAt, first.expiresAt);
assert.equal(grants.length, 2);

const rotated = await issueOrReuseManageBookingDeliveryAccess(
  database,
  bookingId,
  expiresAt,
  keyB,
  new Date(now.getTime() + 2000),
);
assert.equal(rotated.reused, false);
assert.notEqual(rotated.grantId, first.grantId);
assert.notEqual(rotated.rawToken, first.rawToken);
assert.equal(grants.length, 3);

console.log("manage-booking-delivery-capability-selftest: ok");
