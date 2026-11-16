"use strict";

// Подарки, обмен между участниками и продажа предметов обратно боту.
const db = require("./database");
const { getItem, isTradable, sellPrice, getBalance, TRANSFER_FEE_PERCENT } = require("./economy");

const MAX_COINS = 1_000_000;
const OFFER_TTL_MS = 10 * 60 * 1000;
const MAX_PENDING_PER_MEMBER = 3;
const COLUMNS = ["title_item_id", "badge_item_id", "banner_item_id", "color_item_id", "frame_item_id"];

db.exec(`
  CREATE TABLE IF NOT EXISTS trade_offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    from_id TEXT NOT NULL,
    to_id TEXT NOT NULL,
    give_item TEXT,
    give_coins INTEGER NOT NULL DEFAULT 0,
    take_item TEXT,
    take_coins INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    resolved_at INTEGER,
    fail_reason TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_trade_offers_status ON trade_offers(guild_id, status, from_id);
`);

const ensureMember = db.prepare("INSERT INTO member_stats (guild_id,user_id) VALUES (?,?) ON CONFLICT(guild_id,user_id) DO NOTHING");
const logTx = db.prepare("INSERT INTO economy_transactions (guild_id,user_id,actor_id,amount,kind,details,created_at) VALUES (?,?,?,?,?,?,?)");
const owns = (guildId, userId, itemId) => Boolean(db.prepare("SELECT 1 FROM economy_inventory WHERE guild_id=? AND user_id=? AND item_id=?").get(guildId, userId, itemId));
const isId = (v) => typeof v === "string" && v.length > 0;
const feeFor = (coins) => (coins > 0 ? Math.ceil(coins * TRANSFER_FEE_PERCENT / 100) : 0);

function takeItem(guildId, userId, itemId) {
  db.prepare("DELETE FROM economy_inventory WHERE guild_id=? AND user_id=? AND item_id=?").run(guildId, userId, itemId);
  for (const column of COLUMNS) {
    db.prepare(`UPDATE member_custom_profiles SET ${column}=NULL WHERE guild_id=? AND user_id=? AND ${column}=?`).run(guildId, userId, itemId);
  }
}
function giveItem(guildId, userId, itemId, now) {
  ensureMember.run(guildId, userId);
  db.prepare("INSERT OR IGNORE INTO economy_inventory (guild_id,user_id,item_id,purchased_at) VALUES (?,?,?,?)").run(guildId, userId, itemId, now);
}
function checkItem(itemId) {
  const item = getItem(itemId);
  if (!item) return { ok: false, reason: "unknown_item" };
  if (!isTradable(item)) return { ok: false, reason: "not_tradable", item };
  return { ok: true, item };
}

// ---------- подарок ----------
function giftItem(guildId, fromId, toId, itemId, now = Date.now()) {
  if (!isId(guildId) || !isId(fromId) || !isId(toId)) return { ok: false, reason: "invalid_participants" };
  if (fromId === toId) return { ok: false, reason: "self" };
  const checked = checkItem(itemId);
  if (!checked.ok) return checked;
  const { item } = checked;
  return db.transaction(() => {
    if (!owns(guildId, fromId, itemId)) return { ok: false, reason: "not_owned", item };
    if (owns(guildId, toId, itemId)) return { ok: false, reason: "recipient_owns", item };
    takeItem(guildId, fromId, itemId);
    giveItem(guildId, toId, itemId, now);
    ensureMember.run(guildId, fromId);
    logTx.run(guildId, fromId, toId, 0, "gift_sent", `Подарок участнику ${toId}: ${item.name}`, now);
    logTx.run(guildId, toId, fromId, 0, "gift_received", `Подарок от участника ${fromId}: ${item.name}`, now);
    return { ok: true, item };
  })();
}

// ---------- продажа обратно ----------
function sellItem(guildId, userId, itemId, now = Date.now()) {
  if (!isId(guildId) || !isId(userId)) return { ok: false, reason: "invalid_participants" };
  const checked = checkItem(itemId);
  if (!checked.ok) return checked;
  const { item } = checked;
  const refund = sellPrice(item);
  return db.transaction(() => {
    if (!owns(guildId, userId, itemId)) return { ok: false, reason: "not_owned", item };
    takeItem(guildId, userId, itemId);
    ensureMember.run(guildId, userId);
    db.prepare("UPDATE member_stats SET balance=balance+? WHERE guild_id=? AND user_id=?").run(refund, guildId, userId);
    logTx.run(guildId, userId, null, refund, "sell", `Продажа: ${item.name}`, now);
    return { ok: true, item, refund, balance: getBalance(guildId, userId).balance };
  })();
}

