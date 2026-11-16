"use strict";

const kit = require("./art-kit");
const { createCanvas, ensureFonts, RARITY_COLOR, family, money, fit, wrap, rr, pill, background, paintAvatar } = kit;

const W = 1200; const COLS = 3; const TILE_W = 360; const TILE_H = 152; const GAP_X = 20; const GAP_Y = 18;

function progressText(item) {
  const { current, target } = item.progress;
  if (item.metric === "voiceSeconds") return `${(current / 3600).toFixed(current >= 36000 ? 0 : 1)} / ${target / 3600} ч`;
  return `${money(current)} / ${money(target)}`;
}
function dateText(value) {
  const d = new Date(String(value).replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" });
}

function tile(ctx, item, x, y) {
  const rc = RARITY_COLOR[item.rarity]; const on = item.unlocked;
  const card = ctx.createLinearGradient(x, y, x + TILE_W, y + TILE_H);
  card.addColorStop(0, on ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)"); card.addColorStop(1, "rgba(255,255,255,0.02)");
  ctx.fillStyle = card; rr(ctx, x, y, TILE_W, TILE_H, 20); ctx.fill();
  ctx.strokeStyle = on ? rc : "rgba(255,255,255,0.12)"; ctx.globalAlpha = on ? 0.75 : 1; ctx.lineWidth = 2; rr(ctx, x, y, TILE_W, TILE_H, 20); ctx.stroke(); ctx.globalAlpha = 1;
  // иконка
  const ix = x + 18; const iy = y + 24; const is = 96;
  const glow = ctx.createRadialGradient(ix + is / 2, iy + is / 2, 6, ix + is / 2, iy + is / 2, is);
  glow.addColorStop(0, on ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.05)"); glow.addColorStop(1, "rgba(255,255,255,0.02)");
  ctx.fillStyle = glow; rr(ctx, ix, iy, is, is, 18); ctx.fill();
  ctx.strokeStyle = on ? rc : "rgba(255,255,255,0.14)"; ctx.globalAlpha = 0.6; rr(ctx, ix, iy, is, is, 18); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.textAlign = "center"; ctx.fillStyle = on ? rc : "#5d6282"; ctx.globalAlpha = on ? 1 : 0.55;
  ctx.font = family("HeradeEmoji", 58); ctx.fillText(item.badge.value, ix + is / 2, iy + is / 2 + 20); ctx.globalAlpha = 1; ctx.textAlign = "left";
  // текст
  const tx = x + 128; const tw = TILE_W - 128 - 16;
  ctx.fillStyle = on ? rc : "#6f7494"; ctx.font = family("HeradeB", 12);
  ctx.fillText(item.rarity.toLocaleUpperCase("ru-RU"), tx, y + 28);
  ctx.fillStyle = on ? "#ffffff" : "#aab0cf"; ctx.font = family("HeradeXB", 22);
  ctx.fillText(fit(ctx, item.name, tw), tx, y + 54);
  ctx.fillStyle = "#a6abc8"; ctx.font = family("HeradeM", 15);
  wrap(ctx, item.description, tw, 2).forEach((line, i) => ctx.fillText(line, tx, y + 77 + i * 19));
  // прогресс или дата
  if (on) {
    ctx.fillStyle = "#7dffb8"; ctx.font = family("HeradeB", 15);
    ctx.fillText(`ПОЛУЧЕНО ${dateText(item.awardedAt)}`, tx, y + 128);
  } else {
    const bw = tw - 110; const frac = Math.min(1, item.progress.current / item.progress.target);
    ctx.fillStyle = "rgba(255,255,255,0.1)"; rr(ctx, tx, y + 115, bw, 12, 6); ctx.fill();
    if (frac > 0) { const g = ctx.createLinearGradient(tx, 0, tx + bw, 0); g.addColorStop(0, "#7C5CFC"); g.addColorStop(1, "#1AD6C8"); ctx.fillStyle = g; rr(ctx, tx, y + 115, Math.max(12, bw * frac), 12, 6); ctx.fill(); }
    ctx.fillStyle = "#c9ccf0"; ctx.font = family("HeradeB", 14); ctx.textAlign = "right";
    ctx.fillText(progressText(item), tx + tw, y + 127); ctx.textAlign = "left";
  }
}

// data: { name, avatar, items[], page, pages, unlocked, total, badgesOwned }
function renderAchievements(data) {
  ensureFonts();
  const rows = Math.max(1, Math.ceil(data.items.length / COLS));
  const h = 196 + rows * (TILE_H + GAP_Y) + 40;
  const canvas = createCanvas(W, h); const ctx = canvas.getContext("2d");
  background(ctx, W, h);
  // шапка
  const head = ctx.createLinearGradient(40, 30, W - 40, 30);
  head.addColorStop(0, "rgba(124,92,252,0.35)"); head.addColorStop(1, "rgba(26,214,200,0.22)");
  ctx.fillStyle = head; rr(ctx, 40, 30, W - 80, 136, 24); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.14)"; ctx.lineWidth = 2; rr(ctx, 40, 30, W - 80, 136, 24); ctx.stroke();
  paintAvatar(ctx, data.avatar, data.name, 108, 98, 42, "#ffffff");
  ctx.fillStyle = "#ffffff"; ctx.font = family("HeradeXB", 34);
  ctx.fillText(fit(ctx, data.name, 520), 172, 92);
  ctx.fillStyle = "#d6d9f2"; ctx.font = family("HeradeM", 20);
  ctx.fillText(`ДОСТИЖЕНИЯ · эксклюзивных значков: ${data.badgesOwned}`, 174, 126);
  const frac = data.total ? data.unlocked / data.total : 0; const bx = 780; const bw = 340;
  ctx.fillStyle = "#ffffff"; ctx.font = family("HeradeXB", 30); ctx.textAlign = "right";
  ctx.fillText(`${data.unlocked} / ${data.total}`, bx + bw, 82); ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.14)"; rr(ctx, bx, 98, bw, 16, 8); ctx.fill();
  if (frac > 0) { const g = ctx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, "#7C5CFC"); g.addColorStop(1, "#1AD6C8"); ctx.fillStyle = g; rr(ctx, bx, 98, Math.max(16, bw * frac), 16, 8); ctx.fill(); }
  ctx.fillStyle = "#a6abc8"; ctx.font = family("HeradeM", 16); ctx.textAlign = "right";
  ctx.fillText(`страница ${data.page} из ${data.pages}`, bx + bw, 142); ctx.textAlign = "left";
  data.items.forEach((item, i) => tile(ctx, item, 40 + (i % COLS) * (TILE_W + GAP_X), 196 + Math.floor(i / COLS) * (TILE_H + GAP_Y)));
  ctx.fillStyle = "#6f7494"; ctx.font = family("HeradeM", 15); ctx.textAlign = "center";
  ctx.fillText("За каждое достижение выдаётся эксклюзивный значок: его нельзя купить, продать или подарить", W / 2, h - 16); ctx.textAlign = "left";
  return canvas.toBuffer("image/png");
}

module.exports = { renderAchievements, PAGE_SIZE: 12 };
