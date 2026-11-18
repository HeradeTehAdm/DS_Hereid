"use strict";

const http = require("node:http");
const { createHmac, timingSafeEqual } = require("node:crypto");
const { ACHIEVEMENT_DEFS } = require("./achievement-defs");
const economy = require("./economy");
const { snapshot } = require("./rank-system");

const ROUTE = "/api/v1/spirit/profile";
const SNOWFLAKE = /^\d{17,20}$/;

function signature(secret, timestamp, nonce, method, path) {
  return createHmac("sha256", secret)
    .update([timestamp, nonce, method, path].join("\n"))
    .digest("hex");
}

function authenticated(req, secret, now = Date.now()) {
  const timestamp = req.headers["x-spirit-timestamp"];
  const nonce = req.headers["x-spirit-nonce"];
  const received = req.headers["x-spirit-signature"];
  if (typeof timestamp !== "string" || !/^\d{10}$/.test(timestamp) ||
      Math.abs(Math.floor(now / 1000) - Number(timestamp)) > 60 ||
      typeof nonce !== "string" || !/^[0-9a-f]{32}$/.test(nonce) ||
      typeof received !== "string" || !/^[0-9a-f]{64}$/.test(received)) return false;
  const expected = Buffer.from(signature(secret, timestamp, nonce, req.method, req.url), "hex");
  const actual = Buffer.from(received, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function respond(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": String(Buffer.byteLength(body)),
    "Cache-Control": "no-store, private",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(body);
}

function createProfileHandler({ db, guildId, token, logger = console }) {
  if (!SNOWFLAKE.test(String(guildId)) || typeof token !== "string" ||
      Buffer.byteLength(token, "utf8") < 32) throw new Error("Invalid Spirit Profile API configuration.");

  const getStats = db.prepare(
    "SELECT xp, level, balance FROM member_stats WHERE guild_id=? AND user_id=?",
  );
  const getAwards = db.prepare(
    "SELECT achievement_id, awarded_at FROM member_achievements WHERE guild_id=? AND user_id=? ORDER BY awarded_at DESC LIMIT 200",
  );
  const getRank = db.prepare(
    "SELECT joined_at, message_count, active_days, voice_seconds, voice_started_at, last_activity_at, current_rank FROM member_rank_activity WHERE guild_id=? AND user_id=?",
  );
  const getRedeemed = db.prepare(
    "SELECT code, redeemed_at FROM promo_redemptions WHERE guild_id=? AND user_id=? ORDER BY redeemed_at DESC LIMIT 40",
  );
  const getTodayQuests = db.prepare(
    "SELECT task_key, progress, completed_at FROM economy_daily_quests WHERE guild_id=? AND user_id=? AND day_key=?",
  );
  const definitions = new Map(ACHIEVEMENT_DEFS.map((def) => [def.id, def]));
  const sanitizedItem = (item) => ({
    id: item.id, name: item.name, category: item.category, description: item.description,
    price: item.price, type: item.type, rarity: economy.getItemRarity(item),
  });
  const publicCatalog = economy.CATALOG.filter((item) => !item.exclusive && !item.id.startsWith("ach_"))
    .map(sanitizedItem);

  return function profileHandler(req, res) {
    const url = new URL(req.url, "http://localhost");
    if (req.method !== "GET" || url.pathname !== ROUTE) return respond(res, 404, { error: "Not found" });
    if (req.url.length > 300) return respond(res, 400, { error: "Bad request" });
    if (!authenticated(req, token)) return respond(res, 401, { error: "Unauthorized" });

    const userId = url.searchParams.get("userId");
    if (url.searchParams.size !== 1 || !SNOWFLAKE.test(String(userId))) {
      return respond(res, 400, { error: "Bad request" });
    }
    try {
      const stats = getStats.get(guildId, userId);
      const achievements = getAwards.all(guildId, userId)
        .map((award) => {
          const def = definitions.get(award.achievement_id);
          if (!def) return null;
          return { id: def.id, name: def.name, description: def.description,
            badge: def.badge, rarity: def.rarity, awardedAt: award.awarded_at };
        })
        .filter(Boolean);
      const rank = getRank.get(guildId, userId);
      const activity = rank ? { ...snapshot(rank), rank: rank.current_rank } : null;
      const inventory = economy.getInventory(guildId, userId).slice(0, 400).map((row) => ({
        ...sanitizedItem(row.item), acquiredAt: row.purchased_at,
      }));
      const cosmetics = economy.getCustomProfile(guildId, userId);
      const equipped = Object.fromEntries(Object.entries(cosmetics).map(([slot, item]) =>
        [slot, item ? sanitizedItem(item) : null]));
      const dayKey = economy.moscowDayKey();
      const today = new Map(getTodayQuests.all(guildId, userId, dayKey).map((row) => [row.task_key, row]));
      const quests = economy.DAILY_QUESTS.map((quest) => {
        const progress = today.get(quest.key);
        return { key: quest.key, name: quest.name, description: quest.description,
          target: quest.target, reward: quest.reward,
          progress: Math.max(0, Math.min(quest.target, Number(progress?.progress || 0))),
          completed: progress?.completed_at != null };
      });
      const redeemedPromos = getRedeemed.all(guildId, userId).map((row) => ({
        code: row.code, redeemedAt: row.redeemed_at,
      }));
      const transactions = economy.getTransactions(guildId, userId, 25)
        .filter((tx) => !String(tx.kind).startsWith("casino_"))
        .map((tx) => ({
          amount: Number(tx.amount) || 0, kind: String(tx.kind), details: String(tx.details || "").slice(0, 200),
          createdAt: tx.created_at,
        }));
      return respond(res, 200, {
        profile: (stats || rank || inventory.length) ? {
          level: Math.max(0, Number(stats.level) || 0),
          xp: Math.max(0, Number(stats.xp) || 0),
          balance: Math.max(0, Number(stats.balance) || 0),
          achievements,
          rank: activity,
          inventory,
          equipped,
          quests,
          redeemedPromos,
          transactions,
          catalog: publicCatalog,
        } : null,
      });
    } catch (error) {
      logger.error?.("Spirit Profile API database query failed.", error);
      return respond(res, 500, { error: "Internal error" });
    }
  };
}

function startSpiritProfileApi({ db, config, logger }) {
  const token = process.env.SPIRIT_PROFILE_API_TOKEN || "";
  if (!token) {
    logger.info("Spirit Profile API disabled (SPIRIT_PROFILE_API_TOKEN not configured).");
    return { close: async () => {} };
  }
  const port = Number(process.env.SPIRIT_PROFILE_API_PORT || 3071);
  const host = process.env.SPIRIT_PROFILE_API_HOST || "127.0.0.1";
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Invalid SPIRIT_PROFILE_API_PORT.");
  }
  const handler = createProfileHandler({ db, guildId: config.guildId, token, logger });
  const server = http.createServer(handler);
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  server.listen(port, host, () => logger.info(`Spirit Profile API listening on ${host}:${port}`));
  return { close: () => new Promise((resolve) => server.close(resolve)) };
}

module.exports = { ROUTE, signature, authenticated, createProfileHandler, startSpiritProfileApi };
