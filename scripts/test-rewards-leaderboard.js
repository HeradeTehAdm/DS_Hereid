const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "herade-rewards-"));
process.env.DATABASE_PATH = path.join(tempDir, "rewards.sqlite");
process.env.DISCORD_TOKEN = "test-token";
process.env.CLIENT_ID = "12345678901234567";
process.env.GUILD_ID = "12345678901234568";
process.env.LOG_LEVEL = "error";

const db = require("../src/database");
const economy = require("../src/economy");
const trade = require("../src/trade");
const { ACHIEVEMENTS, evaluateAchievements, listAchievements } = require("../src/achievements");
const { ACHIEVEMENT_DEFS, EXCLUSIVE_BADGES } = require("../src/achievement-defs");
const lb = require("../src/leaderboard");
const lbUi = require("../src/leaderboard-ui");
const achUi = require("../src/achievements-ui");
const shop = require("../src/shop-browser");
const g = process.env.GUILD_ID;
const U = ["12345678901234571", "12345678901234572", "12345678901234573", "12345678901234574"];
let passed = 0;
function test(name, fn) { return Promise.resolve(fn()).then(() => { passed += 1; console.log(`[ OK ] ${name}`); }); }
const png = (buf) => Buffer.isBuffer(buf) && buf.subarray(1, 4).toString() === "PNG";

const guild = {
  id: g, name: "HERADE HOUSE 2.0",
  members: { fetch: async (id) => (U.includes(id) ? { id, displayName: `Member ${U.indexOf(id) + 1}`, user: { id, bot: false, username: `u${id}` }, displayAvatarURL: () => null } : null) },
};

