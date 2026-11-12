// Картинки казино: барабаны слотов, монетка и рулетка. Всё рисуется кодом, внешних файлов нет.
const { createCanvas } = require("@napi-rs/canvas");
const { ensureFonts } = require("./profile-card");

const font = (name, size) => `${size}px ${name}, HeradeEmoji, sans-serif`;
const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

function bg(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#1a1033"); g.addColorStop(0.55, "#101226"); g.addColorStop(1, "#0a1a24");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(w / 2, h * 0.35, 10, w / 2, h * 0.35, w * 0.6);
  glow.addColorStop(0, "rgba(124,92,252,0.30)"); glow.addColorStop(1, "rgba(124,92,252,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
}
function star(ctx, cx, cy, outer, inner, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner; const a = -Math.PI / 2 + (i * Math.PI) / points;
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
}

const SYMBOLS = {
  cherry(ctx, x, y, s) {
    ctx.strokeStyle = "#5fd16b"; ctx.lineWidth = s * 0.06; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x - s * 0.18, y + s * 0.12); ctx.quadraticCurveTo(x - s * 0.05, y - s * 0.3, x + s * 0.1, y - s * 0.36); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + s * 0.2, y + s * 0.16); ctx.quadraticCurveTo(x + s * 0.2, y - s * 0.2, x + s * 0.1, y - s * 0.36); ctx.stroke();
    ctx.fillStyle = "#4cc15a"; ctx.beginPath(); ctx.ellipse(x + s * 0.22, y - s * 0.34, s * 0.14, s * 0.07, -0.4, 0, Math.PI * 2); ctx.fill();
    for (const [dx, dy] of [[-0.2, 0.2], [0.22, 0.24]]) {
      const g = ctx.createRadialGradient(x + (dx - 0.06) * s, y + (dy - 0.08) * s, 2, x + dx * s, y + dy * s, s * 0.2);
      g.addColorStop(0, "#ff8d9b"); g.addColorStop(1, "#d6203c");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, s * 0.2, 0, Math.PI * 2); ctx.fill();
    }
  },
  lemon(ctx, x, y, s) {
    const g = ctx.createLinearGradient(x - s * 0.4, y - s * 0.3, x + s * 0.4, y + s * 0.3);
    g.addColorStop(0, "#fff27a"); g.addColorStop(1, "#f2b705");
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, s * 0.4, s * 0.28, -0.35, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f2b705"; ctx.beginPath(); ctx.ellipse(x + s * 0.4, y - s * 0.17, s * 0.07, s * 0.05, -0.35, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#4cc15a"; ctx.beginPath(); ctx.ellipse(x + s * 0.2, y - s * 0.34, s * 0.16, s * 0.07, -0.6, 0, Math.PI * 2); ctx.fill();
  },
  bell(ctx, x, y, s) {
    const g = ctx.createLinearGradient(x, y - s * 0.4, x, y + s * 0.4);
    g.addColorStop(0, "#ffe27a"); g.addColorStop(1, "#e19b10");
    ctx.fillStyle = g; ctx.beginPath();
    ctx.moveTo(x - s * 0.38, y + s * 0.26);
    ctx.quadraticCurveTo(x - s * 0.3, y + s * 0.1, x - s * 0.26, y - s * 0.08);
    ctx.quadraticCurveTo(x - s * 0.22, y - s * 0.36, x, y - s * 0.36);
    ctx.quadraticCurveTo(x + s * 0.22, y - s * 0.36, x + s * 0.26, y - s * 0.08);
    ctx.quadraticCurveTo(x + s * 0.3, y + s * 0.1, x + s * 0.38, y + s * 0.26);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#c98308"; ctx.beginPath(); ctx.arc(x, y + s * 0.34, s * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y - s * 0.4, s * 0.05, 0, Math.PI * 2); ctx.fill();
  },
  star(ctx, x, y, s) {
    const g = ctx.createLinearGradient(x, y - s * 0.4, x, y + s * 0.4);
    g.addColorStop(0, "#fff1a1"); g.addColorStop(1, "#ffa81f");
    ctx.fillStyle = g; star(ctx, x, y + s * 0.02, s * 0.44, s * 0.19); ctx.fill();
    ctx.strokeStyle = "#ffcf5a"; ctx.lineWidth = s * 0.03; ctx.stroke();
  },
  diamond(ctx, x, y, s) {
    const g = ctx.createLinearGradient(x - s * 0.4, y - s * 0.3, x + s * 0.4, y + s * 0.4);
    g.addColorStop(0, "#9ff6ff"); g.addColorStop(1, "#2f8cff");
    ctx.fillStyle = g; ctx.beginPath();
    ctx.moveTo(x - s * 0.22, y - s * 0.3); ctx.lineTo(x + s * 0.22, y - s * 0.3); ctx.lineTo(x + s * 0.42, y - s * 0.06);
    ctx.lineTo(x, y + s * 0.42); ctx.lineTo(x - s * 0.42, y - s * 0.06); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = s * 0.025;
    ctx.beginPath(); ctx.moveTo(x - s * 0.42, y - s * 0.06); ctx.lineTo(x + s * 0.42, y - s * 0.06); ctx.moveTo(x - s * 0.22, y - s * 0.3); ctx.lineTo(x - s * 0.1, y - s * 0.06); ctx.lineTo(x, y + s * 0.42);
    ctx.moveTo(x + s * 0.22, y - s * 0.3); ctx.lineTo(x + s * 0.1, y - s * 0.06); ctx.lineTo(x, y + s * 0.42); ctx.stroke();
  },
  seven(ctx, x, y, s) {
    ctx.font = font("HeradeXB", s * 0.95); ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    const g = ctx.createLinearGradient(x, y - s * 0.4, x, y + s * 0.4);
    g.addColorStop(0, "#ff6a6a"); g.addColorStop(1, "#d10f2f");
    ctx.lineWidth = s * 0.08; ctx.strokeStyle = "#ffe27a"; ctx.strokeText("7", x, y + s * 0.34);
    ctx.fillStyle = g; ctx.fillText("7", x, y + s * 0.34);
  },
};

