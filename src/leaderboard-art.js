"use strict";

const kit = require("./art-kit");
const { createCanvas, ensureFonts, family, fit, rr, pill, background, stopsFill, paintAvatar, shop } = kit;

const MEDAL = ["#FFD34E", "#C9D1E6", "#E0985A"];
const DEFAULT_ACCENT = ["#7C5CFC", "#1AD6C8"];
const W = 1200;

function header(ctx, mode, page, pages, guildName) {
  shop.paintBanner(ctx, { value: mode.banner }, 40, 30, W - 80, 160, 24);
  const shade = ctx.createLinearGradient(40, 30, W - 40, 30);
  shade.addColorStop(0, "rgba(6,8,20,0.82)"); shade.addColorStop(0.6, "rgba(6,8,20,0.45)"); shade.addColorStop(1, "rgba(6,8,20,0.1)");
  ctx.fillStyle = shade; rr(ctx, 40, 30, W - 80, 160, 24); ctx.fill();
  ctx.fillStyle = "#ffffff"; ctx.font = family("HeradeXB", 46);
  ctx.fillText(`${mode.emoji} ${mode.title}`, 76, 112);
  ctx.fillStyle = "#d6d9f2"; ctx.font = family("HeradeM", 22);
  ctx.fillText(fit(ctx, guildName || "HERADE HOUSE", 560), 78, 150);
  pill(ctx, W - 40 - 210, 52, 170, 42, "rgba(8,9,20,0.7)");
  ctx.fillStyle = "#ffffff"; ctx.font = family("HeradeB", 19); ctx.textAlign = "center";
  ctx.fillText(`СТРАНИЦА ${page} / ${pages}`, W - 40 - 125, 80); ctx.textAlign = "left";
}

function podium(ctx, rows, top) {
  const slots = [{ i: 1, cx: 290, r: 56, ped: 64 }, { i: 0, cx: 600, r: 74, ped: 96 }, { i: 2, cx: 910, r: 56, ped: 44 }];
  for (const slot of slots) {
    const row = rows[slot.i]; if (!row) continue;
    const cy = top + 40 + (slot.i === 0 ? 20 : 70);
    const medal = MEDAL[slot.i];
    const glow = ctx.createRadialGradient(slot.cx, cy, 10, slot.cx, cy, slot.r * 2.4);
    glow.addColorStop(0, `${medal}44`); glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow; ctx.fillRect(slot.cx - slot.r * 2.4, cy - slot.r * 2.4, slot.r * 4.8, slot.r * 4.8);
    const py = cy + slot.r + 18; const ph = top + 306 - py;
    const g = ctx.createLinearGradient(0, py, 0, py + ph);
    g.addColorStop(0, `${medal}30`); g.addColorStop(1, `${medal}06`);
    ctx.fillStyle = g; rr(ctx, slot.cx - 140, py, 280, ph, 18); ctx.fill();
    ctx.strokeStyle = `${medal}40`; ctx.lineWidth = 2; rr(ctx, slot.cx - 140, py, 280, ph, 18); ctx.stroke();
    paintAvatar(ctx, row.avatar, row.name, slot.cx, cy, slot.r, medal);
    ctx.fillStyle = medal; ctx.font = family("HeradeXB", 22); ctx.textAlign = "center";
    ctx.fillText(`#${row.rank}`, slot.cx, cy - slot.r - 14);
    ctx.fillStyle = "#ffffff"; ctx.font = family("HeradeXB", slot.i === 0 ? 30 : 25);
    ctx.fillText(fit(ctx, row.name, 270), slot.cx, cy + slot.r + 40);
    if (row.badge) { ctx.fillStyle = "#c9ccf0"; ctx.font = family("HeradeEmoji", 24); ctx.fillText(row.badge, slot.cx, cy + slot.r + 72); }
    ctx.fillStyle = stopsFill(ctx, row.accent, slot.cx - 80, 0, slot.cx + 80, 0); ctx.font = family("HeradeXB", slot.i === 0 ? 34 : 28);
    ctx.fillText(row.valueText, slot.cx, cy + slot.r + (row.badge ? 108 : 84));
    ctx.fillStyle = "#a6abc8"; ctx.font = family("HeradeM", 17);
    ctx.fillText(row.subText, slot.cx, cy + slot.r + (row.badge ? 132 : 108));
    ctx.textAlign = "left";
  }
}

