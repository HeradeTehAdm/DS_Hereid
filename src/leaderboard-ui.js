"use strict";

// Рейтинг картинкой: сборка строк, кнопки режимов и страниц.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, MessageFlags } = require("discord.js");
const lb = require("./leaderboard");
const art = require("./leaderboard-art");
const kit = require("./art-kit");
const { getCustomProfile, getItemRarity } = require("./economy");
const { preload } = require("./shop-browser");
const logger = require("./logger");

const PREFIX = "lb:";
const PAGE_SIZE = 10;
const MAX_PAGES = 5;
const CACHE_MS = 30_000;
const cache = new Map();
const money = (n) => Number(n).toLocaleString("ru-RU");
const RANK_EMOJI = { LEGEND: "👑", ELITE: "💎", MASTER: "🏆", VETERAN: "🔥", ACTIVE: "⚡", MEMBER: "🌟", NEWBIE: "🌱" };

function formatValue(mode, raw) {
  if (mode === "level") return { valueText: `Ур. ${raw.level ?? lb.levelOf(raw.xp)}`, subText: `${money(raw.value)} XP` };
  if (mode === "collection") return { valueText: money(raw.value), subText: "предметов" };
  if (mode === "activity") return { valueText: `${RANK_EMOJI[raw.rank] || "🌱"} ${raw.rank}`, subText: `${money(raw.messages)} сообщ. · ${raw.voiceHours.toFixed(1)} ч в голосе` };
  return { valueText: money(raw.value), subText: "монет" };
}

async function memberInfo(guild, guildId, userId, rank, mode, raw, viewerId) {
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member || member.user.bot) return null;
  const profile = getCustomProfile(guildId, userId);
  const accent = profile.color ? kit.hex(profile.color.value) : ["#7C5CFC", "#1AD6C8"];
  const avatar = await kit.loadAvatar(member.displayAvatarURL({ extension: "png", size: 128 }));
  return {
    rank, name: member.displayName, avatar, accent,
    badge: profile.badge ? String(profile.badge.value) : null,
    titleText: profile.title ? String(profile.title.value) : null,
    titleColor: profile.title ? kit.RARITY_COLOR[getItemRarity(profile.title)] : null,
    isMe: userId === viewerId, ...formatValue(mode, raw),
  };
}

// Участники топа, которые ещё на сервере (до 50 мест).
async function ranking(guild, mode) {
  const key = `${guild.id}:${mode}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.rows;
  const raw = lb.topRows(guild.id, mode);
  const present = [];
  for (const row of raw) {
    const member = await guild.members.fetch(row.user_id).catch(() => null);
    if (member && !member.user.bot) present.push(row);
    if (present.length >= PAGE_SIZE * MAX_PAGES) break;
  }
  cache.set(key, { at: Date.now(), rows: present });
  if (cache.size > 100) cache.clear();
  return present;
}

async function buildBoard(guild, modeKey, page, viewerId) {
  await preload();
  const mode = lb.MODES[modeKey] || lb.MODES.balance;
  const all = await ranking(guild, mode.key);
  const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pages);
  const slice = all.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const rows = [];
  for (let i = 0; i < slice.length; i += 1) {
    const info = await memberInfo(guild, guild.id, slice[i].user_id, (current - 1) * PAGE_SIZE + i + 1, mode.key, slice[i], viewerId);
    if (info) rows.push(info);
  }
  let me = null;
  const mineIndex = all.findIndex((row) => row.user_id === viewerId);
  if (!rows.some((r) => r.isMe)) {
    const position = mineIndex !== -1 ? mineIndex + 1 : lb.positionOf(guild.id, mode.key, viewerId);
    if (position) {
      const mineRaw = mineIndex !== -1 ? all[mineIndex] : await mineRow(guild.id, mode.key, viewerId);
      if (mineRaw) me = await memberInfo(guild, guild.id, viewerId, position, mode.key, mineRaw, viewerId);
    }
  }
  const png = art.renderLeaderboard({ mode, page: current, pages, guildName: guild.name, rows, me });
  return { png, mode, page: current, pages };
}

// Данные самого участника, если он ниже отображаемого топа.
async function mineRow(guildId, mode, userId) {
  const db = require("./database");
  if (mode === "balance") { const r = db.prepare("SELECT balance AS value, xp FROM member_stats WHERE guild_id=? AND user_id=?").get(guildId, userId); return r?.value > 0 ? { user_id: userId, ...r } : null; }
  if (mode === "level") { const r = db.prepare("SELECT xp AS value, xp FROM member_stats WHERE guild_id=? AND user_id=?").get(guildId, userId); return r?.value > 0 ? { user_id: userId, ...r, level: lb.levelOf(r.xp) } : null; }
  if (mode === "collection") { const r = db.prepare("SELECT COUNT(*) AS value FROM economy_inventory WHERE guild_id=? AND user_id=? AND item_id NOT LIKE 'ach\\_%' ESCAPE '\\'").get(guildId, userId); return r?.value > 0 ? { user_id: userId, ...r } : null; }
  const r = db.prepare("SELECT message_count, voice_seconds, current_rank FROM member_rank_activity WHERE guild_id=? AND user_id=?").get(guildId, userId);
  return r ? { user_id: userId, value: r.message_count, rank: String(r.current_rank || "NEWBIE").toUpperCase(), messages: r.message_count, voiceHours: r.voice_seconds / 3600 } : null;
}

function components(modeKey, page, pages, ownerId) {
  const modes = new ActionRowBuilder().addComponents(...Object.values(lb.MODES).map((m) =>
    new ButtonBuilder().setCustomId(`${PREFIX}m:${m.key}:${ownerId}`).setLabel(m.label).setEmoji(m.emoji)
      .setStyle(m.key === modeKey ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(m.key === modeKey)));
  const nav = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${PREFIX}p:${modeKey}:${page - 1}:${ownerId}`).setLabel("Назад").setEmoji("◀️").setStyle(ButtonStyle.Secondary).setDisabled(page <= 1),
    new ButtonBuilder().setCustomId(`${PREFIX}i`).setLabel(`${page} / ${pages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId(`${PREFIX}p:${modeKey}:${page + 1}:${ownerId}`).setLabel("Дальше").setEmoji("▶️").setStyle(ButtonStyle.Secondary).setDisabled(page >= pages),
  );
  return [modes, nav];
}

async function payload(guild, modeKey, page, viewerId) {
  const board = await buildBoard(guild, modeKey, page, viewerId);
  return {
    content: "", files: [new AttachmentBuilder(board.png, { name: `leaderboard-${board.mode.key}.png` })], attachments: [],
    components: components(board.mode.key, board.page, board.pages, viewerId), allowedMentions: { parse: [] },
  };
}

async function handle(interaction) {
  const parts = interaction.customId.split(":");
  const ownerId = parts[parts.length - 1];
  if (parts[1] === "i") return interaction.deferUpdate().catch(() => null);
  if (ownerId !== interaction.user.id) {
    return interaction.reply({ content: "Это таблица другого участника. Открой свою командой `/leaderboard`.", flags: MessageFlags.Ephemeral });
  }
  try {
    await interaction.deferUpdate();
    const mode = parts[2]; const page = parts[1] === "p" ? Number(parts[3]) || 1 : 1;
    await interaction.editReply(await payload(interaction.guild, mode, page, interaction.user.id));
  } catch (error) {
    logger.error("Leaderboard update failed.", error);
  }
  return undefined;
}

module.exports = { PREFIX, PAGE_SIZE, MAX_PAGES, handle, payload, buildBoard, components };
