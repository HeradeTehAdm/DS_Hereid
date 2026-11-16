const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const { buyItem } = require("../economy");
const { economyDisabled } = require("../economy-access");
const { refreshAchievements } = require("../achievement-notify");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("buy")
    .setDescription("Купить предмет в магазине.")
    .addStringOption((option) => option.setName("item_id").setDescription("ID предмета из /shop").setRequired(true)),
  async execute(interaction) {
    if (!interaction.inGuild()) return interaction.reply({ content: "Покупки доступны только на сервере.", flags: MessageFlags.Ephemeral });
    if (await economyDisabled(interaction)) return;
    const itemId = interaction.options.getString("item_id").trim();
    const result = buyItem(interaction.guildId, interaction.user.id, itemId);
    const messages = {
      already_owned: "Этот предмет уже есть в твоём инвентаре.",
      insufficient_funds: "Недостаточно монет для покупки.",
      unknown_item: "Такого предмета нет в каталоге. Скопируй ID из команды /shop.",
      not_for_sale: "Этот значок нельзя купить: он выдаётся только за достижение. Смотри /achievements.",
    };
    const description = result.ok
      ? `Куплено: **${result.item.name}** за **${result.item.price}** монет.${result.questReward ? `\nБонус за задание: **+${result.questReward}** монет.` : ""}\nОстаток: **${result.balance.toLocaleString("ru-RU")}** монет.\n\nПрименить предмет можно командой /equip с его ID.`
      : `${messages[result.reason] || "Покупка не выполнена."}${result.balance !== undefined ? `\nБаланс: **${result.balance.toLocaleString("ru-RU")}** монет.` : ""}`;
    const embed = new EmbedBuilder().setColor(result.ok ? 0x1ABC9C : 0xE74C3C)
      .setTitle(result.ok ? "✅ Покупка успешна" : "❌ Не удалось купить")
      .setDescription(description);
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    if (result.ok) await refreshAchievements(interaction.guild, interaction.user);
  },
};
