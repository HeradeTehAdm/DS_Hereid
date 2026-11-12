const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { RARITY_ORDER, getItemRarity } = require("../economy");
const { economyDisabled } = require("../economy-access");
const shopBrowser = require("../shop-browser");

const START_MODE = { Титулы: "t", Значки: "d", Баннеры: "b", Цвета: "a" };

function sortCatalogItems(items) {
  const categoryOrder = ["Титулы", "Значки", "Баннеры", "Цвета"];
  return [...items].sort((a, b) => {
    const categoryDifference = categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
    if (categoryDifference !== 0) return categoryDifference;
    const rarityDifference = RARITY_ORDER.indexOf(getItemRarity(a)) - RARITY_ORDER.indexOf(getItemRarity(b));
    if (rarityDifference !== 0) return rarityDifference;
    return a.price - b.price || a.name.localeCompare(b.name, "ru");
  });
}

module.exports = {
  sortCatalogItems,
  data: new SlashCommandBuilder()
    .setName("shop")
    .setDescription("Открыть магазин оформления профиля.")
    .addStringOption((option) => option
      .setName("категория")
      .setDescription("Выбери раздел магазина")
      .setRequired(false)
      .addChoices(
        { name: "Титулы", value: "Титулы" },
        { name: "Значки", value: "Значки" },
        { name: "Кастомные баннеры", value: "Баннеры" },
        { name: "Цвета", value: "Цвета" },
      )),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: "Магазин доступен только на сервере.", flags: MessageFlags.Ephemeral });
    }
    if (await economyDisabled(interaction)) return;

    // Любой раздел — интерактивный: картинка-палитра, выбор в меню, редкость, покупка и применение кнопками.
    const category = interaction.options.getString("категория");
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await interaction.editReply(await shopBrowser.openBrowser(interaction.guildId, interaction.user.id, { mode: START_MODE[category] || "t" }));
  },
};