// ---------- обмен ----------
function getOffer(id) {
  return db.prepare("SELECT * FROM trade_offers WHERE id=?").get(id) || null;
}
function expireOffers(now = Date.now()) {
  return db.prepare("UPDATE trade_offers SET status='expired', resolved_at=? WHERE status='pending' AND expires_at<=?").run(now, now).changes;
}
function pendingCount(guildId, fromId) {
  return db.prepare("SELECT COUNT(*) AS c FROM trade_offers WHERE guild_id=? AND from_id=? AND status='pending'").get(guildId, fromId).c;
}

function createOffer({ guildId, fromId, toId, giveItem: giveId = null, giveCoins = 0, takeItem: takeId = null, takeCoins = 0 }, now = Date.now()) {
  if (!isId(guildId) || !isId(fromId) || !isId(toId)) return { ok: false, reason: "invalid_participants" };
  if (fromId === toId) return { ok: false, reason: "self" };
  for (const n of [giveCoins, takeCoins]) {
    if (!Number.isSafeInteger(n) || n < 0 || n > MAX_COINS) return { ok: false, reason: "invalid_amount" };
  }
  if (!(giveId || giveCoins > 0) || !(takeId || takeCoins > 0)) return { ok: false, reason: "empty_side" };
  if (giveCoins > 0 && takeCoins > 0) return { ok: false, reason: "coins_both" };
  let giveObj = null; let takeObj = null;
  if (giveId) { const c = checkItem(giveId); if (!c.ok) return { ...c, side: "give" }; giveObj = c.item; }
  if (takeId) { const c = checkItem(takeId); if (!c.ok) return { ...c, side: "take" }; takeObj = c.item; }
  expireOffers(now);
  return db.transaction(() => {
    if (giveId && !owns(guildId, fromId, giveId)) return { ok: false, reason: "not_owned", item: giveObj };
    if (giveId && owns(guildId, toId, giveId)) return { ok: false, reason: "partner_owns_give", item: giveObj };
    if (takeId && !owns(guildId, toId, takeId)) return { ok: false, reason: "partner_lacks_take", item: takeObj };
    if (takeId && owns(guildId, fromId, takeId)) return { ok: false, reason: "you_own_take", item: takeObj };
    if (giveCoins > 0) {
      const total = giveCoins + feeFor(giveCoins);
      const balance = getBalance(guildId, fromId).balance;
      if (balance < total) return { ok: false, reason: "insufficient_funds", balance, total };
    }
    if (pendingCount(guildId, fromId) >= MAX_PENDING_PER_MEMBER) return { ok: false, reason: "too_many" };
    const pair = db.prepare("SELECT 1 FROM trade_offers WHERE guild_id=? AND status='pending' AND ((from_id=? AND to_id=?) OR (from_id=? AND to_id=?))").get(guildId, fromId, toId, toId, fromId);
    if (pair) return { ok: false, reason: "pair_pending" };
    const info = db.prepare("INSERT INTO trade_offers (guild_id,from_id,to_id,give_item,give_coins,take_item,take_coins,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?)")
      .run(guildId, fromId, toId, giveId || null, giveCoins, takeId || null, takeCoins, now, now + OFFER_TTL_MS);
    return { ok: true, offer: getOffer(info.lastInsertRowid), give: giveObj, take: takeObj };
  })();
}

function resolve(id, status, now, failReason = null) {
  db.prepare("UPDATE trade_offers SET status=?, resolved_at=?, fail_reason=? WHERE id=? AND status='pending'").run(status, now, failReason, id);
}

