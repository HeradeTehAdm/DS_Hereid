import { readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

const pack01 = ["ocean","forest","sunset","neon","ice","galaxy","shadow","gold","pumpkin","graveyard"];
const pack02 = ["dawn","lake","dunes","sakura","storm","autumn","megacity","orbit","volcano","skycastle"];
const all = [...pack01, ...pack02];

test("all 20 banner assets are real, nonempty RIFF/WebP files, with original SVG fallback", () => {
  assert.equal(new Set(all).size, 20);
  const source = readFileSync(resolve("src/cosmetic-profile.js"), "utf8");
  const catalog = readFileSync(resolve("../src/economy.js"), "utf8");
  for (const suffix of all) {
    const id = "banner_" + suffix;
    const file = resolve("public/banners", id + ".webp");
    const bytes = readFileSync(file);
    assert.ok(bytes.length > 1024, id + " is too small");
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF", id + " is not RIFF");
    assert.equal(bytes.toString("ascii", 8, 12), "WEBP", id + " is not WebP");
    assert.match(catalog, new RegExp('id: "' + id + '"'), id + " missing from bot catalog");
    assert.ok(source.includes('"' + id + '"'), id + " missing from web image map");
    const svg = resolve("public/profile-banners", suffix + ".svg");
    assert.ok(statSync(svg).size > 100, id + " missing SVG fallback");
  }
});
