const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { economyDisabled } = require("../economy-access");
const casino = require("../casino");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("casino")
    .setDescription("Открыть казино: слоты, монетка и рулетка на монеты сервера."),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: "Казино доступно только на сервере.", flags: MessageFlags.Ephemeral });
    }
    if (await economyDisabled(interaction)) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await interaction.editReply(casino.openPayload(interaction.guildId, interaction.user.id));
  },
};
