"use strict";

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, MessageFlags } = require("discord.js");
const { listAchievements } = require("./achievements");
const art = require("./achievements-art");
const kit = require("./art-kit");
const { preload } = require("./shop-browser");
const logger = require("./logger");

const PREFIX = "ach:";

async function payload(guild, targetUser, page, viewerId) {
  await preload();
  const member = await guild.members.fetch(targetUser.id).catch(() => null);
  const name = member?.displayName || targetUser.username;
  const all = listAchievements(guild.id, targetUser.id);
  const pages = Math.max(1, Math.ceil(all.length / art.PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pages);
  const avatar = await kit.loadAvatar((member?.displayAvatarURL || targetUser.displayAvatarURL)?.call(member || targetUser, { extension: "png", size: 128 }));
  const png = art.renderAchievements({
    name, avatar, page: current, pages,
    items: all.slice((current - 1) * art.PAGE_SIZE, current * art.PAGE_SIZE),
    unlocked: all.filter((item) => item.unlocked).length, total: all.length,
    badgesOwned: all.filter((item) => item.unlocked).length,
  });
  const nav = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${PREFIX}p:${current - 1}:${targetUser.id}:${viewerId}`).setLabel("Назад").setEmoji("◀️").setStyle(ButtonStyle.Secondary).setDisabled(current <= 1),
    new ButtonBuilder().setCustomId(`${PREFIX}i`).setLabel(`${current} / ${pages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId(`${PREFIX}p:${current + 1}:${targetUser.id}:${viewerId}`).setLabel("Дальше").setEmoji("▶️").setStyle(ButtonStyle.Secondary).setDisabled(current >= pages),
  );
  return { content: "", files: [new AttachmentBuilder(png, { name: "achievements.png" })], attachments: [], components: [nav], allowedMentions: { parse: [] } };
}

async function handle(interaction) {
  const parts = interaction.customId.split(":");
  if (parts[1] === "i") return interaction.deferUpdate().catch(() => null);
  const [, , page, targetId, viewerId] = parts;
  if (viewerId !== interaction.user.id) {
    return interaction.reply({ content: "Эти достижения открыл другой участник. Открой свои командой `/achievements`.", flags: MessageFlags.Ephemeral });
  }
  try {
    await interaction.deferUpdate();
    const user = await interaction.client.users.fetch(targetId);
    await interaction.editReply(await payload(interaction.guild, user, Number(page) || 1, viewerId));
  } catch (error) { logger.error("Achievements update failed.", error); }
  return undefined;
}

module.exports = { PREFIX, payload, handle };
