const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const ui = require("../achievements-ui");
const { refreshAchievements } = require("../achievement-notify");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("achievements")
    .setDescription("Достижения участника и эксклюзивные значки за них.")
    .addUserOption((option) => option
      .setName("member")
      .setDescription("Чьи достижения посмотреть")
      .setRequired(false)),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: "Достижения доступны только на сервере.", flags: MessageFlags.Ephemeral });
    }
    const user = interaction.options.getUser("member") || interaction.user;
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      return interaction.reply({ content: "Не удалось найти участника на этом сервере.", flags: MessageFlags.Ephemeral });
    }
    await interaction.deferReply();
    // Свежие данные для себя: заодно выдаём значки за всё, что уже выполнено.
    if (user.id === interaction.user.id) await refreshAchievements(interaction.guild, user);
    return interaction.editReply(await ui.payload(interaction.guild, user, 1, interaction.user.id));
  },
};
