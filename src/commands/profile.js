const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags } = require("discord.js");
const { getProfile, levelForXp } = require("../member-profile");
const { getCustomProfile, getInventory, getItemRarity } = require("../economy");
const { renderProfileCard } = require("../profile-card");

const BANNER_STYLE = {
  Океан: { emoji: "🌊", label: "Океан" },
  Лес: { emoji: "🌿", label: "Лес" },
  Закат: { emoji: "🌅", label: "Закат" },
  Неон: { emoji: "💠", label: "Неон" },
  Галактика: { emoji: "🌌", label: "Галактика" },
  Золото: { emoji: "👑", label: "Золото" },
  Лёд: { emoji: "❄️", label: "Лёд" },
  Тень: { emoji: "🌑", label: "Тень" },
  Тыква: { emoji: "🎃", label: "Тыква" },
  Кладбище: { emoji: "👻", label: "Кладбище" },
  Рассвет: { emoji: "🌄", label: "Рассвет" },
  Озеро: { emoji: "🏞️", label: "Озеро" },
  Дюны: { emoji: "🏜️", label: "Дюны" },
  Сакура: { emoji: "🌸", label: "Сакура" },
  Гроза: { emoji: "⛈️", label: "Гроза" },
  Осень: { emoji: "🍂", label: "Осень" },
  Мегаполис: { emoji: "🌃", label: "Мегаполис" },
  Орбита: { emoji: "🛰️", label: "Орбита" },
  Вулкан: { emoji: "🌋", label: "Вулкан" },
  Замок: { emoji: "🏰", label: "Замок" },
  Храм: { emoji: "⛩️", label: "Храм" },
  Феникс: { emoji: "🔥", label: "Феникс" },
  Разрыв: { emoji: "🌀", label: "Разрыв" },
  Фрактал: { emoji: "🔮", label: "Фрактал" },
  Древо: { emoji: "🌳", label: "Древо" },
  Лаванда: { emoji: "💜", label: "Лаванда" },
  Лагерь: { emoji: "⛺", label: "Лагерь" },
  Гавань: { emoji: "⛵", label: "Гавань" },
  Деревня: { emoji: "🏘️", label: "Деревня" },
  Тропики: { emoji: "🌴", label: "Тропики" },
  Бамбук: { emoji: "🎋", label: "Бамбук" },
  Аврора: { emoji: "🌌", label: "Аврора" },
  Призрак: { emoji: "☠️", label: "Призрак" },
  Пар: { emoji: "⚙️", label: "Пар" },
  Руины: { emoji: "🗿", label: "Руины" },
  Дракон: { emoji: "🐉", label: "Дракон" },
  Мост: { emoji: "🌈", label: "Мост" },
  Дыра: { emoji: "🕳️", label: "Дыра" },
  Кристалл: { emoji: "💎", label: "Кристалл" },
  Часы: { emoji: "🕰️", label: "Часы" },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Посмотреть графическую карточку профиля и прогресс участника.")
    .addUserOption((option) => option
      .setName("member")
      .setDescription("Чей профиль посмотреть")
      .setRequired(false)),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: "Профили доступны только на сервере.", flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply();
    const user = interaction.options.getUser("member") || interaction.user;
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    const profile = getProfile(interaction.guildId, user.id);
    const custom = getCustomProfile(interaction.guildId, user.id);
    const inventory = getInventory(interaction.guildId, user.id);

    const level = levelForXp(profile.xp);
    const next = 100 * (level + 1) ** 2;
    const base = 100 * level ** 2;
    const progress = Math.max(0, Number(profile.xp) - base);
    const needed = Math.max(1, next - base);
    const percent = Math.min(100, Math.floor((progress / needed) * 100));
    const color = custom.color ? Number.parseInt(custom.color.value, 16) : 0x5865f2;
    const banner = custom.banner ? BANNER_STYLE[custom.banner.value] : null;
    const badge = custom.badge?.value || "🌱";
    const title = custom.title?.value || "Участник сообщества";
    const displayName = member?.displayName || user.globalName || user.username;
    const xp = Number(profile.xp || 0);
    const balance = Number(profile.balance || 0);

    let imageBuffer;
    try {
      imageBuffer = await renderProfileCard({
        user, displayName, title, titleRarity: custom.title ? getItemRarity(custom.title) : null, badge, banner: custom.banner,
        level, xp, balance, percent, inventoryCount: inventory.length,
        joinedAt: member?.joinedTimestamp || null,
        colorValue: custom.color?.value || null,
      });
    } catch (error) {
      console.error("[profile] Не удалось создать графическую карточку:", error);
    }

    const embed = new EmbedBuilder()
      .setColor(Number.isFinite(color) ? color : 0x5865f2)
      .setAuthor({ name: `${badge} ${displayName} • HERADELEGEND`, iconURL: user.displayAvatarURL({ size: 128 }) })
      .setTitle(`${banner ? banner.emoji : "✨"} ${title}`)
      .setDescription([
        member ? `👤 **Участник:** ${member}` : "⚪ **Статус:** не состоит на сервере",
        banner ? `🖼️ **Баннер:** ${banner.emoji} ${banner.label}` : "🖼️ **Баннер:** классический",
        "",
        `**ПРОГРЕСС ДО УРОВНЯ ${level + 1}**`,
        `${"🟪".repeat(Math.min(12, Math.floor(percent / 100 * 12)))}${"⬛".repeat(12 - Math.min(12, Math.floor(percent / 100 * 12)))} **${percent}%**`,
        `${progress.toLocaleString("ru-RU")} / ${needed.toLocaleString("ru-RU")} XP до следующего уровня`,
      ].join("\n"))
      .addFields(
        { name: "🏆 УРОВЕНЬ", value: `**${level}**`, inline: true },
        { name: "✨ ОПЫТ", value: `**${xp.toLocaleString("ru-RU")} XP**`, inline: true },
        { name: "🪙 БАЛАНС", value: `**${balance.toLocaleString("ru-RU")}**`, inline: true },
        { name: "🪄 МОЁ ОФОРМЛЕНИЕ", value: [`**Титул:** ${custom.title?.value || "—"}`, `**Значок:** ${custom.badge?.value || "—"}`, `**Баннер:** ${custom.banner?.name || "Классика"}`, `**Цвет:** ${custom.color?.name || "Стандартный"}`].join("\n"), inline: true },
        { name: "🎒 КОЛЛЕКЦИЯ", value: `Предметов собрано: **${inventory.length}**\n${inventory.length ? "Меняй стиль когда захочешь." : "Собери свой стиль в /shop."}`, inline: true },
        { name: "🛍️ ИЗМЕНИТЬ СТИЛЬ", value: "Покупай в **/shop**, смотри **/inventory**, применяй через **/equip**.", inline: false },
      )
      .setFooter({ text: "HeradeLegend • Твой профиль, твой стиль" })
      .setTimestamp();

    if (imageBuffer) {
      // Send the complete card as a single image attachment. The PNG itself lays out
      // the banner first and all profile details beneath it, avoiding Discord's
      // embed layout which always places embed images after the text and fields.
      const attachment = new AttachmentBuilder(imageBuffer, { name: "profile-card.png" });
      await interaction.editReply({ content: "", embeds: [], files: [attachment] });
    } else {
      embed.setThumbnail(user.displayAvatarURL({ size: 512 }));
      await interaction.editReply({ embeds: [embed] });
    }
  },
};
