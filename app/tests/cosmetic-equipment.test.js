import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ACTION_ID, EQUIP_ID, validEquipItem } from "../lib/action-store.js";
import { renderCosmeticProfile } from "../src/cosmetic-profile.js";

test("all original bot banner images are present and embedded as JPEG", () => {
  const folder = join(dirname(fileURLToPath(import.meta.url)), "../public/profile-banners");
  const banners = readdirSync(folder).filter(name => name.endsWith(".svg"));
  assert.equal(banners.length, 41);
  for (const name of banners) {
    const svg = readFileSync(join(folder, name), "utf8");
    assert.match(svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    assert.match(svg, /href="data:image\/jpeg;base64,\/9j\//);
    assert.ok(svg.endsWith("</svg>") || svg.endsWith("</svg>\n"));
  }
});

test("equipment validation excludes unknown types and invalid identifiers", () => {
  assert.equal(validEquipItem({ id: "banner_blackhole", type: "banner" }, "banner_blackhole"), true);
  assert.equal(validEquipItem({ id: "banner_blackhole", type: "title" }, "banner_blackhole"), true);
  assert.equal(validEquipItem({ id: "coin_transfer", type: "currency" }, "coin_transfer"), false);
  assert.equal(validEquipItem({ id: "title_legend", type: "title" }, "title_wrong"), false);
  assert.equal(EQUIP_ID.test("../../files"), false);
  assert.equal(ACTION_ID.test("abc"), false);
});

test("profile shows original art URL and equip control for owned cosmetics", () => {
  const banner = {
    id: "banner_blackhole", name: "Баннер «Горизонт событий»",
    type: "banner", category: "Баннеры", rarity: "Мифический",
    description: "Cosmic", price: 1000,
  };
  const title = {
    id: "title_legend", name: "Титул «Легенда»",
    type: "title", category: "Титулы", rarity: "Эпический",
    description: "Legend", price: 200,
  };
  const html = renderCosmeticProfile({
    identity: { id: "123456789012345678", username: "someone", displayName: "Someone", avatar: null },
    profile: {
      level: 2, xp: 500, balance: 1200, rank: null,
      inventory: [banner, title],
      equipped: { banner, title: null, badge: null, color: null },
    },
  });
  assert.match(html, /\/profile-banners\/blackhole\.svg/);
  assert.match(html, /data-equip-id="title_legend"/);
  assert.doesNotMatch(html, /data-equip-id="banner_blackhole"/);
});
