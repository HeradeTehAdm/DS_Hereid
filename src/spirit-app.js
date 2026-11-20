const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require("discord.js");

function appUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) return null;
    if (url.hostname === "localhost" || url.hostname.endsWith(".localhost")) return null;
    return url.toString();
  } catch { return null; }
}

const DEFAULT_APP_URL = "https://duh-svobody-app.vercel.app";

function configuredAppUrl(value = process.env.SPIRIT_APP_URL) {
  return appUrl(value || DEFAULT_APP_URL);
}

function inviteEmbed(guildName) {
  return new EmbedBuilder()
    .setColor(0x8b5cf6)
    .setTitle("🕊️ Дух Свободы")
    .setDescription("Это всё тот же „Дух Свободы“, теперь с новым интерфейсом прямо в Discord. Загляни в профиль, посмотри свой уровень и награды или подбери оформление под себя.\n\nДальше планируем добавить мини-игры, события, квесты и задания")
    .setFooter({ text: "Herade House 2.0 • Дух Свободы." });
}

const ACTIVITY_LAUNCH_ID = "spirit:launch";

function inviteComponents() {
  return [new ActionRowBuilder().addComponents(new ButtonBuilder()
    .setCustomId(ACTIVITY_LAUNCH_ID)
    .setStyle(ButtonStyle.Primary)
    .setLabel("🚀 Открыть в Discord"))];
}

async function handleLaunchButton(interaction, logger = console) {
  if (!interaction.isButton?.() || interaction.customId !== ACTIVITY_LAUNCH_ID) return false;
  // Discord must acknowledge this button with callback type LAUNCH_ACTIVITY (12).
  // Do not defer/reply before launching or try a second acknowledgement if
  // Discord rejects the callback; that can cause Unknown interaction (10062).
  const memberPermissions = interaction.memberPermissions;
  if (memberPermissions && !memberPermissions.has(PermissionFlagsBits.UseEmbeddedActivities)) {
    await interaction.reply({
      content: "⛔ Не разрешён запуск активностей в этом канале. Попроси администратора сервера включить «Использовать активности» (Use Activities) для твоей роли и канала.",
      flags: 64,
    });
    return true;
  }
  try {
    await interaction.launchActivity();
  } catch (error) {
    if (error?.code === 50013) {
      logger.warn(`Discord denied Spirit Activity launch (50013). guild=${interaction.guildId || "DM"}; memberUseActivities=${memberPermissions?.has?.(PermissionFlagsBits.UseEmbeddedActivities) ?? "unknown"}; appUseActivities=${interaction.appPermissions?.has?.(PermissionFlagsBits.UseEmbeddedActivities) ?? "unknown"}. Check Use Activities permission, channel overrides, server app configuration, and Discord Developer Portal Activities.`);
      return true;
    }
    if (error?.code === 10062) {
      logger.warn("Spirit Activity launch interaction expired (10062). Try clicking the button again.");
      return true;
    }
    throw error;
  }
  return true;
}

function canPublish(channel, botMember) {
  if (!channel || !channel.isTextBased?.() || !channel.send || channel.isDMBased?.()) return false;
  const permissions = channel.permissionsFor(botMember);
  return Boolean(permissions?.has(PermissionFlagsBits.ViewChannel) &&
    permissions?.has(PermissionFlagsBits.SendMessages) &&
    permissions?.has(PermissionFlagsBits.EmbedLinks));
}

async function publishInvite({ guild, channelId, actorId, url }) {
  const cleanUrl = appUrl(url);
  if (!cleanUrl) throw new Error("Укажи корректный HTTPS-адрес приложения в SPIRIT_APP_URL.");
  if (!/^\d{17,20}$/.test(String(channelId))) throw new Error("Некорректный ID канала.");
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  const me = guild.members.me || await guild.members.fetchMe();
  if (!canPublish(channel, me)) throw new Error("Нет доступа к текстовому каналу или прав на отправку сообщений и Embed Links.");
  const sent = await channel.send({ embeds: [inviteEmbed(guild.name)], components: inviteComponents(), allowedMentions: { parse: [] } });
  return { messageId: sent.id, channelId: channel.id, actorId, url: sent.url };
}

module.exports = { appUrl, configuredAppUrl, inviteEmbed, inviteComponents, canPublish, publishInvite, handleLaunchButton, ACTIVITY_LAUNCH_ID };
