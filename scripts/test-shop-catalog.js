const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "herade-shop-catalog-"));
process.env.DATABASE_PATH = path.join(tempDir, "shop.sqlite");
process.env.DISCORD_TOKEN = "test-token";
process.env.CLIENT_ID = "12345678901234567";
process.env.GUILD_ID = "12345678901234568";
process.env.LOG_LEVEL = "error";

const db = require("../src/database");
const economy = require("../src/economy");
const shopCommand = require("../src/commands/shop");
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`[ OK ] ${name}`); }

async function runTests() {
try {
  test("catalog item IDs are unique and all prices are safe positive integers", () => {
    const ids = economy.CATALOG.map((item) => item.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const item of economy.CATALOG) {
      assert.ok(Number.isSafeInteger(item.price) && item.price > 0, item.id);
      assert.ok(economy.RARITY_ORDER.includes(economy.getItemRarity(item)), item.id);
    }
  });
  test("all five title rarity tiers and agreed price ranges are represented", () => {
    const titles = economy.CATALOG.filter((item) => item.category === "Титулы");
    const tierCounts = Object.fromEntries(economy.RARITY_ORDER.map((tier) => [tier, titles.filter((item) => economy.getItemRarity(item) === tier).length]));
    for (const tier of economy.RARITY_ORDER) assert.ok(tierCounts[tier] > 0, `missing tier: ${tier}`);
    const ranges = [
      ["Обычный", 100, 500],
      ["Редкий", 750, 1500],
      ["Эпический", 2000, 4000],
      ["Легендарный", 5000, 10000],
      ["Мифический", 15000, 30000],
    ];
    for (const [tier, min, max] of ranges) {
      const addedTitles = titles.filter((item) => item.rarity === tier);
      assert.ok(addedTitles.length > 0, `missing new items: ${tier}`);
      for (const item of addedTitles) assert.ok(item.price >= min && item.price <= max, `${item.id} outside ${tier} range`);
    }
  });
  test("catalog sort orders categories, rarity, then price", () => {
    const shuffled = [economy.CATALOG.find((item) => item.id === "title_world_creator"), economy.CATALOG.find((item) => item.id === "title_joker"), economy.CATALOG.find((item) => item.id === "banner_gold"), economy.CATALOG.find((item) => item.id === "title_iceborn")];
    const sorted = shopCommand.sortCatalogItems(shuffled);
    assert.deepEqual(sorted.map((item) => item.id), ["title_joker", "title_iceborn", "title_world_creator", "banner_gold"]);
  });
  test("new mythic title can be purchased, equipped, and shown in custom profile", () => {
    const guild = process.env.GUILD_ID;
    const user = "12345678901234569";
    economy.adjustBalance(guild, user, "12345678901234570", 40000, "shop catalog test", 1_000_000);
    const purchase = economy.buyItem(guild, user, "title_world_creator", 1_000_001);
    assert.equal(purchase.ok, true);
    assert.equal(purchase.item.price, 30000);
    assert.equal(economy.equipItem(guild, user, "title_world_creator", 1_000_002).ok, true);
    assert.equal(economy.getCustomProfile(guild, user).title.value, "Создатель миров");
  });
  test("/shop command exposes the category filter", () => {
    const command = shopCommand.data.toJSON();
    assert.equal(command.name, "shop");
    const optionNames = command.options.map((option) => option.name);
    assert.ok(optionNames.includes("категория"));
    assert.ok(!optionNames.includes("редкость"));
    assert.equal(typeof shopCommand.execute, "function");
  });
  await (async () => {
    const payloads = [];
    await shopCommand.execute({
      inGuild: () => true,
      guildId: process.env.GUILD_ID,
      options: { getString: () => null },
      deferReply: async () => {},
      editReply: async (payload) => { payloads.push(payload); },
      followUp: async (payload) => { payloads.push(payload); },
    });
    assert.ok(payloads.length >= 1, "shop should send at least one catalog page");
    const embeds = payloads.flatMap((payload) => payload.embeds || []);
    assert.ok(embeds.length > 1, "full catalog should paginate into multiple embeds");
    assert.ok(embeds.length <= 10, "Discord allows at most 10 embeds per message");
    for (const embed of embeds) {
      const data = typeof embed.toJSON === "function" ? embed.toJSON() : embed;
      const size = (data.title?.length || 0) +
        (data.description?.length || 0) +
        (data.footer?.text?.length || 0) +
        (data.fields || []).reduce((sum, field) => sum + field.name.length + field.value.length, 0);
      assert.ok(size <= 6000, `embed size ${size} exceeds Discord's 6000-character limit`);
      assert.ok((data.fields || []).length <= 25, "embed has too many fields");
    }
    passed++;
    console.log("[ OK ] /shop full catalog paginates within Discord embed limits");
  })();
  db.close();
  console.log(`[test-shop-catalog] Passed: ${passed}`);
} catch (error) {
  console.error("[test-shop-catalog] Failed:", error);
  try { db.close(); } catch {}
  process.exitCode = 1;
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
}

runTests().catch((error) => {
  console.error("[test-shop-catalog] Unhandled failure:", error);
  process.exitCode = 1;
});
