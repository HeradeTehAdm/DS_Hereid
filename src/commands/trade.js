const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { economyDisabled } = require("../economy-access");
const ui = require("../trade-ui");
const trade = require("../trade");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("trade")
    .setDescription("Предложить обмен предметами и монетами другому участнику.")
    .addUserOption((o) => o.setName("member").setDescription("С кем меняться").setRequired(true))
    .addStringOption((o) => o.setName("give").setDescription("Что отдаёшь ты (предмет)").setAutocomplete(true).setRequired(false))
    .addIntegerOption((o) => o.setName("give_coins").setDescription("Сколько монет отдаёшь ты").setMinValue(1).setMaxValue(trade.MAX_COINS).setRequired(false))
    .addStringOption((o) => o.setName("take").setDescription("Что хочешь получить (предмет партнёра)").setAutocomplete(true).setRequired(false))
    .addIntegerOption((o) => o.setName("take_coins").setDescription("Сколько монет хочешь получить").setMinValue(1).setMaxValue(trade.MAX_COINS).setRequired(false)),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name === "give") return ui.itemChoices(interaction, interaction.user.id);
    const partner = interaction.options.get("member")?.value;
    if (focused.name === "take" && partner) return ui.itemChoices(interaction, String(partner));
    return interaction.respond([]);
  },

  async execute(interaction) {
    if (!interaction.inGuild()) return interaction.reply({ content: "Обмен доступен только на сервере.", flags: MessageFlags.Ephemeral });
    if (await economyDisabled(interaction)) return undefined;
    const partner = interaction.options.getUser("member", true);
    if (partner.bot) return interaction.reply({ content: "Ботам обмен не нужен.", flags: MessageFlags.Ephemeral });
    const result = trade.createOffer({
      guildId: interaction.guildId, fromId: interaction.user.id, toId: partner.id,
      giveItem: interaction.options.getString("give"), giveCoins: interaction.options.getInteger("give_coins") || 0,
      takeItem: interaction.options.getString("take"), takeCoins: interaction.options.getInteger("take_coins") || 0,
    });
    if (!result.ok) return interaction.reply({ content: `❌ ${ui.createReason(result)}`, flags: MessageFlags.Ephemeral });
    await interaction.reply(await ui.offerMessage(interaction.guild, result.offer));
    const message = await interaction.fetchReply().catch(() => null);
    if (message) ui.scheduleExpiry(message, interaction.guild, result.offer.id);
    return undefined;
  },
};