function row(ctx, data, x, y, w, h, highlight) {
  const card = ctx.createLinearGradient(x, y, x + w, y);
  card.addColorStop(0, "rgba(255,255,255,0.09)"); card.addColorStop(1, "rgba(255,255,255,0.03)");
  ctx.fillStyle = card; rr(ctx, x, y, w, h, 18); ctx.fill();
  ctx.strokeStyle = highlight ? "#ffffff" : "rgba(255,255,255,0.12)"; ctx.lineWidth = highlight ? 3 : 2; rr(ctx, x, y, w, h, 18); ctx.stroke();
  ctx.fillStyle = stopsFill(ctx, data.accent, x, y, x, y + h); rr(ctx, x + 12, y + 12, 6, h - 24, 3); ctx.fill();
  ctx.fillStyle = data.rank <= 3 ? MEDAL[data.rank - 1] : "#c9ccf0"; ctx.font = family("HeradeXB", 28); ctx.textAlign = "center";
  ctx.fillText(`${data.rank}`, x + 62, y + h / 2 + 10); ctx.textAlign = "left";
  paintAvatar(ctx, data.avatar, data.name, x + 128, y + h / 2, 25, null);
  ctx.fillStyle = "#ffffff"; ctx.font = family("HeradeXB", 24);
  const name = fit(ctx, data.name, 380);
  ctx.fillText(name, x + 170, y + (data.titleText ? 31 : 41));
  const nameW = ctx.measureText(name).width;
  if (data.badge) { ctx.fillStyle = "#c9ccf0"; ctx.font = family("HeradeEmoji", 24); ctx.fillText(data.badge, x + 170 + nameW + 12, y + (data.titleText ? 31 : 41)); }
  if (data.titleText) { ctx.fillStyle = "#a6abc8"; ctx.font = family("HeradeM", 16); ctx.fillText(fit(ctx, data.titleText, 460), x + 170, y + 56); }
  ctx.textAlign = "right";
  ctx.fillStyle = stopsFill(ctx, data.accent, x + w - 260, 0, x + w - 24, 0); ctx.font = family("HeradeXB", 29);
  ctx.fillText(data.valueText, x + w - 28, y + 33);
  ctx.fillStyle = "#a6abc8"; ctx.font = family("HeradeM", 15);
  ctx.fillText(data.subText, x + w - 28, y + 56); ctx.textAlign = "left";
}

// data: { mode, page, pages, guildName, rows[], me|null }
function renderLeaderboard(data) {
  ensureFonts();
  const showPodium = data.page === 1 && data.rows.length >= 3;
  const list = showPodium ? data.rows.slice(3) : data.rows;
  const rowH = 68; const gap = 10;
  const listTop = showPodium ? 520 : 216;
  const meBar = data.me && !data.rows.some((r) => r.isMe) ? 92 : 0;
  const empty = data.rows.length === 0;
  const h = Math.max(400, listTop + list.length * (rowH + gap) + meBar + 70);
  const canvas = createCanvas(W, empty ? 400 : h); const ctx = canvas.getContext("2d");
  background(ctx, W, canvas.height);
  header(ctx, data.mode, data.page, data.pages, data.guildName);
  if (empty) {
    ctx.fillStyle = "#c9ccf0"; ctx.font = family("HeradeXB", 30); ctx.textAlign = "center";
    ctx.fillText("Здесь пока никого нет", W / 2, 290);
    ctx.fillStyle = "#a6abc8"; ctx.font = family("HeradeM", 20);
    ctx.fillText("Рейтинг заполнится, когда участники начнут играть и общаться", W / 2, 330); ctx.textAlign = "left";
    return canvas.toBuffer("image/png");
  }
  if (showPodium) podium(ctx, data.rows, 210);
  list.forEach((entry, i) => row(ctx, entry, 60, listTop + i * (rowH + gap), W - 120, rowH, entry.isMe));
  let y = listTop + list.length * (rowH + gap);
  if (meBar) {
    ctx.fillStyle = "#a6abc8"; ctx.font = family("HeradeB", 16);
    ctx.fillText("ТВОЁ МЕСТО", 64, y + 12);
    row(ctx, data.me, 60, y + 24, W - 120, rowH, true);
    y += meBar;
  }
  ctx.fillStyle = "#6f7494"; ctx.font = family("HeradeM", 15); ctx.textAlign = "center";
  ctx.fillText("Рейтинг обновляется в реальном времени · HERADE HOUSE 2.0", W / 2, canvas.height - 26); ctx.textAlign = "left";
  return canvas.toBuffer("image/png");
}

module.exports = { renderLeaderboard };
