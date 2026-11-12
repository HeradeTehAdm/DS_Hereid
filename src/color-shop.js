// Интерактивный раздел магазина «Цвета»: картинка-палитра, выбор цвета меню, покупка и применение кнопками.
const {
  ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
  MessageFlags, StringSelectMenuBuilder,
} = require("discord.js");
const { createCanvas } = require("@napi-rs/canvas");
const { CATALOG, RARITY_ORDER, getItemRarity, getBalance, getInventory, getCustomProfile, buyItem, equipItem } = require("./economy");
const { ensureFonts } = require("./profile-card");
const { isFeatureEnabled } = require("./features");

const PAGE_SIZE = 20; // 5 колонок × 4 ряда, столько же пунктов в меню выбора (лимит Discord — 25)
const PREFIX = "shc";
const COLORS = CATALOG.filter((item) => item.type === "color");
const MODES = {
  a: { label: "Цвета и градиенты", emoji: "🛍️", short: "Все", test: () => true },
  c: { label: "Цвета", emoji: "🎨", short: "Цвета", test: (item) => item.id.startsWith("color_") },
  g: { label: "Градиенты", emoji: "🌈", short: "Градиенты", test: (item) => item.id.startsWith("grad_") },
};
const RARITY_KEYS = ["all", ...RARITY_ORDER];
const RARITY_LABEL = { all: "Все редкости", Обычный: "Обычные", Редкий: "Редкие", Эпический: "Эпические", Легендарный: "Легендарные", Мифический: "Мифические" };
const RARITY_EMOJI = { Обычный: "⚪", Редкий: "🔹", Эпический: "🟣", Легендарный: "🟠", Мифический: "💠" };

const stopsOf = (item) => String(item.value).split("-").map((p) => `#${p}`);
const money = (n) => Number(n).toLocaleString("ru-RU");
const family = (name, size) => `${size}px ${name}, HeradeEmoji, sans-serif`;

function listItems(mode, rarity) {
  return COLORS
    .filter((item) => MODES[mode].test(item) && (rarity === "all" || getItemRarity(item) === rarity))
    .sort((a, b) => a.price - b.price || a.name.localeCompare(b.name, "ru"));
}
function shortName(item) { return item.name.replace(/^(Цвет|Градиент) «/, "").replace(/»$/, ""); }

function paintSwatch(ctx, item, x, y, w, h, r) {
  const stops = stopsOf(item);
  let fill;
  if (stops.length === 1) fill = stops[0];
  else {
    fill = ctx.createLinearGradient(x, y, x + w, y);
    stops.forEach((c, i) => fill.addColorStop(i / (stops.length - 1), c));
  }
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.clip();
  ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
  const shine = ctx.createLinearGradient(0, y, 0, y + h); // лёгкий блик, чтобы цвет выглядел объёмно
  shine.addColorStop(0, "rgba(255,255,255,0.16)"); shine.addColorStop(0.5, "rgba(255,255,255,0)"); shine.addColorStop(1, "rgba(0,0,0,0.10)");
  ctx.fillStyle = shine; ctx.fillRect(x, y, w, h);
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.14)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.stroke();
}
function fit(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}