(async () => {
  try {
    await test("achievement definitions: unique ids, unique emoji, one exclusive badge each", () => {
      assert.equal(ACHIEVEMENT_DEFS.length, 36);
      assert.equal(new Set(ACHIEVEMENT_DEFS.map((d) => d.id)).size, 36);
      const emoji = ACHIEVEMENT_DEFS.map((d) => d.badge);
      assert.equal(new Set(emoji).size, 36);
      const shopEmoji = new Set(economy.CATALOG.filter((i) => i.type === "badge").map((i) => i.value));
      assert.ok(emoji.every((e) => !shopEmoji.has(e)), "exclusive emoji must not repeat shop badges");
      assert.equal(EXCLUSIVE_BADGES.length, 36);
      assert.ok(EXCLUSIVE_BADGES.every((b) => b.exclusive && b.price === 0 && economy.RARITY_ORDER.includes(economy.getItemRarity(b))));
      assert.ok(ACHIEVEMENT_DEFS.find((d) => d.id === "ach_all").target === ACHIEVEMENT_DEFS.length - 1);
    });

    await test("exclusive badges are not in the shop, cannot be bought, but exist for equip", () => {
      economy.adjustBalance(g, U[0], "1", 900000, "test");
      assert.equal(economy.buyItem(g, U[0], "ach_first_message").reason, "not_for_sale");
      assert.ok(!economy.CATALOG.some((i) => i.exclusive));
      assert.ok(!shop.listItems("d", "all").some((i) => i.exclusive));
      assert.ok(economy.getItem("ach_first_message"));
    });

    await test("unlock grants the exclusive badge once, which can be equipped but not sold or gifted", () => {
      economy.buyItem(g, U[0], "badge_fox");
      const first = evaluateAchievements(g, U[0]);
      const purchase = first.find((a) => a.id === "first_purchase");
      assert.ok(purchase && purchase.badge.id === "ach_first_purchase");
      assert.ok(economy.getInventory(g, U[0]).some((r) => r.item_id === "ach_first_purchase"));
      assert.deepEqual(evaluateAchievements(g, U[0]), []);
      assert.ok(economy.equipItem(g, U[0], "ach_first_purchase").ok);
      assert.equal(trade.sellItem(g, U[0], "ach_first_purchase").reason, "not_tradable");
      assert.equal(trade.giftItem(g, U[0], U[1], "ach_first_purchase").reason, "not_tradable");
      assert.ok(trade.tradableInventory(g, U[0]).every((i) => !i.exclusive));
    });

    await test("badge is backfilled for an achievement awarded before the update", () => {
      db.prepare("INSERT INTO member_achievements(guild_id,user_id,achievement_id) VALUES(?,?,?)").run(g, U[1], "messages_100");
      const result = evaluateAchievements(g, U[1]);
      const old = result.find((a) => a.id === "messages_100");
      assert.ok(old && old.retroactive);
      assert.ok(economy.getInventory(g, U[1]).some((r) => r.item_id === "ach_messages_100"));
      assert.deepEqual(evaluateAchievements(g, U[1]), []);
    });

    await test("economy achievements: collection, gifts, trades, promo, casino, balance", () => {
      economy.adjustBalance(g, U[2], "1", 1_000_000, "test");
      const ids = economy.CATALOG.filter((i) => i.type !== "title" && i.price <= 1500).slice(0, 12).map((i) => i.id);
      for (const id of ids) assert.ok(economy.buyItem(g, U[2], id).ok);
      const a = evaluateAchievements(g, U[2]).map((x) => x.id);
      for (const id of ["first_purchase", "collector_10", "rich_10000", "rich_100000"]) assert.ok(a.includes(id), id);
      assert.ok(trade.giftItem(g, U[2], U[3], ids[0]).ok);
      assert.ok(evaluateAchievements(g, U[2]).some((x) => x.id === "gifts_1"));
      const offer = trade.createOffer({ guildId: g, fromId: U[2], toId: U[3], giveItem: ids[1], takeCoins: 10 });
      economy.adjustBalance(g, U[3], "1", 1000, "test");
      assert.ok(trade.respondOffer(offer.offer.id, U[3], "accept").ok);
      assert.ok(evaluateAchievements(g, U[2]).some((x) => x.id === "trades_1"));
      assert.ok(evaluateAchievements(g, U[3]).some((x) => x.id === "trades_1"));
    });

    await test("listAchievements reports progress and unlocked state", () => {
      const list = listAchievements(g, U[2]);
      assert.equal(list.length, 36);
      const collector = list.find((a) => a.id === "collector_50");
      assert.equal(collector.unlocked, false);
      assert.ok(collector.progress.current >= 9 && collector.progress.target === 50);
      assert.ok(list.find((a) => a.id === "first_purchase").unlocked);
      assert.ok(list.every((a) => a.badge && a.badge.exclusive));
    });

    await test("leaderboard data: ordering for balance, level, collection, activity", () => {
      db.prepare("UPDATE member_stats SET xp=? WHERE guild_id=? AND user_id=?").run(250000, g, U[2]);
      db.prepare("UPDATE member_stats SET xp=? WHERE guild_id=? AND user_id=?").run(900, g, U[0]);
      const bal = lb.topRows(g, "balance");
      assert.equal(bal[0].user_id, U[2]);
      assert.ok(bal.every((r, i) => i === 0 || bal[i - 1].value >= r.value));
      assert.equal(lb.topRows(g, "level")[0].user_id, U[2]);
      assert.equal(lb.topRows(g, "level")[0].level, 50);
      const col = lb.topRows(g, "collection");
      assert.equal(col[0].user_id, U[2]);
      assert.ok(!col.some((r) => r.value === 0));
      assert.equal(lb.positionOf(g, "balance", U[2]), 1);
      assert.ok(lb.positionOf(g, "collection", U[0]) > 1);
      assert.ok(Array.isArray(lb.topRows(g, "activity")));
    });

    await test("leaderboard UI renders every mode with navigation, owner lock and own position", async () => {
      for (const mode of Object.keys(lb.MODES)) {
        const payload = await lbUi.payload(guild, mode, 1, U[0]);
        assert.equal(payload.files.length, 1);
        assert.equal(payload.components.length, 2);
      }
      const board = await lbUi.buildBoard(guild, "balance", 1, U[0]);
      assert.ok(png(board.png)); assert.equal(board.pages, 1);
      const replies = [];
      await lbUi.handle({ customId: `lb:m:level:${U[1]}`, user: { id: U[0] }, reply: async (r) => replies.push(r) });
      assert.match(replies[0].content, /другого участника/);
    });

    await test("achievements UI renders pages and locks buttons to their owner", async () => {
      const first = await achUi.payload(guild, { id: U[2], username: "u", displayAvatarURL: () => null }, 1, U[2]);
      assert.equal(first.files.length, 1);
      const third = await achUi.payload(guild, { id: U[2], username: "u", displayAvatarURL: () => null }, 3, U[2]);
      assert.equal(third.components[0].components[2].data.disabled, true);
      const replies = [];
      await achUi.handle({ customId: `ach:p:2:${U[2]}:${U[2]}`, user: { id: U[0] }, reply: async (r) => replies.push(r) });
      assert.match(replies[0].content, /другой участник/);
    });

    await test("new slash commands are registered with expected options", () => {
      for (const [file, name, options] of [["trade", "trade", 5], ["gift", "gift", 2], ["sell", "sell", 1], ["leaderboard", "leaderboard", 1], ["achievements", "achievements", 1]]) {
        const cmd = require(`../src/commands/${file}`);
        assert.equal(cmd.data.name, name);
        assert.equal(cmd.data.toJSON().options.length, options);
      }
      assert.equal(typeof require("../src/commands/trade").autocomplete, "function");
    });

    console.log(`[test-rewards-leaderboard] Passed: ${passed}`);
  } catch (error) {
    console.error("[test-rewards-leaderboard] Failed:", error);
    process.exitCode = 1;
  } finally {
    try { db.close(); } catch {}
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
})();
