"use strict";

const logger = require("./logger");
const { evaluateAchievements } = require("./achievements");

// Личное сообщение о новых достижениях и выданных эксклюзивных значках.
async function notifyAchievementUnlocks(user, guild, achievements) {
  if (!achievements?.length) return;
  for (const achievement of achievements) {
    logger.info(`Achievement unlocked: guild=${guild.id} user=${user.id} achievement=${achievement.id}${achievement.retroactive ? " (badge backfill)" : ""}`);
  }
  const lines = achievements.map((achievement) => {
    const reward = achievement.badge ? ` · значок ${achievement.badge.value} в инвентаре` : "";
    return `${achievement.emoji} **${achievement.name}** — ${achievement.description}${reward}${achievement.retroactive ? " *(значок выдан за старое достижение)*" : ""}`;
  });
  const message = [
    `🏅 **Награды HeradeLegend — ${guild.name}!**`,
    "",
    ...lines,
    "",
    "Надень эксклюзивный значок: `/equip` и ID вида `ach_...` (его видно в `/inventory`) или кнопкой в `/shop`.",
    "Все достижения и прогресс — в `/achievements`.",
  ].join("\n");
  await user.send({ content: message }).catch((error) => {
    logger.debug(`Could not DM achievement notification to ${user.id}: ${error.message || error}`);
  });
}

// Проверить достижения участника после события (покупка, подарок, обмен, казино, промокод) и уведомить.
async function refreshAchievements(guild, user) {
  try {
    const awarded = evaluateAchievements(guild.id, user.id);
    await notifyAchievementUnlocks(user, guild, awarded);
    return awarded;
  } catch (error) {
    logger.warn(`Achievement refresh failed: ${error.message || error}`);
    return [];
  }
}

module.exports = { notifyAchievementUnlocks, refreshAchievements };
