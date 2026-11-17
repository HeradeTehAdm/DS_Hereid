import assert from "node:assert/strict";
import { test } from "node:test";
import { seal, unseal, sessionFromRequest, configuration } from "../lib/auth.js";

const secret = "a".repeat(48);
test("encrypted cookie round-trip", () => {
  const obj = { id: "123456789012345678", username: "test", iat: Date.now() };
  assert.deepEqual(unseal(seal(obj, secret), secret), obj);
});
test("tampered cookie is rejected", () => {
  const token = seal({ data: "private" }, secret);
  const altered = Buffer.from(token, "base64url");
  altered[altered.length - 1] ^= 1;
  assert.equal(unseal(altered.toString("base64url"), secret), null);
});
test("invalid configuration fails closed", () => {
  const before = {
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
    DISCORD_REDIRECT_URI: process.env.DISCORD_REDIRECT_URI,
    SESSION_SECRET: process.env.SESSION_SECRET,
  };
  try {
    delete process.env.DISCORD_CLIENT_ID;
    delete process.env.DISCORD_CLIENT_SECRET;
    delete process.env.DISCORD_REDIRECT_URI;
    delete process.env.SESSION_SECRET;
    assert.equal(configuration(), null);
    assert.equal(sessionFromRequest({ headers: {} }), null);
  } finally {
    for (const [k, v] of Object.entries(before)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
});
