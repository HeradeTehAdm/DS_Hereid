"use strict";

const kit = require("./art-kit");
const { getItemRarity } = require("./economy");
const { createCanvas, ensureFonts, RARITY_COLOR, family, money, fit, rr, pill, background, paintItem, shop } = kit;

const STATUS = {
  pending: null,
  accepted: { text: "ОБМЕН СОСТОЯЛСЯ", color: "#7dffb8" },
  declined: { text: "ОТКЛОНЕНО", color: "#ff8f8f" },
  cancelled: { text: "ОТМЕНЕНО", color: "#c3c7dd" },
  expired: { text: "ВРЕМЯ ВЫШЛО", color: "#ffd27a" },
  failed: { text: "НЕ СОСТОЯЛСЯ", color: "#ff8f8f" },
};

// Две стрелки обмена рисуем линиями: в шрифте нет подходящего символа.
function drawSwap(ctx, cx, cy) {
  ctx.save(); ctx.strokeStyle = "#ffffff"; ctx.fillStyle = "#ffffff"; ctx.lineWidth = 6; ctx.lineCap = "round";
  for (const dir of [1, -1]) {
    const y = cy + (dir === 1 ? -14 : 14);
    const x1 = cx - 22 * dir; const x2 = cx + 22 * dir;
    ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2, y); ctx.lineTo(x2 - 12 * dir, y - 10); ctx.lineTo(x2 - 12 * dir, y + 10); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
function itemLabel(item) { return item.type === "title" ? String(item.value) : shop.shortName(item); }

function sidePanel(ctx, x, y, w, h, heading, item, coins, accent) {
  const card = ctx.createLinearGradient(x, y, x + w, y + h);
  card.addColorStop(0, "rgba(255,255,255,0.09)"); card.addColorStop(1, "rgba(255,255,255,0.03)");
  ctx.fillStyle = card; rr(ctx, x, y, w, h, 22); ctx.fill();
  ctx.strokeStyle = accent; ctx.globalAlpha = 0.5; ctx.lineWidth = 2; rr(ctx, x, y, w, h, 22); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.fillStyle = accent; ctx.font = family("HeradeB", 17);
  ctx.fillText(fit(ctx, heading.toLocaleUpperCase("ru-RU"), w - 40), x + 22, y + 36);
  let cy = y + 56;
  if (item) {
    paintItem(ctx, item, x + 22, cy, w - 44, 132);
    ctx.fillStyle = "#ffffff"; ctx.font = family("HeradeXB", 24);
    ctx.fillText(fit(ctx, itemLabel(item), w - 44), x + 22, cy + 170);
    const rarity = getItemRarity(item);
    ctx.fillStyle = RARITY_COLOR[rarity]; ctx.font = family("HeradeB", 15);
    ctx.fillText(`${rarity.toLocaleUpperCase("ru-RU")} · ${item.category.toLocaleUpperCase("ru-RU")}`, x + 22, cy + 196);
    cy += 214;
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.05)"; rr(ctx, x + 22, cy, w - 44, 132, 16); ctx.fill();
    ctx.fillStyle = "#a6abc8"; ctx.font = family("HeradeM", 20); ctx.textAlign = "center";
    ctx.fillText("только монеты", x + w / 2, cy + 74); ctx.textAlign = "left";
    cy += 150;
  }
  if (coins > 0) {
    pill(ctx, x + 22, cy, w - 44, 46, "rgba(255,200,90,0.16)");
    ctx.strokeStyle = "rgba(255,200,90,0.6)"; ctx.lineWidth = 2; rr(ctx, x + 22, cy, w - 44, 46, 23); ctx.stroke();
    ctx.fillStyle = "#ffd27a"; ctx.font = family("HeradeXB", 24); ctx.textAlign = "center";
    ctx.fillText(`+ ${money(coins)} монет`, x + w / 2, cy + 31); ctx.textAlign = "left";
  }
}

