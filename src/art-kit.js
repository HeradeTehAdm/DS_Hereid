"use strict";

// Общие кисти для карточек обмена, рейтинга и достижений: тот же стиль, что у магазина и профиля.
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { ensureFonts } = require("./profile-card");
const shop = require("./shop-browser");
const { getItemRarity } = require("./economy");

const RARITY_COLOR = shop.RARITY_COLOR;
const family = (name, size) => `${size}px ${name}, HeradeEmoji, sans-serif`;
const money = (n) => Number(n).toLocaleString("ru-RU");

function fit(ctx, text, maxWidth) {
  const value = String(text);
  if (ctx.measureText(value).width <= maxWidth) return value;
  let out = value;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}
function wrap(ctx, text, maxWidth, maxLines = 2) {
  const words = String(text).split(/\s+/); const lines = []; let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) line = next;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = fit(ctx, `${lines[maxLines - 1]}…`, maxWidth); }
  return lines;
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function pill(ctx, x, y, w, h, fill) { ctx.fillStyle = fill; rr(ctx, x, y, w, h, h / 2); ctx.fill(); }
function background(ctx, w, h) { shop.background(ctx, w, h); }

function stopsFill(ctx, stops, x1, y1, x2, y2) {
  if (stops.length === 1) return stops[0];
  const g = ctx.createLinearGradient(x1, y1, x2, y2);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}
const hex = (value) => String(value).split("-").map((p) => `#${p}`);

// Рисует любой предмет: цвет, баннер, значок или титул.
function paintItem(ctx, item, x, y, w, h) {
  const rc = RARITY_COLOR[getItemRarity(item)] || "#A9AEC4";
  if (item.type === "color") return shop.paintSwatch(ctx, item, x, y, w, h, 16);
  if (item.type === "banner") return shop.paintBanner(ctx, item, x, y, w, h, 16);
  const tile = ctx.createRadialGradient(x + w / 2, y + h / 2, 6, x + w / 2, y + h / 2, Math.max(w, h) / 1.5);
  tile.addColorStop(0, "rgba(255,255,255,0.16)"); tile.addColorStop(1, "rgba(255,255,255,0.03)");
  ctx.fillStyle = tile; rr(ctx, x, y, w, h, 16); ctx.fill();
  ctx.strokeStyle = rc; ctx.globalAlpha = 0.6; ctx.lineWidth = 2; rr(ctx, x, y, w, h, 16); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.textAlign = "center";
  if (item.type === "badge") {
    ctx.fillStyle = rc; ctx.font = family("HeradeEmoji", Math.floor(Math.min(w, h) * 0.62));
    ctx.fillText(String(item.value), x + w / 2, y + h / 2 + Math.min(w, h) * 0.22);
  } else {
    ctx.fillStyle = "#ffffff"; ctx.font = family("HeradeXB", 24);
    const lines = wrap(ctx, String(item.value), w - 24, 2);
    lines.forEach((line, i) => ctx.fillText(line, x + w / 2, y + h / 2 + 8 - (lines.length - 1) * 14 + i * 28));
  }
  ctx.textAlign = "left";
}

const avatarCache = new Map();
async function loadAvatar(url) {
  if (!url) return null;
  if (avatarCache.has(url)) return avatarCache.get(url);
  let image = null;
  try { image = await loadImage(url); } catch { image = null; }
  if (avatarCache.size > 200) avatarCache.clear();
  avatarCache.set(url, image);
  return image;
}
function paintAvatar(ctx, image, name, cx, cy, r, ring) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  if (image) ctx.drawImage(image, cx - r, cy - r, r * 2, r * 2);
  else {
    const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    g.addColorStop(0, "#7C5CFC"); g.addColorStop(1, "#1AD6C8");
    ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = "#fff"; ctx.font = family("HeradeXB", Math.floor(r * 1.0)); ctx.textAlign = "center";
    ctx.fillText(String(name || "?").trim().charAt(0).toUpperCase() || "?", cx, cy + r * 0.34); ctx.textAlign = "left";
  }
  ctx.restore();
  if (ring) { ctx.strokeStyle = ring; ctx.lineWidth = Math.max(3, r / 12); ctx.beginPath(); ctx.arc(cx, cy, r + 2, 0, Math.PI * 2); ctx.stroke(); }
}

module.exports = { createCanvas, ensureFonts, RARITY_COLOR, family, money, fit, wrap, rr, pill, background, stopsFill, hex, paintItem, loadAvatar, paintAvatar, shop };
