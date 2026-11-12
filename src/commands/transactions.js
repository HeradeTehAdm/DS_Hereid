const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require("discord.js");
const { getTransactions } = require("../economy");
const { economyDisabled } = require("../economy-access");

const KIND_LABELS = {
  daily: "🎁 Ежедневная награда",
  purchase: "🛍️ Покупка",
  admin_adjustment: "🛡️ Корректировка администратора",
  quest: "📜 Награда за задание",
  transfer_sent: "📤 Перевод монет",
  casino_win: "🎰 Казино: выигрыш",
  casino_loss: "🎰 Казино: проигрыш",
  casino_push: "🎰 Казино: ставка возвращена",
  transfer_received: "📥 Получение монет",
};

function formatDate(timestamp) {
  const value = Number(timestamp);
  if (!Number.isFinite(value) || value <= 0) return "дата неизвестна";
  return new Date(value).toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    dateStyle: "short",
    timeStyle: "short",
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("transactions")
    .setDescription("Посмотреть историю операций с монетами.")
    .addUserOption((option) => option
      .setName("member")
      .setDescription("История участника (нужно право «Управление сервером»)")
      .setRequired(false)),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: "История операций доступна только на сервере.",
        flags: MessageFlags.Ephemeral,
      });
    }
    if (await economyDisabled(interaction)) return;

    const target = interaction.options.getUser("member") || interaction.user;
    const viewingAnother = target.id !== interaction.user.id;
    if (viewingAnother && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: "Просматривать историю другого участника может персонал с правом «Управление сервером».",
        flags: MessageFlags.Ephemeral,
      });
    }

    const rows = getTransactions(interaction.guildId, target.id, 10);
    const description = rows.length
      ? rows.map((row) => {
        const label = KIND_LABELS[row.kind] || "Операция";
        const amount = Number(row.amount);
        const signed = amount > 0 ? `+${amount.toLocaleString("ru-RU")}` : amount.toLocaleString("ru-RU");
        const details = String(row.details || "").replace(/[`*_~|]/g, "").slice(0, 120);
        return `**${label}** · ${formatDate(row.created_at)}\n${signed} 🪙${details ? ` · ${details}` : ""}`;
      }).join("\n\n")
      : "Операций пока нет.";

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`📒 История монет — ${target.username}`)
      .setDescription(description.slice(0, 4000))
      .setFooter({ text: "Показаны последние 10 операций • Время: Москва" });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