// Палитра страницы: каждый цвет — цветная плашка с номером, названием, редкостью и ценой.
function renderSheet(items, owned) {
  ensureFonts();
  const cols = 5; const cw = 300; const ch = 200; const pad = 24;
  const rows = Math.max(1, Math.ceil(items.length / cols));
  const canvas = createCanvas(cols * cw + pad, rows * ch + pad);
  const ctx = canvas.getContext("2d");
  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, "#14162a"); bg.addColorStop(1, "#0c0d1a");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
  items.forEach((item, n) => {
    const x = pad + (n % cols) * cw - pad / 2 + pad / 2 - 12; const y = pad / 2 + Math.floor(n / cols) * ch;
    const w = cw - 24;
    paintSwatch(ctx, item, x + 12, y + 8, w, 118, 20);
    ctx.fillStyle = "rgba(8,9,20,0.72)"; ctx.beginPath(); ctx.roundRect(x + 24, y + 20, 44, 30, 15); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = family("HeradeXB", 18); ctx.textAlign = "center"; ctx.fillText(String(n + 1), x + 46, y + 41);
    if (owned.has(item.id)) {
      ctx.fillStyle = "rgba(8,9,20,0.72)"; ctx.beginPath(); ctx.roundRect(x + w - 92, y + 20, 92, 30, 15); ctx.fill();
      ctx.fillStyle = "#7dffb8"; ctx.font = family("HeradeB", 15); ctx.fillText("КУПЛЕНО", x + w - 46, y + 41);
    }
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff"; ctx.font = family("HeradeXB", 21);
    ctx.fillText(fit(ctx, shortName(item), w - 4), x + 14, y + 154);
    ctx.fillStyle = "#a6abc8"; ctx.font = family("HeradeM", 16);
    ctx.fillText(`${getItemRarity(item)} · ${money(item.price)} монет`, x + 14, y + 182);
  });
  return canvas.toBuffer("image/png");
}

