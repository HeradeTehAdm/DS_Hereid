const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require("discord.js");
const { economyDisabled } = require("../economy-access");
const promo = require("../promo");

// Защита от подбора кодов: 5 неверных попыток за 10 минут — пауза на 5 минут.
const failures = new Map();
const WINDOW_MS = 10 * 60_000; const BLOCK_MS = 5 * 60_000; const MAX_FAILS = 5;
function blockedFor(key, now) {
  const entry = failures.get(key);
  if (!entry) return 0;
  if (entry.blockedUntil && entry.blockedUntil > now) return entry.blockedUntil - now;
  if (now - entry.first > WINDOW_MS) failures.delete(key);
  return 0;
}
function registerFailure(key, now) {
  const entry = failures.get(key);
  if (!entry || now - entry.first > WINDOW_MS) { failures.set(key, { first: now, count: 1, blockedUntil: 0 }); return; }
  entry.count += 1;
  if (entry.count >= MAX_FAILS) entry.blockedUntil = now + BLOCK_MS;
}
const money = (n) => Number(n).toLocaleString("ru-RU");

module.exports = {
  failures,
  data: new SlashCommandBuilder()
    .setName("promo")
    .setDescription("Активировать промокод и получить монеты.")
    .addStringOption((option) => option
      .setName("код")
      .setDescription("Промокод, например ДОДЕП")
      .setRequired(true)
      .setMinLength(3)
      .setMaxLength(32)),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: "Промокоды доступны только на сервере.", flags: MessageFlags.Ephemeral });
    }
    if (await economyDisabled(interaction)) return;
    const key = `${interaction.guildId}:${interaction.user.id}`;
    const now = Date.now();
    const wait = blockedFor(key, now);
    if (wait > 0) {
      return interaction.reply({ content: `⏳ Слишком много неверных попыток. Подожди ещё ${Math.ceil(wait / 60_000)} мин.`, flags: MessageFlags.Ephemeral });
    }
    const result = promo.redeemPromo(interaction.guildId, interaction.user.id, interaction.options.getString("код", true), now);
    if (!result.ok) {
      if (result.reason === "not_found") registerFailure(key, now);
      const embed = new EmbedBuilder().setColor(0xED4245).setTitle("🎟️ Промокод не активирован").setDescription(`❌ ${promo.REASONS[result.reason] || "Не удалось активировать промокод."}`);
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
    failures.delete(key);
    const embed = new EmbedBuilder().setColor(0x57F287).setTitle("🎟️ Промокод активирован!")
      .setDescription([`Код **${result.code}** принёс тебе **+${money(result.coins)}** 🪙`, `Твой баланс: **${money(result.balance)}** 🪙`].join("\n"))
      .setFooter({ text: "Следи за новыми промокодами на сервере" });
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
