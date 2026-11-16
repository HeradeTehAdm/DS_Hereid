const { SlashCommandBuilder, AttachmentBuilder, MessageFlags } = require("discord.js");
const { getItem, isTradable } = require("../economy");
const { economyDisabled } = require("../economy-access");
const ui = require("../trade-ui");
const art = require("../trade-art");
const { preload } = require("../shop-browser");
const trade = require("../trade");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gift")
    .setDescription("Подарить предмет из инвентаря другому участнику.")
    .addUserOption((o) => o.setName("member").setDescription("Кому подарить").setRequired(true))
    .addStringOption((o) => o.setName("item").setDescription("Какой предмет подарить").setAutocomplete(true).setRequired(true)),

  async autocomplete(interaction) { await ui.itemChoices(interaction, interaction.user.id); },

  async execute(interaction) {
    if (!interaction.inGuild()) return interaction.reply({ content: "Подарки доступны только на сервере.", flags: MessageFlags.Ephemeral });
    if (await economyDisabled(interaction)) return undefined;
    const recipient = interaction.options.getUser("member", true);
    const itemId = interaction.options.getString("item", true);
    if (recipient.bot) return interaction.reply({ content: "Ботам подарки не нужны.", flags: MessageFlags.Ephemeral });
    if (recipient.id === interaction.user.id) return interaction.reply({ content: "Нельзя дарить самому себе.", flags: MessageFlags.Ephemeral });
    const item = getItem(itemId);
    if (!item) return interaction.reply({ content: "Такого предмета нет. Выбери предмет из подсказки.", flags: MessageFlags.Ephemeral });
    if (!isTradable(item)) return interaction.reply({ content: `«${item.name}» нельзя дарить: эксклюзивные значки за достижения остаются у владельца.`, flags: MessageFlags.Ephemeral });
    const mine = trade.tradableInventory(interaction.guildId, interaction.user.id).some((entry) => entry.id === itemId);
    if (!mine) return interaction.reply({ content: `У тебя нет предмета «${item.name}».`, flags: MessageFlags.Ephemeral });
    const theirs = trade.tradableInventory(interaction.guildId, recipient.id).some((entry) => entry.id === itemId);
    if (theirs) return interaction.reply({ content: `У ${recipient} уже есть «${item.name}».`, flags: MessageFlags.Ephemeral });

    await preload();
    const toName = await ui.nameOf(interaction.guild, recipient.id);
    const card = new AttachmentBuilder(art.renderItemCard(item, { label: "Подарок", line1: `Для ${toName}`, line2: "Предмет уйдёт из твоего инвентаря", accent: "#ff7ad9" }), { name: "gift.png" });
    return interaction.reply({
      content: `Подарить «${item.name}» участнику ${recipient}? Если предмет надет, он снимется с тебя.`,
      files: [card], components: [ui.confirmRow(`${ui.PREFIX}gy:${recipient.id}:${item.id}`, "Подарить")],
      allowedMentions: { parse: [] }, flags: MessageFlags.Ephemeral,
    });
  },
};
