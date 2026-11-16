const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const ui = require("../leaderboard-ui");
const { MODES } = require("../leaderboard");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Рейтинг участников картинкой: баланс, уровень, коллекция, активность.")
    .addStringOption((o) => o.setName("type").setDescription("Какой рейтинг показать")
      .addChoices(...Object.values(MODES).map((m) => ({ name: `${m.emoji} ${m.label}`, value: m.key })))
      .setRequired(false)),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: "Таблица лидеров доступна только на сервере.", flags: MessageFlags.Ephemeral });
    }
    await interaction.deferReply();
    const type = interaction.options.getString("type") || "balance";
    return interaction.editReply(await ui.payload(interaction.guild, type, 1, interaction.user.id));
  },
};
