import assert from "node:assert/strict";
import { test } from "node:test";
import { createHmac } from "node:crypto";
import { signedHeaders, validatedProfile, profileConfig } from "../lib/profile.js";

test("profile signatures cover method, path, query, nonce and timestamp", () => {
  const secret = "s".repeat(48);
  const path = "/api/v1/spirit/profile?userId=123456789012345678";
  const h = signedHeaders(secret, path, 1794950000000, "1".repeat(32));
  assert.equal(h["x-spirit-timestamp"], "1794950000");
  assert.equal(h["x-spirit-nonce"], "1".repeat(32));
  assert.equal(h["x-spirit-signature"], createHmac("sha256", secret)
    .update(["1794950000", "1".repeat(32), "GET", path].join("\n")).digest("hex"));
});

test("only trusted numeric profile data and bounded awards are accepted", () => {
  const valid = { level: 4, xp: 1600, balance: 125,
    achievements: [{ id: "first", name: "Первый", description: "Описание", badge: "🏆", rarity: "Обычный" }],
    rank: { rank: "MEMBER", days: 10, messages: 90, activeDays: 5, voiceSeconds: 300 },
    inventory: [{ id: "title_test", name: "Титул", category: "Титулы", description: "Описание", price: 100, type: "title", rarity: "Обычный" }],
    catalog: [], equipped: { title: null, badge: null, banner: null, color: null },
    quests: [{ key: "messages", name: "Общение", description: "Сообщения", target: 5, reward: 25, progress: 3, completed: false }],
    redeemedPromos: [{code:"CODE",redeemedAt:1794950000000}], transactions: [{amount:20,kind:"promo",details:"Начисление",createdAt:1794950000000}],
  };
  assert.deepEqual(validatedProfile(valid), valid);
  assert.equal(validatedProfile({ ...valid, xp: "1600" }), null);
  assert.equal(validatedProfile({ ...valid, balance: -1 }), null);
  assert.equal(validatedProfile({ ...valid, quests: [{ ...valid.quests[0], progress: "3" }] }), null);
  assert.equal(validatedProfile({ ...valid, redeemedPromos: [{ code: "BAD", redeemedAt: "yesterday" }] }), null);
  assert.equal(validatedProfile({ ...valid, catalog: [{ id: "item" }] }), null);
  assert.equal(validatedProfile({ ...valid, achievements: [{ id: "bad", name: "<img>", badge: "🏆" }] }), null);
});

test("profile API needs https and a long server secret", () => {
  const before = {
    SPIRIT_PROFILE_API_URL: process.env.SPIRIT_PROFILE_API_URL,
    SPIRIT_PROFILE_API_SECRET: process.env.SPIRIT_PROFILE_API_SECRET,
  };
  try {
    process.env.SPIRIT_PROFILE_API_URL = "http://localhost:3071";
    process.env.SPIRIT_PROFILE_API_SECRET = "s".repeat(40);
    assert.equal(profileConfig(), null);
    process.env.SPIRIT_PROFILE_API_URL = "https://example.com";
    assert.equal(profileConfig()?.origin, "https://example.com");
    process.env.SPIRIT_PROFILE_API_SECRET = "short";
    assert.equal(profileConfig(), null);
  } finally {
    for (const [key, val] of Object.entries(before)) {
      if (val === undefined) delete process.env[key]; else process.env[key] = val;
    }
  }
});