// Крупный просмотр: как выбранный цвет красит кольцо аватарки, полоску прогресса и подписи на карточке.
function renderDetail(item) {
  ensureFonts();
  const w = 1000; const h = 420;
  const canvas = createCanvas(w, h); const ctx = canvas.getContext("2d");
  const stops = stopsOf(item);
  const bg = ctx.createLinearGradient(0, 0, w, h); bg.addColorStop(0, "#14162a"); bg.addColorStop(1, "#0b0c18");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  paintSwatch(ctx, item, 30, 30, w - 60, 150, 26);
  ctx.fillStyle = "rgba(8,9,20,0.55)"; ctx.beginPath(); ctx.roundRect(52, 52, 360, 44, 22); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = family("HeradeXB", 26); ctx.textAlign = "left";
  ctx.fillText(fit(ctx, shortName(item).toLocaleUpperCase("ru-RU"), 330), 72, 83);
  const lineGradient = (x0, x1) => {
    if (stops.length === 1) return stops[0];
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
    return g;
  };
  // кольцо аватарки
  ctx.lineWidth = 12; ctx.strokeStyle = lineGradient(60, 200);
  ctx.beginPath(); ctx.arc(130, 290, 62, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "#222844"; ctx.beginPath(); ctx.arc(130, 290, 56, 0, Math.PI * 2); ctx.fill();
  // подписи и полоска прогресса
  ctx.fillStyle = stops.length === 1 ? stops[0] : stops[Math.floor(stops.length / 2)]; ctx.font = family("HeradeB", 20);
  ctx.fillText("УРОВЕНЬ 7  ·  120 XP", 240, 262);
  ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.beginPath(); ctx.roundRect(240, 280, 690, 22, 11); ctx.fill();
  ctx.fillStyle = lineGradient(240, 620); ctx.beginPath(); ctx.roundRect(240, 280, 400, 22, 11); ctx.fill();
  ctx.fillStyle = "#a6abc8"; ctx.font = family("HeradeM", 18);
  ctx.fillText("Так цвет выглядит на карточке /profile", 240, 345);
  ctx.fillStyle = lineGradient(240, 930); ctx.fillRect(240, 372, 690, 5);
  return canvas.toBuffer("image/png");
}

function ownedSet(guildId, userId) { return new Set(getInventory(guildId, userId).map((row) => row.item_id)); }
const state = (mode, rarity, page) => `${mode}:${RARITY_KEYS.indexOf(rarity)}:${page}`;
function parseState(mode, rarityIndex, page) {
  return { mode: MODES[mode] ? mode : "a", rarity: RARITY_KEYS[Number(rarityIndex)] || "all", page: Math.max(0, Number(page) || 0) };
}

function listPayload(guildId, userId, mode, rarity, page, note) {
  const items = listItems(mode, rarity);
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  page = Math.min(page, pages - 1);
  const slice = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const owned = ownedSet(guildId, userId);
  const m = MODES[mode];
  const embed = new EmbedBuilder().setColor(0x7C5CFC)
    .setTitle(`${m.emoji} ${m.label.toLocaleUpperCase("ru-RU")} ПРОФИЛЯ · ${RARITY_LABEL[rarity].toLocaleUpperCase("ru-RU")}`)
    .setDescription([
      note || null,
      `Страница **${page + 1}/${pages}** · всего в разделе: **${items.length}** · твой баланс: **${money(getBalance(guildId, userId).balance)}** 🪙`,
      "Выбери цвет в меню под картинкой (номер совпадает с номером на плашке), чтобы посмотреть его крупно, купить или надеть.",
    ].filter(Boolean).join("\n"))
    .setFooter({ text: "HeradeLegend Atelier · Цвет красит баннер, кольцо аватарки и полоски карточки" });
  const files = [];
  const components = [];
  if (slice.length) {
    embed.setImage("attachment://palette.png");
    files.push(new AttachmentBuilder(renderSheet(slice, owned), { name: "palette.png" }));
    components.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
      .setCustomId(`${PREFIX}:sel:${state(mode, rarity, page)}`)
      .setPlaceholder("Выбери цвет — посмотреть, купить или надеть")
      .addOptions(slice.map((item, n) => ({
        label: `${n + 1}. ${shortName(item)}`.slice(0, 100),
        description: `${getItemRarity(item)} · ${money(item.price)} монет${owned.has(item.id) ? " · куплено" : ""}`.slice(0, 100),
        value: item.id,
        emoji: RARITY_EMOJI[getItemRarity(item)],
      })))));
  } else {
    embed.setDescription("В этом разделе пока ничего нет — попробуй другую редкость.");
  }
  components.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
    .setCustomId(`${PREFIX}:rar:${state(mode, rarity, 0)}`)
    .setPlaceholder("Редкость")
    .addOptions(RARITY_KEYS.map((key) => ({ label: RARITY_LABEL[key], value: key, default: key === rarity, emoji: key === "all" ? "🎯" : RARITY_EMOJI[key] })))));
  components.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${PREFIX}:nav:${state(mode, rarity, Math.max(0, page - 1))}:prev`).setLabel("◀").setStyle(ButtonStyle.Secondary).setDisabled(page <= 0),
    new ButtonBuilder().setCustomId(`${PREFIX}:noop`).setLabel(`${page + 1}/${pages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId(`${PREFIX}:nav:${state(mode, rarity, Math.min(pages - 1, page + 1))}:next`).setLabel("▶").setStyle(ButtonStyle.Secondary).setDisabled(page >= pages - 1),
  ));
  components.push(new ActionRowBuilder().addComponents(...["a", "c", "g"].map((key) => new ButtonBuilder()
    .setCustomId(`${PREFIX}:nav:${state(key, rarity, 0)}:f${key}`)
    .setLabel(`${MODES[key].emoji} ${MODES[key].short}`)
    .setStyle(key === mode ? ButtonStyle.Primary : ButtonStyle.Secondary)
    .setDisabled(key === mode))));
  return { embeds: [embed], files, components, attachments: [] };
}

