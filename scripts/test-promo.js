const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "herade-promo-"));
process.env.DATABASE_PATH = path.join(tempDir, "promo.sqlite");
process.env.DISCORD_TOKEN = "test-token";
process.env.CLIENT_ID = "12345678901234567";
process.env.GUILD_ID = "12345678901234568";
process.env.LOG_LEVEL = "error";

const economy = require("../src/economy");
const promo = require("../src/promo");
const promoCommand = require("../src/commands/promo");
const admin = require("../src/commands/admin");
const guild = process.env.GUILD_ID;
const u1 = "12345678901234571"; const u2 = "12345678901234572"; const u3 = "12345678901234573";
const adminId = "12345678901234570";

function slash(user, code) {
  const out = { replies: [] };
  return {
    out, guildId: guild, user: { id: user },
    inGuild: () => true,
    options: { getString: () => code },
    reply: async (payload) => { out.replies.push(payload); },
  };
}
function adminInteraction(customId, extra = {}) {
  const out = { replies: [], updates: [], modals: [] };
  return {
    out, customId, guildId: guild, user: { id: adminId }, guild: { id: guild, ownerId: adminId, memberCount: 3, name: "T" },
    member: { roles: { cache: new Map() } }, memberPermissions: { has: () => true }, client: { config: { ownerIds: [adminId] } },
    inGuild: () => true,
    isButton: () => !extra.modal && !extra.values, isStringSelectMenu: () => Boolean(extra.values), isModalSubmit: () => Boolean(extra.modal), isChannelSelectMenu: () => false,
    values: extra.values, fields: extra.modal ? { getTextInputValue: (key) => extra.modal[key] ?? "" } : undefined,
    reply: async (p) => { out.replies.push(p); }, update: async (p) => { out.updates.push(p); }, showModal: async (m) => { out.modals.push(m); },
  };
}

