// Интерактивный магазин: картинка-палитра, выбор в меню, фильтр редкости, покупка и применение кнопками.
// Разделы: цвета и градиенты, баннеры, титулы, значки.
const {
  ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
  MessageFlags, StringSelectMenuBuilder,
} = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { CATALOG, RARITY_ORDER, getItemRarity, getBalance, getInventory, getCustomProfile, buyItem, equipItem } = require("./economy");
const { ensureFonts, THEMES } = require("./profile-card");
const assets = require("./profile-assets");
const { isFeatureEnabled } = require("./features");
const { ITEM_STYLE } = require("./shop-style");

const PREFIX = "shc";
const MODES = {
  a: { type: "color", label: "Цвета и градиенты", emoji: "🛍️", short: "Все", kind: "color", page: 20, cols: 5, test: () => true, input: "цвет" },
  c: { type: "color", label: "Цвета", emoji: "🎨", short: "Цвета", kind: "color", page: 20, cols: 5, test: (item) => item.id.startsWith("color_"), input: "цвет" },
  g: { type: "color", label: "Градиенты", emoji: "🌈", short: "Градиенты", kind: "color", page: 20, cols: 5, test: (item) => item.id.startsWith("grad_"), input: "цвет" },
  b: { type: "banner", label: "Баннеры", emoji: "🖼️", short: "Баннеры", kind: "banner", page: 10, cols: 2, test: () => true, input: "баннер" },
  t: { type: "title", label: "Титулы", emoji: "🏷️", short: "Титулы", kind: "title", page: 15, cols: 3, test: () => true, input: "титул" },
  d: { type: "badge", label: "Значки", emoji: "🎖️", short: "Значки", kind: "badge", page: 8, cols: 4, test: () => true, input: "значок" },
};
const SECTION_BUTTONS = [["a", "🎨 Цвета"], ["b", "🖼️ Баннеры"], ["t", "🏷️ Титулы"], ["d", "🎖️ Значки"]];
const GROUP = { a: "a", c: "a", g: "a", b: "b", t: "t", d: "d" };
const PROFILE_KEY = { color: "color", banner: "banner", title: "title", badge: "badge" };
const SHOP_TYPES = new Set(["color", "banner", "title", "badge"]);
const ITEMS = CATALOG.filter((item) => SHOP_TYPES.has(item.type));
const RARITY_KEYS = ["all", ...RARITY_ORDER];
const RARITY_LABEL = { all: "Все редкости", Обычный: "Обычные", Редкий: "Редкие", Эпический: "Эпические", Легендарный: "Легендарные", Мифический: "Мифические" };
const RARITY_EMOJI = { Обычный: "⚪", Редкий: "🔹", Эпический: "🟣", Легендарный: "🟠", Мифический: "💠" };
const RARITY_COLOR = { Обычный: "#A9AEC4", Редкий: "#5EB6FF", Эпический: "#B07CFF", Легендарный: "#FFB347", Мифический: "#5EF5FF" };

const money = (n) => Number(n).toLocaleString("ru-RU");
const family = (name, size) => `${size}px ${name}, HeradeEmoji, sans-serif`;
const stopsOf = (item) => String(item.value).split("-").map((p) => `#${p}`);

function listItems(mode, rarity = "all") {
  const m = MODES[mode];
  return ITEMS
    .filter((item) => item.type === m.type && m.test(item) && (rarity === "all" || getItemRarity(item) === rarity))
    .sort((a, b) => a.price - b.price || a.name.localeCompare(b.name, "ru"));
}
function shortName(item) {
  if (item.type === "title") return String(item.value);
  return item.name.replace(/^[^«]*«/, "").replace(/»$/, "");
}
function fit(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}
function pill(ctx, x, y, w, h, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill(); }
function numberBadge(ctx, x, y, n) {
  pill(ctx, x, y, 44, 30, "rgba(8,9,20,0.72)");
  ctx.fillStyle = "#fff"; ctx.font = family("HeradeXB", 18); ctx.textAlign = "center"; ctx.fillText(String(n), x + 22, y + 21); ctx.textAlign = "left";
}
function ownedBadge(ctx, rightX, y) {
  pill(ctx, rightX - 92, y, 92, 30, "rgba(8,9,20,0.72)");
  ctx.fillStyle = "#7dffb8"; ctx.font = family("HeradeB", 15); ctx.textAlign = "center"; ctx.fillText("КУПЛЕНО", rightX - 46, y + 21); ctx.textAlign = "left";
}
function background(ctx, w, h) {
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#14162a"); bg.addColorStop(1, "#0c0d1a");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
}
function priceLine(item) { return `${getItemRarity(item)} · ${money(item.price)} монет`; }

