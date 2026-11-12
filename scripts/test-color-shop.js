const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "herade-color-shop-"));
process.env.DATABASE_PATH = path.join(tempDir, "shop.sqlite");
process.env.DISCORD_TOKEN = "test-token";
process.env.CLIENT_ID = "12345678901234567";
process.env.GUILD_ID = "12345678901234568";
process.env.LOG_LEVEL = "error";

const economy = require("../src/economy");
const colorShop = require("../src/color-shop");
const guild = process.env.GUILD_ID;
const user = "12345678901234569";

function fakeInteraction(customId, values) {
  const calls = [];
  return {
    customId, values, guildId: guild, user: { id: user }, calls,
    inGuild: () => true,
    isStringSelectMenu: () => Boolean(values),
    isButton: () => !values,
    update: async (payload) => { calls.push(["update", payload]); },
    reply: async (payload) => { calls.push(["reply", payload]); },
    deferUpdate: async () => { calls.push(["defer"]); },
  };
}
function checkComponents(payload) {
  assert.ok(payload.components.length <= 5);
  const seen = new Set();
  for (const row of payload.components) for (const c of row.components) {
    const data = c.toJSON();
    assert.ok(!seen.has(data.custom_id), `duplicate custom_id ${data.custom_id}`);
    seen.add(data.custom_id);
    assert.ok(data.custom_id.length <= 100, data.custom_id);
    if (data.options) assert.ok(data.options.length >= 1 && data.options.length <= 25);
  }
}

(async () => {
  for (const mode of ["c", "g"]) {
    for (const rarity of ["all", ...economy.RARITY_ORDER]) {
      const items = colorShop.listItems(mode, rarity);
      const pages = Math.max(1, Math.ceil(items.length / 20));
      for (let page = 0; page < pages; page++) {
        const payload = colorShop.listPayload(guild, user, mode, rarity, page);
        checkComponents(payload);
        if (items.length) assert.equal(payload.files.length, 1);
      }
    }
  }
  assert.equal(colorShop.listItems("c", "all").length + colorShop.listItems("g", "all").length, economy.CATALOG.filter((i) => i.type === "color").length);

  const item = colorShop.listItems("c", "Обычный")[0];
  let detail = colorShop.detailPayload(guild, user, item.id, "c", "all", 0);
  checkComponents(detail);
  assert.equal(detail.components[0].components[0].toJSON().disabled, false);

  // покупка без денег
  let i = fakeInteraction(`shc:buy:${item.id}:c:0:0`);
  await colorShop.handle(i);
  assert.equal(i.calls[0][0], "update");
  assert.equal(economy.getInventory(guild, user).length, 0);

  // покупка и применение кнопками
  economy.adjustBalance(guild, user, "12345678901234570", 5000, "color shop test", 1_000_000);
  i = fakeInteraction(`shc:buy:${item.id}:c:0:0`); await colorShop.handle(i);
  assert.equal(economy.getInventory(guild, user).length, 1);
  i = fakeInteraction(`shc:eq:${item.id}:c:0:0`); await colorShop.handle(i);
  assert.equal(economy.getCustomProfile(guild, user).color.id, item.id);

  // выбор в меню и навигация
  i = fakeInteraction("shc:sel:c:0:0", [item.id]); await colorShop.handle(i);
  assert.equal(i.calls[0][0], "update");
  i = fakeInteraction("shc:nav:g:2:1"); await colorShop.handle(i);
  assert.equal(i.calls[0][0], "update");
  i = fakeInteraction("shc:rar:c:0:0", ["Редкий"]); await colorShop.handle(i);
  assert.equal(i.calls[0][0], "update");
  i = fakeInteraction("shc:unknown"); await colorShop.handle(i);
  assert.equal(i.calls[0][0], "reply");
  console.log("[ OK ] color shop: pages, components, buy/equip/select/nav");
})().catch((e) => { console.error(e); process.exit(1); });
