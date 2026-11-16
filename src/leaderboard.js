"use strict";

// Данные рейтингов: баланс, уровень, коллекция и активность.
const db = require("./database");
const { getLeaderboard } = require("./rank-system");

const MODES = Object.freeze({
  balance: { key: "balance", label: "Баланс", title: "ТОП ПО БАЛАНСУ", emoji: "💰", banner: "Мост", unit: "монет" },
  level: { key: "level", label: "Уровень", title: "ТОП ПО УРОВНЮ", emoji: "⭐", banner: "Аврора", unit: "XP" },
  collection: { key: "collection", label: "Коллекция", title: "ТОП КОЛЛЕКЦИОНЕРОВ", emoji: "🎒", banner: "Кристалл", unit: "предметов" },
  activity: { key: "activity", label: "Активность", title: "ТОП ПО АКТИВНОСТИ", emoji: "🏆", banner: "Дракон", unit: "" },
});
const FETCH_LIMIT = 100;
const levelOf = (xp) => Math.floor(Math.sqrt(Math.max(0, Number(xp) || 0) / 100));

function topRows(guildId, mode, limit = FETCH_LIMIT) {
  if (mode === "balance") {
    return db.prepare("SELECT user_id, balance AS value, xp FROM member_stats WHERE guild_id=? AND balance>0 ORDER BY balance DESC, xp DESC, user_id LIMIT ?").all(guildId, limit);
  }
  if (mode === "level") {
    return db.prepare("SELECT user_id, xp AS value, xp FROM member_stats WHERE guild_id=? AND xp>0 ORDER BY xp DESC, user_id LIMIT ?").all(guildId, limit)
      .map((row) => ({ ...row, level: levelOf(row.xp) }));
  }
  if (mode === "collection") {
    return db.prepare(`SELECT user_id, COUNT(*) AS value FROM economy_inventory WHERE guild_id=? AND item_id NOT LIKE 'ach\\_%' ESCAPE '\\'
      GROUP BY user_id ORDER BY value DESC, MIN(purchased_at) ASC, user_id LIMIT ?`).all(guildId, limit);
  }
  return getLeaderboard(guildId, limit, FETCH_LIMIT).map((row) => ({
    user_id: row.user_id, value: Number(row.message_count) || 0, rank: String(row.current_rank || "NEWBIE").toUpperCase(),
    messages: Number(row.message_count) || 0, voiceHours: (Number(row.voice_seconds) || 0) / 3600, activeDays: Number(row.active_days) || 0,
  }));
}

// Место участника вне топа (приблизительно: считаем и тех, кто мог покинуть сервер).
function positionOf(guildId, mode, userId) {
  if (mode === "balance") {
    const me = db.prepare("SELECT balance, xp FROM member_stats WHERE guild_id=? AND user_id=?").get(guildId, userId);
    if (!me || me.balance <= 0) return null;
    return db.prepare("SELECT COUNT(*) AS c FROM member_stats WHERE guild_id=? AND (balance>? OR (balance=? AND xp>?))").get(guildId, me.balance, me.balance, me.xp).c + 1;
  }
  if (mode === "level") {
    const me = db.prepare("SELECT xp FROM member_stats WHERE guild_id=? AND user_id=?").get(guildId, userId);
    if (!me || me.xp <= 0) return null;
    return db.prepare("SELECT COUNT(*) AS c FROM member_stats WHERE guild_id=? AND xp>?").get(guildId, me.xp).c + 1;
  }
  if (mode === "collection") {
    const mine = db.prepare("SELECT COUNT(*) AS c FROM economy_inventory WHERE guild_id=? AND user_id=? AND item_id NOT LIKE 'ach\\_%' ESCAPE '\\'").get(guildId, userId).c;
    if (!mine) return null;
    return db.prepare(`SELECT COUNT(*) AS c FROM (SELECT user_id, COUNT(*) AS n FROM economy_inventory WHERE guild_id=? AND item_id NOT LIKE 'ach\\_%' ESCAPE '\\' GROUP BY user_id) WHERE n>?`).get(guildId, mine).c + 1;
  }
  const all = getLeaderboard(guildId, 1000, 1000);
  const index = all.findIndex((row) => row.user_id === userId);
  return index === -1 ? null : index + 1;
}

module.exports = { MODES, FETCH_LIMIT, levelOf, topRows, positionOf };