function renderSlots(reels, opts = {}) {
  ensureFonts();
  const w = 900; const h = 430;
  const canvas = createCanvas(w, h); const ctx = canvas.getContext("2d");
  bg(ctx, w, h);
  ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.font = font("HeradeXB", 34); ctx.fillText("HERADE · СЛОТЫ", w / 2, 56);
  const size = 230; const gap = 28; const x0 = (w - (size * 3 + gap * 2)) / 2; const y0 = 86;
  const win = opts.win || [false, false, false];
  reels.forEach((sym, i) => {
    const x = x0 + i * (size + gap);
    const panel = ctx.createLinearGradient(0, y0, 0, y0 + size);
    panel.addColorStop(0, "#232748"); panel.addColorStop(0.5, "#161933"); panel.addColorStop(1, "#232748");
    ctx.fillStyle = panel; ctx.beginPath(); ctx.roundRect(x, y0, size, size, 28); ctx.fill();
    ctx.lineWidth = win[i] ? 6 : 3; ctx.strokeStyle = win[i] ? "#7dffb8" : "rgba(255,255,255,0.18)";
    if (win[i]) { ctx.shadowColor = "#7dffb8"; ctx.shadowBlur = 24; }
    ctx.beginPath(); ctx.roundRect(x, y0, size, size, 28); ctx.stroke(); ctx.shadowBlur = 0;
    if (sym && SYMBOLS[sym]) {
      if (opts.blur && opts.blur[i]) ctx.globalAlpha = 0.55;
      SYMBOLS[sym](ctx, x + size / 2, y0 + size / 2, size * 0.78); ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.2)"; ctx.font = font("HeradeXB", 90); ctx.textAlign = "center"; ctx.fillText("?", x + size / 2, y0 + size / 2 + 30);
    }
  });
  ctx.strokeStyle = "rgba(255,90,90,0.55)"; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
  ctx.beginPath(); ctx.moveTo(x0 - 18, y0 + size / 2); ctx.lineTo(x0 + size * 3 + gap * 2 + 18, y0 + size / 2); ctx.stroke(); ctx.setLineDash([]);
  if (opts.caption) {
    ctx.textAlign = "center"; ctx.font = font("HeradeXB", 34); ctx.fillStyle = opts.captionColor || "#fff";
    ctx.fillText(opts.caption, w / 2, 388);
  }
  return canvas.toBuffer("image/png");
}