(async () => {
  // нормализация и проверка кода
  assert.equal(promo.normalizeCode("  до деп "), "ДОДЕП");
  assert.equal(promo.validCode("ДОДЕП"), true);
  assert.equal(promo.validCode("ab"), false);
  assert.equal(promo.validCode("bad code!"), false);

  // стартовый промокод создаётся один раз и не возвращается после удаления
  assert.equal(promo.seedDefaultPromos(guild), 1);
  assert.equal(promo.seedDefaultPromos(guild), 0);
  let start = promo.getPromo(guild, "додеп");
  assert.deepEqual([start.coins, start.max_uses, start.active], [1000, null, 1]);

  // /promo для всех: один раз на человека
  let i = slash(u1, "Додеп"); await promoCommand.execute(i);
  assert.equal(economy.getBalance(guild, u1).balance, 1000);
  assert.match(JSON.stringify(i.out.replies[0].embeds[0].toJSON()), /активирован/);
  i = slash(u1, "ДОДЕП"); await promoCommand.execute(i);
  assert.equal(economy.getBalance(guild, u1).balance, 1000, "second redemption must not pay");
  i = slash(u2, "додеп"); await promoCommand.execute(i);
  assert.equal(economy.getBalance(guild, u2).balance, 1000);
  assert.equal(promo.getPromo(guild, "ДОДЕП").uses, 2);
  assert.ok(economy.getTransactions(guild, u1, 5).some((t) => t.kind === "promo" && t.amount === 1000));

  // лимит участников
  assert.equal(promo.createPromo(guild, { code: "TOP2", coins: 300, maxUses: 2, createdBy: adminId }).ok, true);
  assert.equal(promo.createPromo(guild, { code: "top2", coins: 300 }).reason, "exists");
  assert.equal(promo.redeemPromo(guild, u1, "top2").ok, true);
  assert.equal(promo.redeemPromo(guild, u2, "top2").ok, true);
  assert.equal(promo.redeemPromo(guild, u3, "top2").reason, "exhausted");
  assert.equal(economy.getBalance(guild, u3).balance, 0);

  // срок и отключение
  const now = Date.now();
  promo.createPromo(guild, { code: "EXPIRED", coins: 50, days: 1 }, now - 3 * 86_400_000);
  assert.equal(promo.redeemPromo(guild, u3, "EXPIRED", now).reason, "expired");
  promo.createPromo(guild, { code: "PAUSED", coins: 50 });
  promo.setPromoActive(guild, "PAUSED", false);
  assert.equal(promo.redeemPromo(guild, u3, "PAUSED").reason, "inactive");
  assert.equal(promo.redeemPromo(guild, u3, "NOPE123").reason, "not_found");
  assert.equal(promo.createPromo(guild, { code: "BAD", coins: 0 }).reason, "invalid_coins");
  assert.equal(promo.createPromo(guild, { code: "BAD2", coins: 10, maxUses: 0 }).reason, "invalid_uses");

  // защита от подбора кодов
  for (let n = 0; n < 5; n++) { i = slash(u3, `WRONG${n}X`); await promoCommand.execute(i); }
  i = slash(u3, "ДОДЕП"); await promoCommand.execute(i);
  assert.match(i.out.replies[0].content || "", /Слишком много/);
  assert.equal(economy.getBalance(guild, u3).balance, 0);
  promoCommand.failures.clear();

  // админ-панель: раздел, создание, управление
  let a = adminInteraction("ha:promo"); await admin.handle(a);
  assert.ok(a.out.replies[0].embeds[0].toJSON().description.includes("ДОДЕП"));
  a = adminInteraction("ha:promo:create"); await admin.handle(a);
  assert.equal(a.out.modals.length, 1);
  a = adminInteraction("ha:modal:promo", { modal: { code: "Весна", coins: "500", max_uses: "10", days: "7" } }); await admin.handle(a);
  assert.match(JSON.stringify(a.out.replies[0].embeds[0].toJSON()), /Промокод создан/);
  const spring = promo.getPromo(guild, "ВЕСНА");
  assert.deepEqual([spring.coins, spring.max_uses], [500, 10]);
  assert.ok(spring.expires_at > Date.now());
  a = adminInteraction("ha:modal:promo", { modal: { code: "ВСЕМ", coins: "250", max_uses: "", days: "" } }); await admin.handle(a);
  assert.equal(promo.getPromo(guild, "ВСЕМ").max_uses, null);
  a = adminInteraction("ha:modal:promo", { modal: { code: "ВСЕМ", coins: "250", max_uses: "", days: "" } }); await admin.handle(a);
  assert.match(a.out.replies[0].content, /уже есть/);
  a = adminInteraction("ha:modal:promo", { modal: { code: "X", coins: "abc", max_uses: "", days: "" } }); await admin.handle(a);
  assert.match(a.out.replies[0].content, /⚠️/);
  a = adminInteraction("ha:promo:pick", { values: ["ВЕСНА"] }); await admin.handle(a);
  assert.equal(a.out.updates.length, 1);
  a = adminInteraction("ha:promo:toggle:ВЕСНА"); await admin.handle(a);
  assert.equal(promo.getPromo(guild, "ВЕСНА").active, 0);
  a = adminInteraction("ha:promo:del:ВЕСНА"); await admin.handle(a);
  assert.equal(promo.getPromo(guild, "ВЕСНА"), null);
  // удалённый стартовый код не возвращается
  promo.deletePromo(guild, "ДОДЕП");
  assert.equal(promo.seedDefaultPromos(guild), 0);
  assert.equal(promo.getPromo(guild, "ДОДЕП"), null);

  // доступ без прав запрещён
  const denied = adminInteraction("ha:promo:create");
  denied.memberPermissions = { has: () => false }; denied.guild.ownerId = "999"; denied.client.config.ownerIds = [];
  await admin.handle(denied);
  assert.match(denied.out.replies[0].content, /Нет доступа/);
  console.log("[ OK ] promo codes: redeem rules, limits, anti-bruteforce, admin panel");
})().catch((e) => { console.error(e); process.exit(1); }).finally(() => fs.rmSync(tempDir, { recursive: true, force: true }));