// action: accept | decline | cancel
function respondOffer(id, actorId, action, now = Date.now()) {
  const offer = getOffer(id);
  if (!offer) return { ok: false, reason: "not_found" };
  if (offer.status !== "pending") return { ok: false, reason: "resolved", status: offer.status, offer };
  if (now >= offer.expires_at) { resolve(id, "expired", now); return { ok: false, reason: "expired", offer: getOffer(id) }; }
  if (action === "cancel") {
    if (actorId !== offer.from_id) return { ok: false, reason: "not_sender", offer };
    resolve(id, "cancelled", now); return { ok: true, status: "cancelled", offer: getOffer(id) };
  }
  if (actorId !== offer.to_id) return { ok: false, reason: "not_recipient", offer };
  if (action === "decline") { resolve(id, "declined", now); return { ok: true, status: "declined", offer: getOffer(id) }; }
  if (action !== "accept") return { ok: false, reason: "bad_action", offer };

  const { guild_id: guildId, from_id: fromId, to_id: toId } = offer;
  const outcome = db.transaction(() => {
    const giveObj = offer.give_item ? getItem(offer.give_item) : null;
    const takeObj = offer.take_item ? getItem(offer.take_item) : null;
    if ((offer.give_item && !isTradable(giveObj)) || (offer.take_item && !isTradable(takeObj))) return { fail: "not_tradable" };
    if (offer.give_item && !owns(guildId, fromId, offer.give_item)) return { fail: "sender_lost_item" };
    if (offer.take_item && !owns(guildId, toId, offer.take_item)) return { fail: "recipient_lost_item" };
    if (offer.give_item && owns(guildId, toId, offer.give_item)) return { fail: "recipient_owns" };
    if (offer.take_item && owns(guildId, fromId, offer.take_item)) return { fail: "sender_owns" };
    const coins = Math.max(offer.give_coins, offer.take_coins);
    const fee = feeFor(coins);
    const payerId = offer.give_coins > 0 ? fromId : toId;
    const payeeId = payerId === fromId ? toId : fromId;
    if (coins > 0) {
      ensureMember.run(guildId, fromId); ensureMember.run(guildId, toId);
      const debit = db.prepare("UPDATE member_stats SET balance=balance-? WHERE guild_id=? AND user_id=? AND balance>=?").run(coins + fee, guildId, payerId, coins + fee);
      if (debit.changes !== 1) return { fail: payerId === fromId ? "sender_funds" : "recipient_funds" };
      db.prepare("UPDATE member_stats SET balance=balance+? WHERE guild_id=? AND user_id=?").run(coins, guildId, payeeId);
    }
    if (giveObj) { takeItem(guildId, fromId, giveObj.id); giveItem(guildId, toId, giveObj.id, now); }
    if (takeObj) { takeItem(guildId, toId, takeObj.id); giveItem(guildId, fromId, takeObj.id, now); }
    const describe = (gave, got) => `Обмен #${id}: отдал ${gave}, получил ${got}`;
    const fromGave = [giveObj?.name, offer.give_coins > 0 ? `${offer.give_coins} монет (+${fee} комиссия)` : null].filter(Boolean).join(" + ");
    const fromGot = [takeObj?.name, offer.take_coins > 0 ? `${offer.take_coins} монет` : null].filter(Boolean).join(" + ");
    const toGave = [takeObj?.name, offer.take_coins > 0 ? `${offer.take_coins} монет (+${fee} комиссия)` : null].filter(Boolean).join(" + ");
    const toGot = [giveObj?.name, offer.give_coins > 0 ? `${offer.give_coins} монет` : null].filter(Boolean).join(" + ");
    const delta = (userId) => (userId === payerId ? -(coins + fee) : userId === payeeId ? coins : 0);
    logTx.run(guildId, fromId, toId, delta(fromId), "trade", describe(fromGave, fromGot), now);
    logTx.run(guildId, toId, fromId, delta(toId), "trade", describe(toGave, toGot), now);
    return { ok: true, coins, fee, payerId, payeeId, give: giveObj, take: takeObj };
  })();
  if (outcome.fail) {
    resolve(id, "failed", now, outcome.fail);
    return { ok: false, reason: "failed", fail: outcome.fail, offer: getOffer(id) };
  }
  resolve(id, "accepted", now);
  return { ok: true, status: "accepted", offer: getOffer(id), ...outcome };
}

// Предметы участника, которые можно подарить, продать или обменять.
function tradableInventory(guildId, userId) {
  return db.prepare("SELECT item_id FROM economy_inventory WHERE guild_id=? AND user_id=? ORDER BY purchased_at DESC, item_id")
    .all(guildId, userId).map((row) => getItem(row.item_id)).filter(isTradable);
}

module.exports = {
  MAX_COINS, OFFER_TTL_MS, MAX_PENDING_PER_MEMBER, feeFor,
  giftItem, sellItem, createOffer, respondOffer, getOffer, expireOffers, tradableInventory,
};