function renderCoin(face, opts = {}) {
  ensureFonts();
  const w = 760; const h = 300;
  const canvas = createCanvas(w, h); const ctx = canvas.getContext("2d"); bg(ctx, w, h);
  const cx = 190; const cy = 150; const r = 108;
  const gold = ctx.createRadialGradient(cx - 30, cy - 36, 10, cx, cy, r);
  gold.addColorStop(0, "#fff0a8"); gold.addColorStop(0.6, "#f6b81a"); gold.addColorStop(1, "#b7780a");
  ctx.fillStyle = gold; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 8; ctx.strokeStyle = "#ffe27a"; ctx.beginPath(); ctx.arc(cx, cy, r - 10, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "#8a5a07"; ctx.font = font("HeradeXB", face ? 54 : 110); ctx.textAlign = "center";
  if (face === "heads") { ctx.fillText("ОРЁЛ", cx, cy + 22); } else if (face === "tails") { ctx.fillText("РЕШКА", cx, cy + 22); } else ctx.fillText("?", cx, cy + 38);
  ctx.textAlign = "left"; ctx.fillStyle = opts.color || "#fff"; ctx.font = font("HeradeXB", 46);
  ctx.fillText(opts.title || "", 340, 130);
  ctx.fillStyle = "#a6abc8"; ctx.font = font("HeradeM", 25); [].concat(opts.sub || []).forEach((line, i) => ctx.fillText(line, 340, 180 + i * 36));
  return canvas.toBuffer("image/png");
}

function renderRoulette(number, opts = {}) {
  ensureFonts();
  const w = 760; const h = 300;
  const canvas = createCanvas(w, h); const ctx = canvas.getContext("2d"); bg(ctx, w, h);
  const color = number === null ? "#444a6b" : number === 0 ? "#1fa35a" : RED_NUMBERS.has(number) ? "#d6203c" : "#1b1d2b";
  const cx = 190; const cy = 150; const r = 112;
  ctx.fillStyle = "#2a2d4a"; ctx.beginPath(); ctx.arc(cx, cy, r + 16, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 37; i++) {
    const a0 = (i / 37) * Math.PI * 2 - Math.PI / 2; const a1 = ((i + 1) / 37) * Math.PI * 2 - Math.PI / 2;
    const n = i; const c = n === 0 ? "#1fa35a" : RED_NUMBERS.has(n) ? "#d6203c" : "#1b1d2b";
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, a0, a1); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx, cy, 68, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = "#ffe27a"; ctx.beginPath(); ctx.arc(cx, cy, 68, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.font = font("HeradeXB", 66); ctx.textAlign = "center"; ctx.fillText(number === null ? "?" : String(number), cx, cy + 24);
  ctx.textAlign = "left"; ctx.fillStyle = opts.color || "#fff"; ctx.font = font("HeradeXB", 46); ctx.fillText(opts.title || "", 340, 130);
  ctx.fillStyle = "#a6abc8"; ctx.font = font("HeradeM", 25); [].concat(opts.sub || []).forEach((line, i) => ctx.fillText(line, 340, 180 + i * 36));
  return canvas.toBuffer("image/png");
}

module.exports = { renderSlots, renderCoin, renderRoulette, RED_NUMBERS };
