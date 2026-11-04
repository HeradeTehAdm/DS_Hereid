const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const db = require("../database");
const { getCustomProfile } = require("../economy");
const { RANKS, ensureMember, snapshot, rankIndexFor } = require("../rank-system");

const RANK_EMOJI = {
  LEGEND: "👑",
  ELITE: "💎",
  MASTER: "🏆",
  VETERAN: "🔥",
  ACTIVE: "⚡",
  MEMBER: "🌟",
  NEWBIE: "🌱",
};

function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return hours ? `${hours} ч. ${minutes} мин.` : `${minutes} мин.`;
}

function progressLine(label, current, required, formatter = (value) => value.toLocaleString("ru-RU")) {
  const value = Math.max(0, Number(current) || 0);
  const target = Math.max(0, Number(required) || 0);
  const percent = target === 0 ? 100 : Math.min(100, Math.floor(value / target * 100));
  const filled = Math.floor(percent / 10);
  const bar = "🟦".repeat(filled) + "⬛".repeat(10 - filled);
  return `**${label}:** ${bar} ${formatter(Math.min(value, target))} / ${formatter(target)} (${percent}%)`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Посмотреть свой ранг, требования и прогресс до следующего.")
    .addUserOption((option) => option
      .setName("member")
      .setDescription("Участник, чей ранг нужно посмотреть")
      .setRequired(false)),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: "Ранги доступны только на сервере.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const user = interaction.options.getUser("member") || interaction.user;
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      return interaction.reply({
        content: "Не удалось найти участника на этом сервере.",
        flags: MessageFlags.Ephemeral,
      });
    }

    let row = db.prepare(
      "SELECT * FROM member_rank_activity WHERE guild_id=? AND user_id=?",
    ).get(interaction.guildId, user.id);
    if (!row) {
      ensureMember(member);
      row = db.prepare(
        "SELECT * FROM member_rank_activity WHERE guild_id=? AND user_id=?",
      ).get(interaction.guildId, user.id);
    }

    const stats = snapshot(row);
    const earnedIndex = rankIndexFor(row);
    const currentIndex = Math.max(0, RANKS.findIndex((rank) => rank.name === row.current_rank));
    const rank = RANKS[currentIndex] || RANKS[0];
    const next = RANKS[Math.min(currentIndex + 1, RANKS.length - 1)];
    const hasNext = currentIndex < RANKS.length - 1;
    let color = 0x5865f2;
    try {
      const custom = getCustomProfile(interaction.guildId, user.id);
      const parsed = custom.color ? Number.parseInt(String(custom.color.value), 16) : NaN;
      if (Number.isFinite(parsed)) color = parsed;
    } catch { /* цвет профиля не обязателен */ }

    const requirements = hasNext ? [
      progressLine("На сервере, дней", stats.days, next.days),
      progressLine("Сообщений", stats.messages, next.messages),
      progressLine("Активных дней", stats.activeDays, next.activeDays),
      progressLine("В голосовых каналах", stats.voiceSeconds, next.voiceSeconds, formatDuration),
    ] : [
      "🏆 Ты достиг максимального ранга **LEGEND**!",
    ];

    const embed = new EmbedBuilder()
      .setColor(color)
      .setAuthor({
        name: member.displayName,
        iconURL: user.displayAvatarURL({ size: 128 }),
      })
      .setTitle(`${RANK_EMOJI[rank.name] || "🌱"} Ранг ${rank.name}`)
      .setDescription([
        `**Текущий ранг:** ${rank.name}`,
        `**Следующий ранг:** ${hasNext ? next.name : "Максимальный ранг"}`,
        `**Всего на сервере:** ${stats.days} дн.`,
        `**Активность в голосе:** ${formatDuration(stats.voiceSeconds)}`,
        "",
        `**Прогресс до ${hasNext ? next.name : "максимума"}**`,
        ...requirements,
        "",
        earnedIndex > currentIndex
          ? "ℹ️ По статистике уже выполнены требования следующего ранга. Если роль не обновилась, проверь, созданы ли ранговые роли и может ли бот управлять ими."
          : "Ранг повышается за устойчивую активность: сообщения, активные дни и общение в голосовых каналах.",
      ].join("\n"))
      .setFooter({ text: "HeradeLegend • /profile — XP и уровень • /leaderboard — рейтинг" })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
