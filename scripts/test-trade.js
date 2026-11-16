const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "herade-trade-"));
process.env.DATABASE_PATH = path.join(tempDir, "trade.sqlite");
process.env.DISCORD_TOKEN = "test-token";
process.env.CLIENT_ID = "12345678901234567";
process.env.GUILD_ID = "12345678901234568";
process.env.LOG_LEVEL = "error";

const economy = require("../src/economy");
const trade = require("../src/trade");
const { evaluateAchievements } = require("../src/achievements");
const art = require("../src/trade-art");
const { preload } = require("../src/shop-browser");
const g = process.env.GUILD_ID;
const A = "12345678901234571"; const B = "12345678901234572"; const C = "12345678901234573";
let passed = 0;
function test(name, fn) { fn(); passed += 1; console.log(`[ OK ] ${name}`); }
const give = (user, item) => { economy.adjustBalance(g, user, "1", 100000, "test"); const r = economy.buyItem(g, user, item); assert.ok(r.ok, `${item}: ${r.reason}`); };
const owns = (user, item) => economy.getInventory(g, user).some((row) => row.item_id === item);

(async () => {
  try {
    // ---------- подарок ----------
    give(A, "badge_fox"); give(A, "badge_wolf"); give(B, "badge_owl");
    economy.equipItem(g, A, "badge_fox");
    test("gift moves the item, unequips it from the sender and logs both sides", () => {
      const r = trade.giftItem(g, A, B, "badge_fox");
      assert.ok(r.ok);
      assert.equal(owns(A, "badge_fox"), false);
      assert.equal(owns(B, "badge_fox"), true);
      assert.equal(economy.getCustomProfile(g, A).badge, null, "equipped item must be removed from the giver");
      assert.equal(economy.getTransactions(g, A, 5)[0].kind, "gift_sent");
      assert.equal(economy.getTransactions(g, B, 5)[0].kind, "gift_received");
    });
    test("gift rules: self, not owned, already owned by recipient, exclusive badges", () => {
      assert.equal(trade.giftItem(g, A, A, "badge_wolf").reason, "self");
      assert.equal(trade.giftItem(g, A, B, "badge_fox").reason, "not_owned");
      give(B, "badge_wolf");
      assert.equal(trade.giftItem(g, A, B, "badge_wolf").reason, "recipient_owns");
      assert.equal(trade.giftItem(g, A, B, "nope").reason, "unknown_item");
      assert.equal(trade.giftItem(g, A, B, "ach_first_message").reason, "not_tradable");
    });

    // ---------- продажа ----------
    test("sell pays 50% of the price, removes and unequips the item", () => {
      const price = economy.getItem("badge_wolf").price;
      economy.equipItem(g, B, "badge_wolf");
      const before = economy.getBalance(g, B).balance;
      const r = trade.sellItem(g, B, "badge_wolf");
      assert.ok(r.ok);
      assert.equal(r.refund, Math.floor(price * 0.5));
      assert.equal(economy.getBalance(g, B).balance, before + r.refund);
      assert.equal(owns(B, "badge_wolf"), false);
      assert.equal(economy.getCustomProfile(g, B).badge, null);
      assert.equal(trade.sellItem(g, B, "badge_wolf").reason, "not_owned");
      assert.equal(economy.getTransactions(g, B, 1)[0].kind, "sell");
    });
    test("buy then sell never makes coins", () => {
      const item = economy.getItem("color_slate") || economy.CATALOG.find((i) => i.type === "color");
      const start = economy.getBalance(g, C).balance;
      economy.adjustBalance(g, C, "1", 5000, "test");
      economy.buyItem(g, C, item.id);
      trade.sellItem(g, C, item.id);
      assert.ok(economy.getBalance(g, C).balance < start + 5000);
    });

    // ---------- обмен ----------
    test("offer validation", () => {
      give(A, "banner_sunset"); give(B, "banner_ocean");
      assert.equal(trade.createOffer({ guildId: g, fromId: A, toId: A, giveItem: "banner_sunset", takeCoins: 1 }).reason, "self");
      assert.equal(trade.createOffer({ guildId: g, fromId: A, toId: B, giveItem: "banner_sunset" }).reason, "empty_side");
      assert.equal(trade.createOffer({ guildId: g, fromId: A, toId: B, giveCoins: 5, takeCoins: 5 }).reason, "coins_both");
      assert.equal(trade.createOffer({ guildId: g, fromId: A, toId: B, giveItem: "banner_ocean", takeCoins: 5 }).reason, "not_owned");
      assert.equal(trade.createOffer({ guildId: g, fromId: A, toId: B, giveItem: "banner_sunset", takeItem: "banner_forest" }).reason, "partner_lacks_take");
      assert.equal(trade.createOffer({ guildId: g, fromId: A, toId: B, giveItem: "ach_first_message", takeCoins: 5 }).reason, "not_tradable");
      assert.equal(trade.createOffer({ guildId: g, fromId: A, toId: B, giveItem: "banner_sunset", takeCoins: -4 }).reason, "invalid_amount");
    });
    test("item-for-item swap works, only recipient can accept, double accept fails", () => {
      const r = trade.createOffer({ guildId: g, fromId: A, toId: B, giveItem: "banner_sunset", takeItem: "banner_ocean" });
      assert.ok(r.ok);
      const id = r.offer.id;
      assert.equal(trade.createOffer({ guildId: g, fromId: B, toId: A, giveItem: "banner_ocean", takeCoins: 1 }).reason, "pair_pending");
      assert.equal(trade.respondOffer(id, A, "accept").reason, "not_recipient");
      assert.equal(trade.respondOffer(id, B, "cancel").reason, "not_sender");
      const done = trade.respondOffer(id, B, "accept");
      assert.ok(done.ok && done.status === "accepted");
      assert.equal(owns(A, "banner_ocean"), true); assert.equal(owns(A, "banner_sunset"), false);
      assert.equal(owns(B, "banner_sunset"), true); assert.equal(owns(B, "banner_ocean"), false);
      assert.equal(trade.respondOffer(id, B, "accept").reason, "resolved");
    });
    test("item for coins charges the 5% fee to the payer and credits the seller", () => {
      const r = trade.createOffer({ guildId: g, fromId: A, toId: B, giveItem: "banner_ocean", takeCoins: 1000 });
      assert.ok(r.ok);
      const a0 = economy.getBalance(g, A).balance; const b0 = economy.getBalance(g, B).balance;
      const done = trade.respondOffer(r.offer.id, B, "accept");
      assert.ok(done.ok); assert.equal(done.fee, 50);
      assert.equal(economy.getBalance(g, A).balance, a0 + 1000);
      assert.equal(economy.getBalance(g, B).balance, b0 - 1050);
      assert.equal(owns(B, "banner_ocean"), true);
      assert.equal(economy.getTransactions(g, B, 1)[0].amount, -1050);
    });
    test("coins-for-item: giver is checked at creation, funds rechecked at accept", () => {
      const poor = "12345678901234599";
      assert.equal(trade.createOffer({ guildId: g, fromId: poor, toId: B, giveCoins: 500, takeItem: "banner_ocean" }).reason, "insufficient_funds");
      const r = trade.createOffer({ guildId: g, fromId: A, toId: B, giveCoins: 500, takeItem: "banner_ocean" });
      assert.ok(r.ok);
      economy.adjustBalance(g, A, "1", -economy.getBalance(g, A).balance, "drain");
      const done = trade.respondOffer(r.offer.id, B, "accept");
      assert.equal(done.reason, "failed"); assert.equal(done.fail, "sender_funds");
      assert.equal(owns(B, "banner_ocean"), true, "nothing must move on a failed trade");
      assert.equal(trade.getOffer(r.offer.id).status, "failed");
      economy.adjustBalance(g, A, "1", 50000, "refill");
    });
    test("decline, cancel and expiry", () => {
      const o1 = trade.createOffer({ guildId: g, fromId: A, toId: C, giveCoins: 10, takeItem: null, takeCoins: 0 });
      assert.equal(o1.reason, "empty_side");
      give(C, "banner_gold");
      const o2 = trade.createOffer({ guildId: g, fromId: A, toId: C, giveCoins: 10, takeItem: "banner_gold" });
      assert.ok(o2.ok);
      assert.equal(trade.respondOffer(o2.offer.id, C, "decline").status, "declined");
      const o3 = trade.createOffer({ guildId: g, fromId: A, toId: C, giveCoins: 10, takeItem: "banner_gold" });
      assert.equal(trade.respondOffer(o3.offer.id, A, "cancel").status, "cancelled");
      const o4 = trade.createOffer({ guildId: g, fromId: A, toId: C, giveCoins: 10, takeItem: "banner_gold" });
      const late = trade.respondOffer(o4.offer.id, C, "accept", Date.now() + trade.OFFER_TTL_MS + 1000);
      assert.equal(late.reason, "expired");
      assert.equal(trade.getOffer(o4.offer.id).status, "expired");
      assert.equal(owns(C, "banner_gold"), true);
    });
    test("limit of open offers per member", () => {
      const partners = ["12345678901234581", "12345678901234582", "12345678901234583", "12345678901234584"];
      let last;
      for (const p of partners) { give(p, "banner_forest"); last = trade.createOffer({ guildId: g, fromId: A, toId: p, giveCoins: 10, takeItem: "banner_forest" }); }
      assert.equal(last.reason, "too_many");
    });
    test("traded items are tradable inventory only (no exclusive badges)", () => {
      evaluateAchievements(g, A);
      assert.ok(trade.tradableInventory(g, A).every((item) => !item.exclusive));
    });
    test("autocomplete helper lists own tradable items", async () => {
      const ui = require("../src/trade-ui");
      let choices = null;
      await ui.itemChoices({ guildId: g, options: { getFocused: () => "" }, respond: async (c) => { choices = c; } }, A);
      assert.ok(choices.length > 0 && choices.length <= 25);
      assert.ok(choices.every((c) => c.name.length <= 100));
    });

    await preload();
    const fox = economy.getItem("badge_fox");
    const png = art.renderTradeCard({ fromName: "A", toName: "B", giveItem: fox, giveCoins: 0, takeItem: null, takeCoins: 500, fee: 25, payerName: "B", status: "pending" });
    assert.equal(png.subarray(1, 4).toString(), "PNG"); passed += 1; console.log("[ OK ] trade card renders as PNG");
    assert.equal(art.renderItemCard(fox, { label: "Подарок", line1: "x" }).subarray(1, 4).toString(), "PNG"); passed += 1; console.log("[ OK ] gift/sell card renders as PNG");

    console.log(`[test-trade] Passed: ${passed}`);
  } catch (error) {
    console.error("[test-trade] Failed:", error);
    process.exitCode = 1;
  } finally {
    try { require("../src/database").close(); } catch {}
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
})();