// ---------- цвета ----------
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
  const shine = ctx.createLinearGradient(0, y, 0, y + h);
  shine.addColorStop(0, "rgba(255,255,255,0.16)"); shine.addColorStop(0.5, "rgba(255,255,255,0)"); shine.addColorStop(1, "rgba(0,0,0,0.10)");
  ctx.fillStyle = shine; ctx.fillRect(x, y, w, h);
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.14)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.stroke();
}
function sheetColors(items, owned) {
  const cols = 5; const cw = 300; const ch = 200; const pad = 24;
  const rows = Math.max(1, Math.ceil(items.length / cols));
  const canvas = createCanvas(cols * cw + pad, rows * ch + pad);
  const ctx = canvas.getContext("2d");
  background(ctx, canvas.width, canvas.height);
  items.forEach((item, n) => {
    const x = pad + (n % cols) * cw - 12; const y = pad / 2 + Math.floor(n / cols) * ch;
    const w = cw - 24;
    paintSwatch(ctx, item, x + 12, y + 8, w, 118, 20);
    numberBadge(ctx, x + 24, y + 20, n + 1);
    if (owned.has(item.id)) ownedBadge(ctx, x + 12 + w - 12, y + 20);
    ctx.fillStyle = "#ffffff"; ctx.font = family("HeradeXB", 21);
    ctx.fillText(fit(ctx, shortName(item), w - 4), x + 14, y + 154);
    ctx.fillStyle = "#a6abc8"; ctx.font = family("HeradeM", 16);
    ctx.fillText(priceLine(item), x + 14, y + 182);
  });
  return { buffer: canvas.toBuffer("image/png"), ext: "png" };
}

// ---------- баннеры ----------
const bannerCache = new Map();
let preloading = null;
// Картинки баннеров декодируются асинхронно: загружаем их один раз, дальше рисуем синхронно из кэша.
function preload() {
  if (!preloading) {
    preloading = Promise.all(Object.values(THEMES).map(async (theme) => {
      if (!theme.file || bannerCache.has(theme.file)) return;
      try {
        const data = assets.banners[theme.file.replace(/\.jpg$/, "")];
        if (data) bannerCache.set(theme.file, await loadImage(Buffer.from(data, "base64")));
      } catch (error) { console.warn(`[shop] Баннер ${theme.file} не загрузился:`, error.message); }
    })).then(() => undefined);
  }
  return preloading;
}
preload().catch(() => {});
function bannerImage(value) {
  const theme = THEMES[value];
  return (theme?.file && bannerCache.get(theme.file)) || null;
}
function paintBanner(ctx, item, x, y, w, h, r) {
  const image = bannerImage(item.value);
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.clip();
  if (image) ctx.drawImage(image, 0, 0, image.width, image.height, x, y, w, h);
  else {
    const colors = THEMES[item.value]?.colors || ["#1a1c33", "#7C5CFC", "#1AD6C8"];
    const g = ctx.createLinearGradient(x, y, x + w, y);
    colors.forEach((c, i) => g.addColorStop(i / (colors.length - 1), c));
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.14)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.stroke();
}
function sheetBanners(items, owned) {
  const cols = 2; const cw = 650; const ch = 190; const pad = 24;
  const rows = Math.max(1, Math.ceil(items.length / cols));
  const canvas = createCanvas(cols * cw + pad, rows * ch + pad);
  const ctx = canvas.getContext("2d");
  background(ctx, canvas.width, canvas.height);
  items.forEach((item, n) => {
    const x = pad + (n % cols) * cw - 12; const y = pad / 2 + Math.floor(n / cols) * ch;
    const w = cw - 24;
    paintBanner(ctx, item, x + 12, y + 8, w, 118, 18);
    numberBadge(ctx, x + 24, y + 20, n + 1);
    if (owned.has(item.id)) ownedBadge(ctx, x + 12 + w - 12, y + 20);
    ctx.fillStyle = "#ffffff"; ctx.font = family("HeradeXB", 22);
    ctx.fillText(fit(ctx, shortName(item), w - 4), x + 14, y + 152);
    ctx.fillStyle = "#a6abc8"; ctx.font = family("HeradeM", 16);
    ctx.fillText(priceLine(item), x + 14, y + 178);
  });
  return { buffer: canvas.toBuffer("image/jpeg", 90), ext: "jpg" };
}

