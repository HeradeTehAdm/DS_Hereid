"use strict";

const assert = require("node:assert/strict");
const { createProfileHandler, signature, authenticated, ROUTE } = require("../src/spirit-profile-api");

const secret = "x".repeat(48);
const guildId = "123456789012345678";
const userId = "876543210987654321";
const path = ROUTE + "?userId=" + userId;
const now = 1794950000000;
const timestamp = String(Math.floor(now / 1000));
const nonce = "b".repeat(32);
const headers = {
  "x-spirit-timestamp": timestamp,
  "x-spirit-nonce": nonce,
  "x-spirit-signature": signature(secret, timestamp, nonce, "GET", path),
};
assert.equal(authenticated({ headers, method: "GET", url: path }, secret, now), true);
assert.equal(authenticated({ headers, method: "GET", url: path + "x" }, secret, now), false);
assert.equal(authenticated({ headers, method: "POST", url: path }, secret, now), false);
assert.equal(authenticated({ headers, method: "GET", url: path }, secret, now + 61000), false);

const db = {
  prepare(query) {
    if (query.includes("FROM member_stats")) return {
      get(g, u) { assert.equal(g, guildId); assert.equal(u, userId); return { xp: 900, level: 3, balance: 12 }; }
    };
    if (query.includes("FROM member_achievements")) return {
      all(g, u) { assert.equal(g, guildId); assert.equal(u, userId); return [{ achievement_id: "first_message", awarded_at: "2026-11-18" }]; }
    };
    throw new Error("Unexpected SQL: " + query);
  }
};
const handler = createProfileHandler({ db, guildId, token: secret });
function run(url, reqHeaders = {}) {
  let response = {};
  handler({ method: "GET", url, headers: reqHeaders }, {
    writeHead(status, headersOut) { response.status = status; response.headers = headersOut; },
    end(body) { response.json = JSON.parse(body); },
  });
  return response;
}
assert.equal(run(path).status, 401);
assert.equal(run(ROUTE + "?userId=bad").status, 401);
const t = String(Math.floor(Date.now() / 1000));
const n = "a".repeat(32);
const liveHeaders = {
  "x-spirit-timestamp": t,
  "x-spirit-nonce": n,
  "x-spirit-signature": signature(secret, t, n, "GET", path),
};
const result = run(path, liveHeaders);
assert.equal(result.status, 200);
assert.deepEqual(result.json.profile.level, 3);
assert.equal(result.json.profile.achievements[0].name, "Первое слово");
assert.equal(result.headers["Cache-Control"], "no-store, private");
assert.equal(run(path + "&other=1", {
  ...liveHeaders, "x-spirit-signature": signature(secret, t, n, "GET", path + "&other=1")
}).status, 400);
console.log("Spirit Profile API signed-request checks passed");
