import assert from "node:assert/strict";
import { test } from "node:test";
import { seal, activitySessionFromRequest } from "../lib/auth.js";

const prior = {
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
  DISCORD_REDIRECT_URI: process.env.DISCORD_REDIRECT_URI,
  SESSION_SECRET: process.env.SESSION_SECRET,
};
function configure() {
  process.env.DISCORD_CLIENT_ID = "1563277746820358325";
  process.env.DISCORD_CLIENT_SECRET = "test_discord_client_secret";
  process.env.DISCORD_REDIRECT_URI = "https://duh-svobody-app.vercel.app/api/auth/callback";
  process.env.SESSION_SECRET = "s".repeat(48);
}
function restore() {
  for (const [key, value] of Object.entries(prior)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
function payload(override = {}) {
  const now = Date.now();
  return {
    id: "123456789012345678",
    username: "user",
    iat: now,
    exp: now + 20 * 60_000,
    purpose: "discord_activity",
    aud: "1563277746820358325",
    ...override,
  };
}
function request(value) {
  return { headers: { authorization: `Bearer ${seal(value, process.env.SESSION_SECRET)}` } };
}

test("Discord Activity session accepts only valid short-lived identity", () => {
  configure();
  try {
    assert.equal(activitySessionFromRequest(request(payload())).id, "123456789012345678");
    assert.equal(activitySessionFromRequest(request(payload({ purpose: "cookie" }))), null);
    assert.equal(activitySessionFromRequest(request(payload({ aud: "123456789012345678" }))), null);
    assert.equal(activitySessionFromRequest(request(payload({ exp: Date.now() - 1 }))), null);
    assert.equal(activitySessionFromRequest(request(payload({ exp: Date.now() + 2 * 60 * 60_000 }))), null);
    assert.equal(activitySessionFromRequest({ headers: { authorization: "Bearer invalid" } }), null);
    assert.equal(activitySessionFromRequest({ headers: {} }), null);
  } finally { restore(); }
});