// ---------- титулы ----------
function sheetTitles(items, owned) {
  const cols = 3; const cw = 430; const ch = 138; const pad = 24;
  const rows = Math.max(1, Math.ceil(items.length / cols));
  const canvas = createCanvas(cols * cw + pad, rows * ch + pad);
  const ctx = canvas.getContext("2d");
  background(ctx, canvas.width, canvas.height);
  items.forEach((item, n) => {
    const x = pad / 2 + (n % cols) * cw; const y = pad / 2 + Math.floor(n / cols) * ch;
    const w = cw - 24; const h = ch - 20; const rc = RARITY_COLOR[getItemRarity(item)];
    const card = ctx.createLinearGradient(x, y, x + w, y + h);
    card.addColorStop(0, "rgba(255,255,255,0.09)"); card.addColorStop(1, "rgba(255,255,255,0.03)");
    ctx.fillStyle = card; ctx.beginPath(); ctx.roundRect(x + 12, y + 8, w, h, 18); ctx.fill();
    ctx.strokeStyle = rc; ctx.globalAlpha = 0.55; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x + 12, y + 8, w, h, 18); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.fillStyle = rc; ctx.beginPath(); ctx.roundRect(x + 12, y + 24, 6, h - 32, 3); ctx.fill();
    numberBadge(ctx, x + 32, y + 20, n + 1);
    if (owned.has(item.id)) ownedBadge(ctx, x + 12 + w - 12, y + 20);
    ctx.fillStyle = "#ffffff"; ctx.font = family("HeradeXB", 26);
    ctx.fillText(fit(ctx, shortName(item), w - 44), x + 34, y + 84);
    ctx.fillStyle = rc; ctx.font = family("HeradeB", 15);
    ctx.fillText(`${getItemRarity(item).toLocaleUpperCase("ru-RU")} · ${money(item.price)} монет`, x + 34, y + 112);
  });
  return { buffer: canvas.toBuffer("image/png"), ext: "png" };
}

// ---------- значки ----------
function sheetBadges(items, owned) {
  const cols = 4; const cw = 320; const ch = 232; const pad = 24;
  const rows = Math.max(1, Math.ceil(items.length / cols));
  const canvas = createCanvas(cols * cw + pad, rows * ch + pad);
  const ctx = canvas.getContext("2d");
  background(ctx, canvas.width, canvas.height);
  items.forEach((item, n) => {
    const x = pad / 2 + (n % cols) * cw; const y = pad / 2 + Math.floor(n / cols) * ch;
    const w = cw - 24; const rc = RARITY_COLOR[getItemRarity(item)];
    const tile = ctx.createRadialGradient(x + 12 + w / 2, y + 8 + 75, 10, x + 12 + w / 2, y + 8 + 75, w / 1.6);
    tile.addColorStop(0, "rgba(255,255,255,0.14)"); tile.addColorStop(1, "rgba(255,255,255,0.03)");
    ctx.fillStyle = tile; ctx.beginPath(); ctx.roundRect(x + 12, y + 8, w, 150, 20); ctx.fill();
    ctx.strokeStyle = rc; ctx.globalAlpha = 0.55; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x + 12, y + 8, w, 150, 20); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.fillStyle = rc; ctx.font = family("HeradeEmoji", 78); ctx.textAlign = "center";
    ctx.fillText(String(item.value), x + 12 + w / 2, y + 8 + 100); ctx.textAlign = "left";
    numberBadge(ctx, x + 24, y + 20, n + 1);
    if (owned.has(item.id)) ownedBadge(ctx, x + 12 + w - 12, y + 20);
    ctx.fillStyle = "#ffffff"; ctx.font = family("HeradeXB", 21);
    ctx.fillText(fit(ctx, shortName(item), w - 4), x + 14, y + 190);
    ctx.fillStyle = "#a6abc8"; ctx.font = family("HeradeM", 16);
    ctx.fillText(priceLine(item), x + 14, y + 216);
  });
  return { buffer: canvas.toBuffer("image/png"), ext: "png" };
}