// offer: { fromName, toName, giveItem, giveCoins, takeItem, takeCoins, fee, payerName, status, minutes }
function renderTradeCard(offer) {
  ensureFonts();
  const w = 1100; const h = 590;
  const canvas = createCanvas(w, h); const ctx = canvas.getContext("2d");
  background(ctx, w, h);
  ctx.fillStyle = "#ffffff"; ctx.font = family("HeradeXB", 34);
  ctx.fillText("ОБМЕН", 40, 62);
  ctx.fillStyle = "#a6abc8"; ctx.font = family("HeradeM", 19);
  ctx.fillText(fit(ctx, `${offer.fromName}  и  ${offer.toName}`, 760), 40, 92);
  const panelW = 470; const top = 116; const ph = 372;
  sidePanel(ctx, 40, top, panelW, ph, `${offer.fromName} отдаёт`, offer.giveItem, offer.giveCoins, "#7C5CFC");
  sidePanel(ctx, w - 40 - panelW, top, panelW, ph, `${offer.toName} отдаёт`, offer.takeItem, offer.takeCoins, "#1AD6C8");
  // стрелка обмена
  drawSwap(ctx, w / 2, top + ph / 2);
  // подвал
  const status = STATUS[offer.status || "pending"];
  ctx.fillStyle = "#a6abc8"; ctx.font = family("HeradeM", 18);
  const feeLine = offer.fee > 0 ? `Комиссия 5% с монет: ${money(offer.fee)} — платит ${offer.payerName}.` : "Монет в обмене нет, комиссии нет.";
  ctx.fillText(fit(ctx, feeLine, w - 80), 40, 530);
  if (status) {
    ctx.fillStyle = status.color; ctx.font = family("HeradeXB", 26); ctx.textAlign = "right";
    ctx.fillText(status.text, w - 40, 566); ctx.textAlign = "left";
  } else {
    ctx.fillStyle = "#c9ccf0"; ctx.font = family("HeradeB", 18);
    ctx.fillText(`Предложение действует ${offer.minutes || 10} минут. Принять может только получатель.`, 40, 562);
  }
  return canvas.toBuffer("image/png");
}

// Подарок и продажа: одна крупная карточка предмета. opts: { label, line1, line2, accent }
function renderItemCard(item, opts) {
  ensureFonts();
  const w = 900; const h = 300;
  const canvas = createCanvas(w, h); const ctx = canvas.getContext("2d");
  background(ctx, w, h);
  const accent = opts.accent || "#7C5CFC";
  const glow = ctx.createRadialGradient(190, 150, 10, 190, 150, 260);
  glow.addColorStop(0, `${accent}55`); glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
  paintItem(ctx, item, 40, 40, 300, 220);
  ctx.fillStyle = accent; ctx.font = family("HeradeB", 19);
  ctx.fillText(opts.label.toLocaleUpperCase("ru-RU"), 376, 78);
  ctx.fillStyle = "#ffffff"; ctx.font = family("HeradeXB", 38);
  ctx.fillText(fit(ctx, itemLabel(item), w - 416), 376, 130);
  const rarity = getItemRarity(item);
  ctx.fillStyle = RARITY_COLOR[rarity]; ctx.font = family("HeradeB", 18);
  ctx.fillText(`${rarity.toLocaleUpperCase("ru-RU")} · ${item.category.toLocaleUpperCase("ru-RU")}`, 376, 164);
  ctx.fillStyle = "#e6e8ff"; ctx.font = family("HeradeSB", 26);
  ctx.fillText(fit(ctx, opts.line1 || "", w - 416), 376, 214);
  if (opts.line2) { ctx.fillStyle = "#a6abc8"; ctx.font = family("HeradeM", 21); ctx.fillText(fit(ctx, opts.line2, w - 416), 376, 250); }
  return canvas.toBuffer("image/png");
}

module.exports = { renderTradeCard, renderItemCard };