function detailPayload(guildId, userId, itemId, mode, rarity, page, note) {
  const item = COLORS.find((i) => i.id === itemId);
  if (!item) return listPayload(guildId, userId, mode, rarity, page, "⚠️ Такого цвета нет в каталоге.");
  const owned = ownedSet(guildId, userId).has(item.id);
  const equipped = getCustomProfile(guildId, userId).color?.id === item.id;
  const balance = getBalance(guildId, userId).balance;
  const embed = new EmbedBuilder().setColor(0x7C5CFC)
    .setTitle(`${MODES[item.id.startsWith("grad_") ? "g" : "c"].emoji} ${shortName(item)}`)
    .setDescription([
      note || null,
      `${RARITY_EMOJI[getItemRarity(item)]} **${getItemRarity(item)}** · **${money(item.price)}** 🪙 · ID: \`${item.id}\``,
      equipped ? "✅ Сейчас надет на твой профиль." : owned ? "🎒 Куплен — осталось надеть." : `Твой баланс: **${money(balance)}** 🪙${balance < item.price ? " (не хватает монет)" : ""}`,
    ].filter(Boolean).join("\n"))
    .setImage("attachment://preview.png");
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${PREFIX}:buy:${item.id}:${state(mode, rarity, page)}`).setLabel(owned ? "Куплено" : `Купить за ${money(item.price)}`).setEmoji("🛒").setStyle(ButtonStyle.Success).setDisabled(owned),
    new ButtonBuilder().setCustomId(`${PREFIX}:eq:${item.id}:${state(mode, rarity, page)}`).setLabel(equipped ? "Надето" : "Надеть").setEmoji("✨").setStyle(ButtonStyle.Primary).setDisabled(!owned || equipped),
    new ButtonBuilder().setCustomId(`${PREFIX}:nav:${state(mode, rarity, page)}:back`).setLabel("К списку").setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [embed], files: [new AttachmentBuilder(renderDetail(item), { name: "preview.png" })], components: [row], attachments: [] };
}

function openBrowser(guildId, userId, { mode = "a", rarity = "all" } = {}) {
  return listPayload(guildId, userId, mode, rarity, 0);
}

async function handle(interaction) {
  const [, action, ...rest] = interaction.customId.split(":");
  if (!interaction.inGuild() || !isFeatureEnabled(interaction.guildId, "economy")) {
    await interaction.reply({ content: "Экономика сейчас недоступна.", flags: MessageFlags.Ephemeral });
    return;
  }
  const { guildId } = interaction; const userId = interaction.user.id;
  if (action === "noop") { await interaction.deferUpdate(); return; }
  if (action === "nav") {
    const s = parseState(...rest);
    await interaction.update(listPayload(guildId, userId, s.mode, s.rarity, s.page));
    return;
  }
  if (action === "rar" && interaction.isStringSelectMenu()) {
    const s = parseState(...rest);
    const rarity = RARITY_KEYS.includes(interaction.values[0]) ? interaction.values[0] : "all";
    await interaction.update(listPayload(guildId, userId, s.mode, rarity, 0));
    return;
  }
  if (action === "sel" && interaction.isStringSelectMenu()) {
    const s = parseState(...rest);
    await interaction.update(detailPayload(guildId, userId, interaction.values[0], s.mode, s.rarity, s.page));
    return;
  }
  if (action === "buy" || action === "eq") {
    const [itemId, ...st] = rest; const s = parseState(...st);
    let note;
    if (action === "buy") {
      const r = buyItem(guildId, userId, itemId);
      note = r.ok ? `✅ Куплено! Остаток: **${money(r.balance)}** 🪙${r.questReward ? ` · бонус за задание +${r.questReward}` : ""}`
        : `❌ ${({ already_owned: "Этот цвет уже у тебя.", insufficient_funds: "Недостаточно монет.", unknown_item: "Такого цвета нет." })[r.reason] || "Покупка не выполнена."}`;
    } else {
      const r = equipItem(guildId, userId, itemId);
      note = r.ok ? "✅ Надето! Проверь результат в `/profile`." : "❌ Сначала купи этот цвет.";
    }
    await interaction.update(detailPayload(guildId, userId, itemId, s.mode, s.rarity, s.page, note));
    return;
  }
  await interaction.reply({ content: "⚠️ Это действие больше недоступно. Открой магазин заново: /shop.", flags: MessageFlags.Ephemeral });
}

module.exports = { openBrowser, handle, listItems, renderSheet, renderDetail, listPayload, detailPayload, PREFIX };