function renderSheet(items, owned, kind = "color") {
  ensureFonts();
  if (kind === "banner") return sheetBanners(items, owned);
  if (kind === "title") return sheetTitles(items, owned);
  if (kind === "badge") return sheetBadges(items, owned);
  return sheetColors(items, owned);
}

// ---------- крупный просмотр ----------
function renderDetail(item) {
  ensureFonts();
  const w = 1000;
  const rc = RARITY_COLOR[getItemRarity(item)];
  if (item.type === "banner") {
    const canvas = createCanvas(w, 340); const ctx = canvas.getContext("2d"); background(ctx, w, 340);
    paintBanner(ctx, item, 30, 30, w - 60, 190, 26);
    ctx.fillStyle = "rgba(8,9,20,0.55)"; ctx.beginPath(); ctx.roundRect(52, 52, 400, 44, 22); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = family("HeradeXB", 24);
    ctx.fillText(fit(ctx, (THEMES[item.value]?.label || shortName(item)).toLocaleUpperCase("ru-RU"), 360), 72, 83);
    const ring = ctx.createLinearGradient(60, 200, 200, 330);
    ring.addColorStop(0, "#7C5CFC"); ring.addColorStop(1, "#1AD6C8");
    ctx.lineWidth = 12; ctx.strokeStyle = ring; ctx.beginPath(); ctx.arc(130, 232, 56, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#222844"; ctx.beginPath(); ctx.arc(130, 232, 50, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = family("HeradeXB", 34); ctx.fillText("Nikitinka", 214, 268);
    ctx.fillStyle = "#a6abc8"; ctx.font = family("HeradeM", 18); ctx.fillText("Так баннер выглядит на карточке /profile", 214, 300);
    return canvas.toBuffer("image/jpeg", 92);
  }
  const h = 280;
  const canvas = createCanvas(w, h); const ctx = canvas.getContext("2d"); background(ctx, w, h);
  if (item.type === "title") {
    const card = ctx.createLinearGradient(30, 40, w - 30, 220);
    card.addColorStop(0, "rgba(124,92,252,0.30)"); card.addColorStop(1, "rgba(26,214,200,0.10)");
    ctx.fillStyle = card; ctx.beginPath(); ctx.roundRect(30, 40, w - 60, 170, 24); ctx.fill();
    ctx.strokeStyle = "rgba(167,139,250,0.7)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(30, 40, w - 60, 170, 24); ctx.stroke();
    ctx.fillStyle = "#a78bfa"; ctx.beginPath(); ctx.roundRect(48, 64, 8, 122, 4); ctx.fill();
    ctx.fillStyle = "#a78bfa"; ctx.font = family("HeradeB", 20); ctx.fillText("ТИТУЛ УЧАСТНИКА", 82, 92);
    ctx.fillStyle = "#fff"; ctx.font = family("HeradeXB", 56); ctx.fillText(fit(ctx, String(item.value), 560), 82, 160);
    const label = getItemRarity(item).toLocaleUpperCase("ru-RU");
    ctx.font = family("HeradeB", 20); const pw = ctx.measureText(label).width + 56;
    ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.beginPath(); ctx.roundRect(w - 60 - pw, 100, pw, 48, 24); ctx.fill();
    ctx.strokeStyle = rc; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(w - 60 - pw, 100, pw, 48, 24); ctx.stroke();
    ctx.fillStyle = rc; ctx.fillText(label, w - 60 - pw + 28, 132);
    ctx.fillStyle = "#a6abc8"; ctx.font = family("HeradeM", 18); ctx.fillText("Так титул выглядит на карточке /profile", 48, 246);
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.beginPath(); ctx.roundRect(30, 30, 220, 220, 28); ctx.fill();
    ctx.strokeStyle = rc; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(30, 30, 220, 220, 28); ctx.stroke();
    ctx.fillStyle = rc; ctx.font = family("HeradeEmoji", 130); ctx.textAlign = "center"; ctx.fillText(String(item.value), 140, 175); ctx.textAlign = "left";
    ctx.fillStyle = "#fff"; ctx.font = family("HeradeXB", 44); ctx.fillText(fit(ctx, shortName(item), 640), 290, 110);
    ctx.fillStyle = "#a6abc8"; ctx.font = family("HeradeM", 22); ctx.fillText("Так значок выглядит рядом с ником:", 290, 160);
    ctx.fillStyle = "rgba(255,255,255,0.07)"; ctx.beginPath(); ctx.roundRect(290, 180, 600, 56, 28); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = family("HeradeB", 24); ctx.fillText(`${item.value}  Nikitinka • HERADELEGEND`, 316, 217);
  }
  return canvas.toBuffer("image/png");
}

// ---------- сообщения ----------
function ownedSet(guildId, userId) { return new Set(getInventory(guildId, userId).map((row) => row.item_id)); }
const state = (mode, rarity, page) => `${mode}:${RARITY_KEYS.indexOf(rarity)}:${page}`;
function parseState(mode, rarityIndex, page) {
  return { mode: MODES[mode] ? mode : "t", rarity: RARITY_KEYS[Number(rarityIndex)] || "all", page: Math.max(0, Number(page) || 0) };
}
function optionEmoji(item) { return ITEM_STYLE[item.id]?.emoji || RARITY_EMOJI[getItemRarity(item)]; }

function listPayload(guildId, userId, mode, rarity, page, note) {
  const m = MODES[mode];
  const items = listItems(mode, rarity);
  const pages = Math.max(1, Math.ceil(items.length / m.page));
  page = Math.min(page, pages - 1);
  const slice = items.slice(page * m.page, (page + 1) * m.page);
  const owned = ownedSet(guildId, userId);
  const embed = new EmbedBuilder().setColor(0x7C5CFC)
    .setTitle(`${m.emoji} ${m.label.toLocaleUpperCase("ru-RU")} ПРОФИЛЯ · ${RARITY_LABEL[rarity].toLocaleUpperCase("ru-RU")}`)
    .setDescription([
      note || null,
      `Страница **${page + 1}/${pages}** · всего в разделе: **${items.length}** · твой баланс: **${money(getBalance(guildId, userId).balance)}** 🪙`,
      `Выбери ${m.input} в меню под картинкой (номер совпадает с номером на плашке), чтобы посмотреть его крупно, купить или надеть.`,
    ].filter(Boolean).join("\n"))
    .setFooter({ text: "HeradeLegend Atelier · Купил — надень и смотри результат в /profile" });
  const files = [];
  const components = [];
  if (slice.length) {
    const sheet = renderSheet(slice, owned, m.kind);
    embed.setImage(`attachment://palette.${sheet.ext}`);
    files.push(new AttachmentBuilder(sheet.buffer, { name: `palette.${sheet.ext}` }));
    components.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
      .setCustomId(`${PREFIX}:sel:${state(mode, rarity, page)}`)
      .setPlaceholder(`Выбери ${m.input} — посмотреть, купить или надеть`)
      .addOptions(slice.map((item, n) => ({
        label: `${n + 1}. ${shortName(item)}`.slice(0, 100),
        description: `${priceLine(item)}${owned.has(item.id) ? " · куплено" : ""}`.slice(0, 100),
        value: item.id,
        emoji: optionEmoji(item),
      })))));
  } else {
    embed.setDescription([note || null, "В этом разделе пока ничего нет — попробуй другую редкость."].filter(Boolean).join("\n"));
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
  components.push(new ActionRowBuilder().addComponents(...SECTION_BUTTONS.map(([key, label]) => new ButtonBuilder()
    .setCustomId(`${PREFIX}:nav:${state(key, "all", 0)}:s${key}`)
    .setLabel(label)
    .setStyle(GROUP[mode] === key ? ButtonStyle.Primary : ButtonStyle.Secondary)
    .setDisabled(GROUP[mode] === key))));
  if (m.type === "color") {
    components.push(new ActionRowBuilder().addComponents(...["a", "c", "g"].map((key) => new ButtonBuilder()
      .setCustomId(`${PREFIX}:nav:${state(key, rarity, 0)}:f${key}`)
      .setLabel(`${MODES[key].emoji} ${MODES[key].short}`)
      .setStyle(key === mode ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(key === mode))));
  }
  return { embeds: [embed], files, components, attachments: [] };
}

function detailPayload(guildId, userId, itemId, mode, rarity, page, note) {
  const item = ITEMS.find((i) => i.id === itemId);
  if (!item) return listPayload(guildId, userId, mode, rarity, page, "⚠️ Такого предмета нет в каталоге.");
  const owned = ownedSet(guildId, userId).has(item.id);
  const equipped = getCustomProfile(guildId, userId)[PROFILE_KEY[item.type]]?.id === item.id;
  const balance = getBalance(guildId, userId).balance;
  const icon = item.type === "color" ? (item.id.startsWith("grad_") ? "🌈" : "🎨") : item.type === "banner" ? "🖼️" : item.type === "title" ? "🏷️" : "🎖️";
  const ext = item.type === "banner" ? "jpg" : "png";
  const embed = new EmbedBuilder().setColor(0x7C5CFC)
    .setTitle(`${icon} ${shortName(item)}`)
    .setDescription([
      note || null,
      item.description || null,
      `${RARITY_EMOJI[getItemRarity(item)]} **${getItemRarity(item)}** · **${money(item.price)}** 🪙 · ID: \`${item.id}\``,
      equipped ? "✅ Сейчас надето на твой профиль." : owned ? "🎒 Куплено — осталось надеть." : `Твой баланс: **${money(balance)}** 🪙${balance < item.price ? " (не хватает монет)" : ""}`,
    ].filter(Boolean).join("\n"))
    .setImage(`attachment://preview.${ext}`);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${PREFIX}:buy:${item.id}:${state(mode, rarity, page)}`).setLabel(owned ? "Куплено" : `Купить за ${money(item.price)}`).setEmoji("🛒").setStyle(ButtonStyle.Success).setDisabled(owned),
    new ButtonBuilder().setCustomId(`${PREFIX}:eq:${item.id}:${state(mode, rarity, page)}`).setLabel(equipped ? "Надето" : "Надеть").setEmoji("✨").setStyle(ButtonStyle.Primary).setDisabled(!owned || equipped),
    new ButtonBuilder().setCustomId(`${PREFIX}:nav:${state(mode, rarity, page)}:back`).setLabel("К списку").setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [embed], files: [new AttachmentBuilder(renderDetail(item), { name: `preview.${ext}` })], components: [row], attachments: [] };
}

async function openBrowser(guildId, userId, { mode = "t", rarity = "all" } = {}) {
  await preload();
  return listPayload(guildId, userId, MODES[mode] ? mode : "t", rarity, 0);
}

async function handle(interaction) {
  await preload();
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
        : `❌ ${({ already_owned: "Этот предмет уже у тебя.", insufficient_funds: "Недостаточно монет.", unknown_item: "Такого предмета нет." })[r.reason] || "Покупка не выполнена."}`;
    } else {
      const r = equipItem(guildId, userId, itemId);
      note = r.ok ? "✅ Надето! Проверь результат в `/profile`." : "❌ Сначала купи этот предмет.";
    }
    await interaction.update(detailPayload(guildId, userId, itemId, s.mode, s.rarity, s.page, note));
    return;
  }
  await interaction.reply({ content: "⚠️ Это действие больше недоступно. Открой магазин заново: /shop.", flags: MessageFlags.Ephemeral });
}

module.exports = { preload, openBrowser, handle, listItems, renderSheet, renderDetail, listPayload, detailPayload, MODES, PREFIX };
