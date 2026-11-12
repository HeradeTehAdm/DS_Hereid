const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "herade-casino-"));
process.env.DATABASE_PATH = path.join(tempDir, "casino.sqlite");
process.env.DISCORD_TOKEN = "test-token";
process.env.CLIENT_ID = "12345678901234567";
process.env.GUILD_ID = "12345678901234568";
process.env.LOG_LEVEL = "error";

const economy = require("../src/economy");
const casino = require("../src/casino");
const guild = process.env.GUILD_ID;
const user = "12345678901234569";
casino.config.animationMs = 0;
casino.config.cooldownMs = 0;

function fake(customId, values) {
  const calls = [];
  const target = {
    customId, values, guildId: guild, user: { id: user }, calls,
    inGuild: () => true,
    isStringSelectMenu: () => Boolean(values),
    isButton: () => !values,
    update: async (payload) => { calls.push(["update", payload]); },
    editReply: async (payload) => { calls.push(["edit", payload]); },
    reply: async (payload) => { calls.push(["reply", payload]); },
    deferUpdate: async () => { calls.push(["defer"]); },
  };
  return target;
}
function checkComponents(payload) {
  assert.ok(payload.components.length <= 5);
  const seen = new Set();
  for (const row of payload.components) for (const c of row.components) {
    const data = c.toJSON();
    assert.ok(!seen.has(data.custom_id), `duplicate custom_id ${data.custom_id}`);
    seen.add(data.custom_id);
    assert.ok(data.custom_id.length <= 100);
    if (data.options) assert.ok(data.options.length <= 25);
  }
}
const balance = () => economy.getBalance(guild, user).balance;

(async () => {
  // честность: слоты около 94-95%, монетка 97.5%, рулетка 97.3%
  const rtp = casino.slotsRtp();
  assert.ok(rtp > 0.92 && rtp < 0.97, `slots RTP ${rtp}`);
  assert.ok(casino.COIN_MULTIPLIER * 0.5 < 1);
  assert.ok(casino.ROULETTE_MULTIPLIER.red * 18 / 37 < 1 && casino.ROULETTE_MULTIPLIER.green / 37 < 1);

  // расчёт ставки в экономике
  assert.equal(economy.settleCasinoBet(guild, user, "slots", 100, 0).reason, "insufficient_funds");
  assert.equal(economy.settleCasinoBet(guild, user, "slots", 5, 0).reason, "invalid_bet");
  assert.equal(economy.settleCasinoBet(guild, user, "slots", 20000, 0).reason, "invalid_bet");
  economy.adjustBalance(guild, user, "12345678901234570", 1000, "casino test");
  let r = economy.settleCasinoBet(guild, user, "slots", 100, 0);
  assert.deepEqual([r.ok, r.net, r.balance], [true, -100, 900]);
  r = economy.settleCasinoBet(guild, user, "slots", 100, 400);
  assert.deepEqual([r.ok, r.net, r.balance], [true, 300, 1200]);
  r = economy.settleCasinoBet(guild, user, "coin", 100, 100);
  assert.equal(r.net, 0);
  const stats = economy.getCasinoStats(guild, user);
  assert.deepEqual([stats.games, stats.wagered, stats.returned, stats.bestWin], [3, 300, 500, 300]);
  const kinds = economy.getTransactions(guild, user, 5).map((t) => t.kind);
  assert.ok(kinds.includes("casino_win") && kinds.includes("casino_loss") && kinds.includes("casino_push"));

  // правила выплат
  assert.equal(casino.slotsMultiplier(["seven", "seven", "seven"]), 150);
  assert.equal(casino.slotsMultiplier(["cherry", "cherry", "lemon"]), 2);
  assert.equal(casino.slotsMultiplier(["lemon", "cherry", "bell"]), 0.4);
  assert.equal(casino.slotsMultiplier(["lemon", "bell", "star"]), 0);
  casino.setRandom(() => 0);
  assert.equal(casino.playCoin(100, "heads").payout, 195);
  assert.equal(casino.playCoin(100, "tails").payout, 0);
  assert.equal(casino.playRoulette(100, "green").payout, 3600);
  casino.setRandom((max) => (max === 37 ? 1 : 0));
  assert.equal(casino.playRoulette(100, "red").payout, 200);
  assert.equal(casino.playRoulette(100, "black").payout, 0);
  casino.setRandom(null);

  // интерфейс
  for (const game of Object.keys(casino.GAMES)) {
    const payload = casino.openPayload(guild, user, game);
    checkComponents(payload);
  }
  let i = fake("cas:game:coin:100"); await casino.handle(i); assert.equal(i.calls[0][0], "update");
  i = fake("cas:bet:roulette:100", ["max"]); await casino.handle(i); assert.equal(i.calls[0][0], "update");
  const maxRow = i.calls[0][1].components[0].components[0].toJSON();
  assert.equal(maxRow.custom_id, `cas:bet:roulette:${balance()}`); // ва-банк = весь баланс в пределах лимита

  // игры целиком (результат фиксируем генератором)
  const before = balance();
  casino.setRandom(() => 0); // слоты: три вишни ×4; монетка: орёл; рулетка: зеро
  i = fake("cas:play:slots:100:spin"); await casino.handle(i);
  assert.equal(balance(), before + 300);
  assert.ok(i.calls.length >= 4);
  i = fake("cas:play:coin:100:tails"); await casino.handle(i);
  assert.equal(balance(), before + 200);
  i = fake("cas:play:roulette:100:green"); await casino.handle(i);
  assert.equal(balance(), before + 3700);
  casino.setRandom(null);

  // нехватка монет и неверные данные не ломают баланс
  const rich = balance();
  i = fake(`cas:play:slots:10000:spin`);
  economy.adjustBalance(guild, user, "12345678901234570", -(rich - 50), "drain");
  await casino.handle(i);
  assert.equal(balance(), 50);
  i = fake("cas:play:coin:100:bogus"); await casino.handle(i); assert.equal(balance(), 50);
  i = fake("cas:play:slots:abc:spin"); await casino.handle(i); assert.equal(balance(), 50);
  i = fake("cas:unknown"); await casino.handle(i); assert.equal(i.calls[0][0], "reply");
  console.log("[ OK ] casino: odds, settlement, slots/coin/roulette flow, limits");
})().catch((e) => { console.error(e); process.exit(1); }).finally(() => fs.rmSync(tempDir, { recursive: true, force: true }));
