const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const { getInventory, getItemRarity, RARITY_ORDER } = require("../economy");
const { economyDisabled } = require("../economy-access");
module.exports = {
  data: new SlashCommandBuilder().setName("inventory").setDescription("Посмотреть купленные предметы.")
    .addUserOption(o => o.setName("member").setDescription("Инвентарь участника").setRequired(false)),
  async execute(interaction) {
    if (!interaction.inGuild()) return interaction.reply({ content: "Инвентарь доступен только на сервере.", flags: MessageFlags.Ephemeral });
    if (await economyDisabled(interaction)) return;
    const user = interaction.options.getUser("member") || interaction.user;
    const items = getInventory(interaction.guildId, user.id).sort((a, b) => {
      const categoryOrder = ["Титулы", "Баннеры", "Значки", "Цвета", "Достижения"];
      const categoryDifference = categoryOrder.indexOf(a.item.category) - categoryOrder.indexOf(b.item.category);
      if (categoryDifference !== 0) return categoryDifference;
      const rarityDifference = RARITY_ORDER.indexOf(getItemRarity(a.item)) - RARITY_ORDER.indexOf(getItemRarity(b.item));
      return rarityDifference || a.item.price - b.item.price || a.item.name.localeCompare(b.item.name, "ru");
    });
    const line = (row) => `• **${row.item.name}** · ${getItemRarity(row.item)} · ${row.item.exclusive ? "🏅 эксклюзив" : `${row.item.price.toLocaleString("ru-RU")} 🪙`} — ID: \`${row.item.id}\``;
    let description = "Инвентарь пуст. Загляни в /shop и забери /daily.";
    if (items.length) {
      const lines = []; let size = 0;
      for (const row of items) {
        const text = line(row);
        if (size + text.length + 1 > 3800) { lines.push(`…и ещё ${items.length - lines.length} предметов. Полный список по категориям смотри в /shop.`); break; }
        lines.push(text); size += text.length + 1;
      }
      description = lines.join("\n");
    }
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle(`🎒 Инвентарь — ${user.username}`).setDescription(description).setFooter({text:"Надеть: /equip item_id:<ID> · Передать: /gift, /trade · Продать: /sell"})], flags: MessageFlags.Ephemeral });
  },
};
