const db = require("./database");
const { getProfile } = require("./member-profile");
const { snapshot } = require("./rank-system");
const economy = require("./economy");
const { ACHIEVEMENT_DEFS } = require("./achievement-defs");

db.exec(`CREATE TABLE IF NOT EXISTS member_achievements (guild_id TEXT NOT NULL, user_id TEXT NOT NULL, achievement_id TEXT NOT NULL, awarded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (guild_id, user_id, achievement_id)); CREATE INDEX IF NOT EXISTS idx_member_achievements_user ON member_achievements(guild_id, user_id, awarded_at);`);

// Совместимость: у каждого достижения есть test(stats), как раньше.
const ACHIEVEMENTS = ACHIEVEMENT_DEFS.map((def) => ({ ...def, test: (stats) => Number(stats[def.metric] || 0) >= def.target }));
const badgeItem = (achievementId) => economy.getItem(`ach_${achievementId}`);

const getAwarded = db.prepare("SELECT achievement_id, awarded_at FROM member_achievements WHERE guild_id=? AND user_id=? ORDER BY awarded_at");
const award = db.prepare("INSERT OR IGNORE INTO member_achievements(guild_id,user_id,achievement_id) VALUES(?,?,?)");
const countOf = (sql, ...args) => { try { return Number(db.prepare(sql).get(...args)?.c || 0); } catch { return 0; } };

function computeStats(guildId, userId) {
  const profile = getProfile(guildId, userId);
  const rank = db.prepare("SELECT * FROM member_rank_activity WHERE guild_id=? AND user_id=?").get(guildId, userId);
  const stats = rank ? { ...snapshot(rank) } : { messages: 0, activeDays: 0, voiceSeconds: 0, days: 0 };
  stats.level = Math.max(Number(profile.level) || 0, Math.floor(Math.sqrt(Math.max(0, Number(profile.xp) || 0) / 100)));
  stats.balance = Number(profile.balance) || 0;
  const items = economy.getInventory(guildId, userId).map((row) => row.item).filter((item) => !item.exclusive);
  stats.collection = items.length;
  stats.raritiesOwned = new Set(items.map((item) => economy.getItemRarity(item))).size;
  stats.purchases = countOf("SELECT COUNT(*) AS c FROM economy_transactions WHERE guild_id=? AND user_id=? AND kind='purchase'", guildId, userId);
  stats.gifts = countOf("SELECT COUNT(*) AS c FROM economy_transactions WHERE guild_id=? AND user_id=? AND kind='gift_sent'", guildId, userId);
  stats.trades = countOf("SELECT COUNT(*) AS c FROM economy_transactions WHERE guild_id=? AND user_id=? AND kind='trade'", guildId, userId);
  stats.questsDone = countOf("SELECT COUNT(*) AS c FROM economy_daily_quests WHERE guild_id=? AND user_id=? AND completed_at IS NOT NULL", guildId, userId);
  stats.promos = countOf("SELECT COUNT(*) AS c FROM promo_redemptions WHERE guild_id=? AND user_id=?", guildId, userId);
  const casino = economy.getCasinoStats(guildId, userId);
  stats.casinoGames = casino.games;
  stats.casinoBestWin = casino.bestWin;
  stats.unlocked = countOf("SELECT COUNT(*) AS c FROM member_achievements WHERE guild_id=? AND user_id=?", guildId, userId);
  return stats;
}

// Проверяет достижения, выдаёт эксклюзивные значки. Возвращает новые достижения (и значки, выданные задним числом).
function evaluateAchievements(guildId, userId) {
  const results = [];
  const now = Date.now();
  db.transaction(() => {
    const owned = new Set(getAwarded.all(guildId, userId).map((row) => row.achievement_id));
    const fresh = new Set();
    for (let pass = 0; pass < 4; pass += 1) {
      const stats = computeStats(guildId, userId);
      let changed = false;
      for (const achievement of ACHIEVEMENTS) {
        if (owned.has(achievement.id)) continue;
        // «Открыть все остальные» считаем по остальным, поэтому сам себя не учитываем.
        const value = achievement.metric === "unlocked" ? stats.unlocked : stats[achievement.metric];
        if (Number(value || 0) >= achievement.target && award.run(guildId, userId, achievement.id).changes > 0) {
          owned.add(achievement.id); fresh.add(achievement.id); changed = true;
        }
      }
      if (!changed) break;
    }
    db.prepare("INSERT INTO member_stats (guild_id,user_id) VALUES (?,?) ON CONFLICT(guild_id,user_id) DO NOTHING").run(guildId, userId);
    for (const achievement of ACHIEVEMENTS) {
      if (!owned.has(achievement.id)) continue;
      const badge = badgeItem(achievement.id);
      const granted = db.prepare("INSERT OR IGNORE INTO economy_inventory (guild_id,user_id,item_id,purchased_at) VALUES (?,?,?,?)").run(guildId, userId, badge.id, now).changes > 0;
      if (fresh.has(achievement.id)) results.push({ ...achievement, badge });
      else if (granted) results.push({ ...achievement, badge, retroactive: true });
    }
  })();
  return results;
}

function listAchievements(guildId, userId) {
  const awarded = new Map(getAwarded.all(guildId, userId).map((row) => [row.achievement_id, row.awarded_at]));
  const stats = computeStats(guildId, userId);
  return ACHIEVEMENTS.map((item) => {
    const metricValue = item.metric === "unlocked" ? Math.max(stats.unlocked - (awarded.has(item.id) ? 1 : 0), 0) : Number(stats[item.metric] || 0);
    return {
      ...item,
      unlocked: awarded.has(item.id),
      awardedAt: awarded.get(item.id) || null,
      progress: { current: Math.min(item.target, metricValue), target: item.target },
      badge: badgeItem(item.id),
    };
  });
}
module.exports = { ACHIEVEMENTS, evaluateAchievements, listAchievements, computeStats };
