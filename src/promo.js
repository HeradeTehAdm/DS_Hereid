// Промокоды на монеты: один код — один раз на участника; лимит участников или без лимита («для всех»).
const db = require("./database");
const { creditCoins } = require("./economy");

db.exec(`
  CREATE TABLE IF NOT EXISTS promo_codes (
    guild_id TEXT NOT NULL,
    code TEXT NOT NULL,
    coins INTEGER NOT NULL,
    max_uses INTEGER,
    uses INTEGER NOT NULL DEFAULT 0,
    expires_at INTEGER,
    active INTEGER NOT NULL DEFAULT 1,
    created_by TEXT,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (guild_id, code)
  );
  CREATE TABLE IF NOT EXISTS promo_redemptions (
    guild_id TEXT NOT NULL,
    code TEXT NOT NULL,
    user_id TEXT NOT NULL,
    redeemed_at INTEGER NOT NULL,
    PRIMARY KEY (guild_id, code, user_id)
  );
  CREATE TABLE IF NOT EXISTS promo_seeds (
    guild_id TEXT NOT NULL,
    code TEXT NOT NULL,
    PRIMARY KEY (guild_id, code)
  );
`);

const PROMO_MAX_COINS = 1_000_000;
const PROMO_MAX_USES = 1_000_000;
const DEFAULT_PROMOS = [{ code: "ДОДЕП", coins: 1000, maxUses: null }]; // первый промокод — для всех

function normalizeCode(raw) {
  return String(raw ?? "").trim().replace(/\s+/g, "").toLocaleUpperCase("ru-RU");
}
function validCode(code) { return /^[A-ZА-ЯЁ0-9_-]{3,24}$/u.test(code); }

function createPromo(guildId, { code, coins, maxUses = null, days = null, createdBy = null }, now = Date.now()) {
  const normalized = normalizeCode(code);
  if (!validCode(normalized)) return { ok: false, reason: "invalid_code" };
  if (!Number.isSafeInteger(coins) || coins < 1 || coins > PROMO_MAX_COINS) return { ok: false, reason: "invalid_coins" };
  if (maxUses !== null && (!Number.isSafeInteger(maxUses) || maxUses < 1 || maxUses > PROMO_MAX_USES)) return { ok: false, reason: "invalid_uses" };
  if (days !== null && (!Number.isSafeInteger(days) || days < 1 || days > 3650)) return { ok: false, reason: "invalid_days" };
  const expiresAt = days === null ? null : now + days * 86_400_000;
  const result = db.prepare("INSERT OR IGNORE INTO promo_codes (guild_id, code, coins, max_uses, expires_at, created_by, created_at) VALUES (?,?,?,?,?,?,?)")
    .run(guildId, normalized, coins, maxUses, expiresAt, createdBy, now);
  if (result.changes !== 1) return { ok: false, reason: "exists" };
  return { ok: true, code: normalized, coins, maxUses, expiresAt };
}

function getPromo(guildId, rawCode) {
  return db.prepare("SELECT * FROM promo_codes WHERE guild_id=? AND code=?").get(guildId, normalizeCode(rawCode)) || null;
}
function listPromos(guildId, limit = 25) {
  return db.prepare("SELECT * FROM promo_codes WHERE guild_id=? ORDER BY created_at DESC LIMIT ?").all(guildId, limit);
}
function setPromoActive(guildId, rawCode, active) {
  return db.prepare("UPDATE promo_codes SET active=? WHERE guild_id=? AND code=?").run(active ? 1 : 0, guildId, normalizeCode(rawCode)).changes === 1;
}
function deletePromo(guildId, rawCode) {
  const code = normalizeCode(rawCode);
  return db.transaction(() => {
    const removed = db.prepare("DELETE FROM promo_codes WHERE guild_id=? AND code=?").run(guildId, code).changes === 1;
    db.prepare("DELETE FROM promo_redemptions WHERE guild_id=? AND code=?").run(guildId, code);
    return removed;
  })();
}

// Атомарная активация: проверки, начисление монет и запись использования в одной транзакции.
function redeemPromo(guildId, userId, rawCode, now = Date.now()) {
  const code = normalizeCode(rawCode);
  if (!validCode(code)) return { ok: false, reason: "not_found" };
  return db.transaction(() => {
    const promo = db.prepare("SELECT * FROM promo_codes WHERE guild_id=? AND code=?").get(guildId, code);
    if (!promo) return { ok: false, reason: "not_found" };
    if (!promo.active) return { ok: false, reason: "inactive" };
    if (promo.expires_at !== null && promo.expires_at <= now) return { ok: false, reason: "expired" };
    if (promo.max_uses !== null && promo.uses >= promo.max_uses) return { ok: false, reason: "exhausted" };
    const used = db.prepare("INSERT OR IGNORE INTO promo_redemptions (guild_id, code, user_id, redeemed_at) VALUES (?,?,?,?)").run(guildId, code, userId, now);
    if (used.changes !== 1) return { ok: false, reason: "already_used" };
    db.prepare("UPDATE promo_codes SET uses=uses+1 WHERE guild_id=? AND code=?").run(guildId, code);
    const balance = creditCoins(guildId, userId, promo.coins, "promo", `Промокод ${code}: +${promo.coins}`, now);
    return { ok: true, code, coins: promo.coins, balance };
  })();
}

// Первый промокод создаётся один раз; если админ его удалит, заново он не появится.
function seedDefaultPromos(guildId, now = Date.now()) {
  let created = 0;
  for (const promo of DEFAULT_PROMOS) {
    const seeded = db.prepare("INSERT OR IGNORE INTO promo_seeds (guild_id, code) VALUES (?,?)").run(guildId, promo.code);
    if (seeded.changes !== 1) continue;
    const result = createPromo(guildId, { code: promo.code, coins: promo.coins, maxUses: promo.maxUses, createdBy: "system" }, now);
    if (result.ok) created++;
  }
  return created;
}

const REASONS = {
  not_found: "Такого промокода нет. Проверь написание.",
  inactive: "Этот промокод отключён.",
  expired: "Срок действия промокода закончился.",
  exhausted: "Промокод уже активировали все, кому он предназначался.",
  already_used: "Ты уже активировал этот промокод.",
};

module.exports = {
  PROMO_MAX_COINS, PROMO_MAX_USES, REASONS,
  normalizeCode, validCode, createPromo, getPromo, listPromos, setPromoActive, deletePromo, redeemPromo, seedDefaultPromos,
};
