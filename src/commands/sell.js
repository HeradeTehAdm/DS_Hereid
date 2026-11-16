const { SlashCommandBuilder, AttachmentBuilder, MessageFlags } = require("discord.js");
const { getItem, isTradable, sellPrice, SELL_RATE } = require("../economy");
const { economyDisabled } = require("../economy-access");
const ui = require("../trade-ui");
const art = require("../trade-art");
const { preload } = require("../shop-browser");
const trade = require("../trade");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("sell")
    .setDescription(`Продать предмет боту за ${Math.round(SELL_RATE * 100)}% его цены.`)
    .addStringOption((o) => o.setName("item").setDescription("Какой предмет продать").setAutocomplete(true).setRequired(true)),

  async autocomplete(interaction) { await ui.itemChoices(interaction, interaction.user.id); },

  async execute(interaction) {
    if (!interaction.inGuild()) return interaction.reply({ content: "Продажа доступна только на сервере.", flags: MessageFlags.Ephemeral });
    if (await economyDisabled(interaction)) return undefined;
    const item = getItem(interaction.options.getString("item", true));
    if (!item) return interaction.reply({ content: "Такого предмета нет. Выбери предмет из подсказки.", flags: MessageFlags.Ephemeral });
    if (!isTradable(item)) return interaction.reply({ content: `«${item.name}» нельзя продать: эксклюзивные значки за достижения нельзя ни продать, ни передать.`, flags: MessageFlags.Ephemeral });
    if (!trade.tradableInventory(interaction.guildId, interaction.user.id).some((entry) => entry.id === item.id)) {
      return interaction.reply({ content: `У тебя нет предмета «${item.name}».`, flags: MessageFlags.Ephemeral });
    }
    await preload();
    const refund = sellPrice(item);
    const card = new AttachmentBuilder(art.renderItemCard(item, { label: "Продажа боту", line1: `Ты получишь ${ui.money(refund)} монет`, line2: `${Math.round(SELL_RATE * 100)}% от цены ${ui.money(item.price)}`, accent: "#ffb347" }), { name: "sell.png" });
    return interaction.reply({
      content: `Продать «${item.name}»? Вернуть предмет можно только повторной покупкой за полную цену.`,
      files: [card], components: [ui.confirmRow(`${ui.PREFIX}sy:${item.id}`, `Продать за ${ui.money(refund)}`)],
      flags: MessageFlags.Ephemeral,
    });
  },
};
