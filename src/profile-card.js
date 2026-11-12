const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const assets = require("./profile-assets"); // баннеры и шрифты встроены прямо в код

const SCALE = 1.5; // карточка рисуется в 1.5x — текст и баннер получаются чёткими

let fontsReady = false;
function ensureFonts() {
  if (fontsReady) return;
  fontsReady = true;
  for (const [alias, data] of Object.entries(assets.fonts)) {
    try { GlobalFonts.register(Buffer.from(data, "base64"), alias); }
    catch (error) { console.warn(`[profile-card] Шрифт ${alias} не загружен:`, error.message); }
  }
}
const font = (family, size) => `${size}px ${family}, HeradeEmoji, sans-serif`;

// Готовые картинки баннеров. Если картинки нет — рисуем запасной вариант кодом.
const bannerCache = new Map();
async function getBannerImage(theme) {
  if (!theme.file) return null;
  if (bannerCache.has(theme.file)) return bannerCache.get(theme.file);
  let image = null;
  try {
    const data = assets.banners[theme.file.replace(/\.jpg$/, "")];
    if (data) image = await loadImage(Buffer.from(data, "base64"));
  } catch (error) { console.warn(`[profile-card] Баннер ${theme.file} не загрузился, рисую запасной:`, error.message); }
  bannerCache.set(theme.file, image);
  return image;
}

const THEMES = {
  "Океан": { file: "ocean.jpg", colors: ["#03172d", "#087eaa", "#71e7f5"], label: "БЕЗДНА ОКЕАНА", motif: "ocean" },
  "Лес": { file: "forest.jpg", colors: ["#061c17", "#147d52", "#8cf0b0"], label: "ИЗУМРУДНАЯ ЧАЩА", motif: "forest" },
  "Закат": { file: "sunset.jpg", colors: ["#35132e", "#c34b54", "#ffc27a"], label: "ПОСЛЕДНИЙ ЗАКАТ", motif: "sunset" },
  "Неон": { file: "neon.jpg", colors: ["#130d35", "#672de0", "#5ef5ff"], label: "НЕОНОВЫЙ ИМПУЛЬС", motif: "neon" },
  "Галактика": { file: "galaxy.jpg", colors: ["#100d2d", "#5536a6", "#f0a7ff"], label: "РОЖДЕНИЕ ГАЛАКТИКИ", motif: "galaxy" },
  "Золото": { file: "gold.jpg", colors: ["#211506", "#98651a", "#ffe4a0"], label: "ЗОЛОТАЯ ДИНАСТИЯ", motif: "gold" },
  "Лёд": { file: "ice.jpg", colors: ["#0b2037", "#387fba", "#d4f7ff"], label: "КРИСТАЛЬНЫЙ ШТОРМ", motif: "ice" },
  "Тень": { file: "shadow.jpg", colors: ["#080b14", "#343c54", "#a9b6d4"], label: "ТИХАЯ ТЕНЬ", motif: "shadow" },
  "Тыква": { file: "pumpkin.jpg", colors: ["#1a0830", "#b8470f", "#ffb347"], label: "ТЫКВЕННАЯ НОЧЬ", motif: "pumpkin" },
  "Кладбище": { file: "graveyard.jpg", colors: ["#04100f", "#1f7a5a", "#8dffb8"], label: "ПРОКЛЯТОЕ КЛАДБИЩЕ", motif: "graveyard" },
  "Рассвет": { file: "dawn.jpg", colors: ["#16303a", "#4a8a8a", "#ffcfa6"], label: "ТУМАННЫЙ РАССВЕТ", motif: "dawn" },
  "Озеро": { file: "lake.jpg", colors: ["#10203a", "#3a5f8a", "#ffb4a0"], label: "ТИХОЕ ОЗЕРО", motif: "lake" },
  "Дюны": { file: "dunes.jpg", colors: ["#3a2410", "#c8873a", "#ffd28a"], label: "ЗОЛОТЫЕ ДЮНЫ", motif: "dunes" },
  "Сакура": { file: "sakura.jpg", colors: ["#2a1030", "#d86a9a", "#ffc4dc"], label: "САКУРА", motif: "sakura" },
  "Гроза": { file: "storm.jpg", colors: ["#0a1020", "#3a4a8a", "#bcd4ff"], label: "ГРОЗОВОЙ ФРОНТ", motif: "storm" },
  "Осень": { file: "autumn.jpg", colors: ["#2a1408", "#c8501a", "#ffb347"], label: "ОСЕННИЙ ЛЕС", motif: "autumn" },
  "Мегаполис": { file: "megacity.jpg", colors: ["#080a1e", "#2a3a8a", "#ff5ec8"], label: "НОЧНОЙ МЕГАПОЛИС", motif: "megacity" },
  "Орбита": { file: "orbit.jpg", colors: ["#02030c", "#1a4a9a", "#ffb060"], label: "ОРБИТАЛЬНЫЙ РАССВЕТ", motif: "orbit" },
  "Вулкан": { file: "volcano.jpg", colors: ["#12060a", "#a82a0a", "#ff7a2a"], label: "ГНЕВ ВУЛКАНА", motif: "volcano" },
  "Замок": { file: "skycastle.jpg", colors: ["#10224a", "#4a7ac8", "#ffe0a0"], label: "НЕБЕСНЫЙ ЗАМОК", motif: "skycastle" },
  "Храм": { file: "moontemple.jpg", colors: ["#0a1230", "#2a4a9a", "#ffcf8a"], label: "ЛУННЫЙ ХРАМ", motif: "moontemple" },
  "Феникс": { file: "phoenix.jpg", colors: ["#1a0508", "#c8300a", "#ffb030"], label: "КРЫЛЬЯ ФЕНИКСА", motif: "phoenix" },
  "Разрыв": { file: "rift.jpg", colors: ["#04010f", "#6a2aff", "#7af0ff"], label: "РАЗРЫВ РЕАЛЬНОСТИ", motif: "rift" },
  "Фрактал": { file: "fractal.jpg", colors: ["#03011a", "#5a1a9a", "#c9a5ff"], label: "ФРАКТАЛЬНАЯ БЕЗДНА", motif: "fractal" },
  "Древо": { file: "worldtree.jpg", colors: ["#040820", "#2a8a9a", "#ffe08a"], label: "ДРЕВО МИРОВ", motif: "worldtree" },
  "Лаванда": { file: "lavender.jpg", colors: ["#2a1a4a", "#7a5aa0", "#ffd0a8"], label: "ЛАВАНДОВЫЕ ПОЛЯ", motif: "lavender" },
  "Лагерь": { file: "camp.jpg", colors: ["#06102a", "#1a2a5a", "#ffb86a"], label: "НОЧНОЙ ЛАГЕРЬ", motif: "camp" },
  "Гавань": { file: "harbor.jpg", colors: ["#1c4a6a", "#6ab0c8", "#ffe0c8"], label: "ТИХАЯ ГАВАНЬ", motif: "harbor" },
  "Деревня": { file: "village.jpg", colors: ["#0e1a3c", "#3a4a88", "#ffc468"], label: "СНЕЖНАЯ ДЕРЕВНЯ", motif: "village" },
  "Тропики": { file: "tropic.jpg", colors: ["#2a1a5a", "#c0407a", "#ffa060"], label: "ТРОПИЧЕСКИЙ ЗАКАТ", motif: "tropic" },
  "Бамбук": { file: "bamboo.jpg", colors: ["#1e5a3c", "#5a9a72", "#b8f0b8"], label: "БАМБУКОВАЯ РОЩА", motif: "bamboo" },
  "Аврора": { file: "aurora.jpg", colors: ["#02060f", "#0a2a3a", "#4fffb0"], label: "ПОЛЯРНАЯ АВРОРА", motif: "aurora" },
  "Призрак": { file: "ghostship.jpg", colors: ["#040a14", "#2a4a5a", "#7affe0"], label: "КОРАБЛЬ-ПРИЗРАК", motif: "ghostship" },
  "Пар": { file: "steam.jpg", colors: ["#1a0e08", "#7a4a1e", "#ffa050"], label: "ПАРОВАЯ ЭРА", motif: "steam" },
  "Руины": { file: "ruins.jpg", colors: ["#0a2a2a", "#2a6a58", "#7affe6"], label: "ЗАТЕРЯННЫЙ ХРАМ", motif: "ruins" },
  "Дракон": { file: "dragoneye.jpg", colors: ["#0c0406", "#a82a0a", "#ffa030"], label: "ОКО ДРАКОНА", motif: "dragoneye" },
  "Мост": { file: "bifrost.jpg", colors: ["#050820", "#2a1a78", "#ffe040"], label: "РАДУЖНЫЙ МОСТ", motif: "bifrost" },
  "Дыра": { file: "blackhole.jpg", colors: ["#02030a", "#c02a10", "#ffb050"], label: "ГОРИЗОНТ СОБЫТИЙ", motif: "blackhole" },
  "Кристалл": { file: "gem.jpg", colors: ["#04060f", "#3a2aa8", "#9af0ff"], label: "СЕРДЦЕ МИРОЗДАНИЯ", motif: "gem" },
  "Часы": { file: "clock.jpg", colors: ["#06031a", "#6a3ae0", "#ffe08a"], label: "ЧАСЫ ВЕЧНОСТИ", motif: "clock" },
};
const DEFAULT_THEME = { file: "classic.jpg", colors: ["#101827", "#334b83", "#8ca9ff"], label: "КЛАССИЧЕСКИЙ БАННЕР", motif: "classic" };

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
function fitText(ctx, text, maxWidth, startSize, font = "600") {
  let size = startSize;
  do {
    ctx.font = `${font} ${size}px sans-serif`;
    size -= 1;
  } while (ctx.measureText(text).width > maxWidth && size > 16);
  return Math.max(16, size);
}
function seeded(seed) {
  let n = 0;
  for (const char of seed) n = (n * 31 + char.charCodeAt(0)) >>> 0;
  return () => {
    n = (n * 1664525 + 1013904223) >>> 0;
    return n / 4294967296;
  };
}
function drawBannerArt(ctx, theme, width, height) {
  const [c1, c2, accent] = theme.colors;
  const random = seeded(theme.motif);
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, c1);
  gradient.addColorStop(0.42, c2);
  gradient.addColorStop(1, c1);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Atmospheric light beams and layered glow.
  for (let i = 0; i < 5; i++) {
    const gx = width * (0.48 + i * 0.13);
    const beam = ctx.createLinearGradient(gx, 0, gx - 150, height);
    beam.addColorStop(0, accent + "00");
    beam.addColorStop(0.5, accent + "24");
    beam.addColorStop(1, accent + "00");
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(gx - 28, 0);
    ctx.lineTo(gx + 28, 0);
    ctx.lineTo(gx - 100, height);
    ctx.lineTo(gx - 175, height);
    ctx.closePath();
    ctx.fill();
  }
  const glow = ctx.createRadialGradient(width * 0.72, height * 0.38, 4, width * 0.72, height * 0.38, width * 0.65);
  glow.addColorStop(0, accent + "bb");
  glow.addColorStop(0.32, c2 + "77");
  glow.addColorStop(1, accent + "00");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // Each named banner gets its own recognizable artwork rather than a generic gradient.
  ctx.save();
  if (theme.motif === "ocean") {
    for (let i = 0; i < 16; i++) {
      ctx.beginPath(); ctx.strokeStyle = i % 2 ? accent + "90" : "#ffffff55"; ctx.lineWidth = 2 + i % 3;
      ctx.moveTo(0, height * (0.3 + i * 0.045));
      for (let x = 0; x <= width; x += 18) ctx.lineTo(x, height * (0.3 + i * 0.045) + Math.sin(x / 72 + i * 0.6) * (12 + i * 1.5));
      ctx.stroke();
    }
    // Glowing underwater shafts and bubbles.
    for (let i = 0; i < 70; i++) { ctx.fillStyle = accent + (i % 3 ? "88" : "cc"); ctx.beginPath(); ctx.arc(random() * width, random() * height, 1 + random() * 3, 0, Math.PI * 2); ctx.fill(); }
  } else if (theme.motif === "forest") {
    for (let i = 0; i < 35; i++) {
      const x = random() * width, h = 40 + random() * 160, w = 18 + random() * 35;
      ctx.fillStyle = i % 2 ? "#03140dcc" : accent + "55";
      ctx.beginPath(); ctx.moveTo(x, height); ctx.lineTo(x - w, height - h * 0.45); ctx.lineTo(x, height - h); ctx.lineTo(x + w, height - h * 0.45); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = accent + "99"; ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(random() * width, height); ctx.lineTo(random() * width, 0); ctx.stroke(); }
    for (let i = 0; i < 55; i++) { ctx.fillStyle = "#d8ffd788"; ctx.beginPath(); ctx.arc(random() * width, random() * height, 1 + random() * 2, 0, Math.PI * 2); ctx.fill(); }
  } else if (theme.motif === "sunset") {
    const sun = ctx.createRadialGradient(width * 0.76, height * 0.43, 8, width * 0.76, height * 0.43, 100);
    sun.addColorStop(0, "#fff7ce"); sun.addColorStop(0.35, accent); sun.addColorStop(1, accent + "00");
    ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(width * 0.76, height * 0.43, 110, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#25102d99"; ctx.beginPath(); ctx.moveTo(0, height); ctx.lineTo(width * 0.18, height * 0.6); ctx.lineTo(width * 0.3, height * 0.77); ctx.lineTo(width * 0.47, height * 0.49); ctx.lineTo(width * 0.68, height); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#190f2dcc"; ctx.beginPath(); ctx.moveTo(width * 0.48, height); ctx.lineTo(width * 0.73, height * 0.62); ctx.lineTo(width * 0.88, height * 0.72); ctx.lineTo(width, height * 0.42); ctx.lineTo(width, height); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 7; i++) { ctx.strokeStyle = "#ffd59b88"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(width * 0.58, height * (0.7 + i * 0.035)); ctx.quadraticCurveTo(width * 0.78, height * (0.55 + i * 0.03), width, height * (0.7 + i * 0.035)); ctx.stroke(); }
  } else if (theme.motif === "neon") {
    ctx.strokeStyle = accent + "aa"; ctx.lineWidth = 3;
    for (let i = 0; i < 14; i++) { const x = i * 95 - 100; ctx.beginPath(); ctx.moveTo(x, height); ctx.lineTo(x + 110, height * 0.25); ctx.lineTo(x + 170, height * 0.25); ctx.lineTo(x + 280, height); ctx.stroke(); }
    for (let i = 0; i < 10; i++) { ctx.strokeStyle = i % 2 ? "#ff4fe288" : accent + "bb"; ctx.lineWidth = 2; ctx.strokeRect(width * 0.55 + i * 17, height * 0.15 + i * 6, 210 - i * 22, 105 - i * 10); }
    for (let i = 0; i < 36; i++) { ctx.fillStyle = i % 2 ? "#ff4fe2cc" : accent; ctx.fillRect(random() * width, random() * height, 2 + random() * 4, 2 + random() * 4); }
  } else if (theme.motif === "galaxy") {
    for (let i = 0; i < 230; i++) { ctx.fillStyle = i % 4 ? "#ffffffcc" : accent; ctx.beginPath(); ctx.arc(random() * width, random() * height, random() * 2.3 + 0.4, 0, Math.PI * 2); ctx.fill(); }
    ctx.translate(width * 0.76, height * 0.48); ctx.rotate(-0.32);
    for (let i = 0; i < 12; i++) { ctx.strokeStyle = i % 2 ? accent + "99" : "#ffffff55"; ctx.lineWidth = 2 + i % 2; ctx.beginPath(); ctx.ellipse(0, 0, 28 + i * 25, 8 + i * 8, 0, 0, Math.PI * 2); ctx.stroke(); }
    const core = ctx.createRadialGradient(0, 0, 2, 0, 0, 90); core.addColorStop(0, "#ffffff"); core.addColorStop(0.2, accent); core.addColorStop(1, accent + "00"); ctx.fillStyle = core; ctx.beginPath(); ctx.arc(0, 0, 90, 0, Math.PI * 2); ctx.fill();
  } else if (theme.motif === "gold") {
    ctx.strokeStyle = accent + "88"; ctx.lineWidth = 3;
    for (let i = 0; i < 13; i++) { ctx.beginPath(); ctx.moveTo(width * (0.45 + i * 0.055), 0); ctx.lineTo(width * (0.22 + i * 0.06), height); ctx.stroke(); }
    ctx.fillStyle = "#120d08dd"; ctx.beginPath(); ctx.moveTo(width * 0.65, height); ctx.lineTo(width * 0.69, height * 0.38); ctx.lineTo(width * 0.75, height * 0.52); ctx.lineTo(width * 0.81, height * 0.22); ctx.lineTo(width * 0.88, height * 0.5); ctx.lineTo(width * 0.95, height * 0.34); ctx.lineTo(width, height * 0.56); ctx.lineTo(width, height); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 90; i++) { ctx.fillStyle = i % 2 ? "#ffe7aacc" : accent; ctx.beginPath(); ctx.arc(random() * width, random() * height, random() * 2.4 + 0.4, 0, Math.PI * 2); ctx.fill(); }
  } else if (theme.motif === "ice") {
    ctx.strokeStyle = "#e5fbff99"; ctx.lineWidth = 2;
    for (let i = 0; i < 24; i++) { const x = random() * width, y = random() * height, s = 25 + random() * 80; ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.45, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.45, y); ctx.closePath(); ctx.stroke(); }
    for (let i = 0; i < 12; i++) { const x = i * 115 - 30; ctx.strokeStyle = accent + "aa"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 50, height * 0.5); ctx.lineTo(x + 8, height); ctx.stroke(); }
    for (let i = 0; i < 80; i++) { ctx.fillStyle = "#ffffffbb"; ctx.beginPath(); ctx.arc(random() * width, random() * height, random() * 2 + 0.5, 0, Math.PI * 2); ctx.fill(); }
  } else {
    ctx.strokeStyle = accent + "88"; ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.ellipse(width * 0.78, height * 0.5, 35 + i * 25, 12 + i * 9, -0.42, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = "#05040b99"; ctx.beginPath(); ctx.moveTo(0, height); ctx.lineTo(width * 0.2, height * 0.48); ctx.lineTo(width * 0.34, height * 0.7); ctx.lineTo(width * 0.49, height * 0.38); ctx.lineTo(width * 0.62, height); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ff274499"; ctx.beginPath(); ctx.arc(width * 0.78, height * 0.36, 58, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 65; i++) { ctx.fillStyle = i % 2 ? "#ff465e" : accent; ctx.beginPath(); ctx.arc(random() * width, random() * height, random() * 2 + 0.4, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();

  // Keep typography readable over detailed art.
  const shade = ctx.createLinearGradient(0, 0, width, 0);
  shade.addColorStop(0, "rgba(0,0,0,0.68)");
  shade.addColorStop(0.45, "rgba(0,0,0,0.28)");
  shade.addColorStop(1, "rgba(0,0,0,0.02)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, height);
}

// Цвета и оформление редкостей титулов
const RARITY_STYLE = {
  "Обычный":     { color: "#a9b8d0", glow: 0,  label: "ОБЫЧНЫЙ" },
  "Редкий":      { color: "#4aa8ff", glow: 8,  label: "РЕДКИЙ" },
  "Эпический":   { color: "#b46bff", glow: 14, label: "ЭПИЧЕСКИЙ" },
  "Легендарный": { color: "#ffc24a", glow: 20, label: "ЛЕГЕНДАРНЫЙ" },
  "Мифический":  { color: "#ff4fd8", glow: 26, label: "МИФИЧЕСКИЙ", color2: "#5ef5ff" },
};

// «3 д 5 ч», «2 г 40 д», «5 ч 12 мин»
function formatTenure(ms) {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days >= 365) {
    const years = Math.floor(days / 365);
    return `${years} г ${days - years * 365} д`;
  }
  if (days >= 1) return `${days} д ${hours} ч`;
  return `${hours} ч ${minutes % 60} мин`;
}

// ── Цвета и градиенты профиля ──
// Значение предмета: "FF5E62" (цвет) или "FF5E62-FF9966" (градиент из 2–6 цветов).
function parseColorStops(value) {
  if (!value) return [];
  return String(value).split("-")
    .map((part) => part.trim().replace(/^#/, ""))
    .filter((part) => /^[0-9a-fA-F]{6}$/.test(part))
    .slice(0, 6)
    .map((part) => `#${part.toLowerCase()}`);
}
function hexToRgb(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex([r, g, b]) {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
}
function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A.map((v, i) => v + (B[i] - v) * t));
}
function luminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
// Самый яркий цвет набора, подтянутый к светлому, чтобы подписи читались на тёмной карточке.
function readableAccent(stops) {
  let best = stops[0];
  for (const stop of stops) if (luminance(stop) > luminance(best)) best = stop;
  const lum = luminance(best);
  return lum < 0.5 ? mixHex(best, "#ffffff", Math.min(0.6, (0.5 - lum) * 1.4)) : best;
}

async function renderProfileCard({ user, displayName, title, titleRarity, badge, banner, colorValue, level, xp, balance, percent, inventoryCount, joinedAt }) {
  ensureFonts();
  const width = 1200;
  const height = 700;
  const bannerHeight = 230;
  const canvas = createCanvas(width * SCALE, height * SCALE);
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);
  const theme = THEMES[banner?.value] || DEFAULT_THEME;
  let [c1, c2, accent] = theme.colors;
  // Купленный цвет/градиент перекрашивает акценты карточки и подкрашивает баннер
  const customStops = parseColorStops(colorValue);
  let fillStops = [c2, accent];
  if (customStops.length) {
    // очень тёмные оттенки подтягиваем, чтобы полоска и кольцо были видны на тёмной карточке
    const lifted = customStops.map((c) => (luminance(c) < 0.32 ? mixHex(c, "#ffffff", Math.min(0.55, (0.32 - luminance(c)) * 2.2 + 0.12)) : c));
    fillStops = lifted.length > 1 ? lifted : [mixHex(lifted[0], "#000000", 0.4), lifted[0]];
    accent = readableAccent(customStops);
    c2 = fillStops[0];
  }
  const stopGradient = (x0, y0, x1, y1) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    fillStops.forEach((c, k) => g.addColorStop(fillStops.length === 1 ? 0 : k / (fillStops.length - 1), c));
    return g;
  };

  // ── Фон карточки ──
  ctx.save();
  roundedRect(ctx, 0, 0, width, height, 34);
  ctx.clip();
  const body = ctx.createLinearGradient(0, bannerHeight, 0, height);
  body.addColorStop(0, "#0c1326");
  body.addColorStop(1, "#070b17");
  ctx.fillStyle = body;
  ctx.fillRect(0, 0, width, height);
  const bodyGlow = ctx.createRadialGradient(width * 0.85, height * 0.78, 10, width * 0.85, height * 0.78, 520);
  bodyGlow.addColorStop(0, accent + "22");
  bodyGlow.addColorStop(1, accent + "00");
  ctx.fillStyle = bodyGlow;
  ctx.fillRect(0, bannerHeight, width, height - bannerHeight);

  // ── Баннер (готовая картинка) ──
  const bannerImage = await getBannerImage(theme);
  if (bannerImage) {
    ctx.drawImage(bannerImage, 0, 0, width, bannerHeight);
    // затемнение слева, чтобы читался текст
    const shade = ctx.createLinearGradient(0, 0, width * 0.66, 0);
    shade.addColorStop(0, "rgba(0,0,0,0.62)");
    shade.addColorStop(0.55, "rgba(0,0,0,0.22)");
    shade.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, width, bannerHeight);
  } else {
    drawBannerArt(ctx, theme, width, bannerHeight);
  }
  // подкраска баннера выбранным цветом (мягкий свет + лёгкая заливка)
  if (customStops.length) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, bannerHeight);
    ctx.clip();
    ctx.fillStyle = stopGradient(0, 0, width, 0);
    ctx.globalCompositeOperation = "soft-light";
    ctx.globalAlpha = 0.9;
    ctx.fillRect(0, 0, width, bannerHeight);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 0.14;
    ctx.fillRect(0, 0, width, bannerHeight);
    ctx.restore();
  }
  // плавный переход баннера в тело карточки
  const fade = ctx.createLinearGradient(0, bannerHeight - 46, 0, bannerHeight);
  fade.addColorStop(0, "rgba(12,19,38,0)");
  fade.addColorStop(1, "rgba(12,19,38,0.9)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, bannerHeight - 46, width, 46);
  // тонкая линия акцентного цвета под баннером
  if (customStops.length > 1) {
    ctx.fillStyle = stopGradient(0, 0, width, 0);
  } else {
    const edge = ctx.createLinearGradient(0, 0, width, 0);
    edge.addColorStop(0, accent + "00");
    edge.addColorStop(0.5, accent + "cc");
    edge.addColorStop(1, accent + "00");
    ctx.fillStyle = edge;
  }
  ctx.fillRect(0, bannerHeight - 1, width, 2);

  // ── Надписи на баннере ──
  ctx.fillStyle = accent;
  ctx.fillRect(46, 32, 5, 22);
  ctx.font = font("HeradeB", 17);
  ctx.fillText("HERADELEGEND  /  PROFILE BANNER", 62, 49);
  const bannerTitle = banner ? theme.label : "КЛАССИЧЕСКИЙ БАННЕР";
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = "#ffffff";
  ctx.font = font("HeradeXB", fitSize(ctx, bannerTitle, 760, 46, "HeradeXB"));
  ctx.fillText(bannerTitle, 46, 108);
  ctx.restore();
  ctx.fillStyle = "rgba(255,255,255,0.84)";
  ctx.font = font("HeradeM", 17);
  ctx.fillText(banner ? "CUSTOM COSMETIC  •  EQUIPPED" : "YOUR PROFILE. YOUR STYLE.", 48, 140);

  // ── Счётчик времени на сервере (правый нижний угол баннера) ──
  const joined = Number(joinedAt);
  if (Number.isFinite(joined) && joined > 0) {
    const tenure = formatTenure(Date.now() - joined);
    ctx.font = font("HeradeB", 12);
    const labelW = ctx.measureText("НА СЕРВЕРЕ").width;
    ctx.font = font("HeradeXB", 21);
    const valueW = ctx.measureText(tenure).width;
    const pillW = Math.ceil(Math.max(labelW, valueW)) + 66;
    const pillH = 48;
    const pillX = width - 40 - pillW;
    const pillY = bannerHeight - pillH - 26;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "rgba(6,10,22,0.58)";
    roundedRect(ctx, pillX, pillY, pillW, pillH, 15);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = accent + "bb";
    ctx.lineWidth = 1.5;
    roundedRect(ctx, pillX, pillY, pillW, pillH, 15);
    ctx.stroke();
    // иконка часов
    const ix = pillX + 28;
    const iy = pillY + pillH / 2;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(ix, iy, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ix, iy - 6);
    ctx.lineTo(ix, iy);
    ctx.lineTo(ix + 5, iy + 3);
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.font = font("HeradeB", 12);
    ctx.fillText("НА СЕРВЕРЕ", pillX + 52, pillY + 19);
    ctx.fillStyle = "#ffffff";
    ctx.font = font("HeradeXB", 21);
    ctx.fillText(tenure, pillX + 52, pillY + 40);
  }

  // ── Аватар (заходит на баннер) ──
  const avatarSize = 150;
  const avatarX = 58;
  const avatarY = 168;
  const acx = avatarX + avatarSize / 2;
  const acy = avatarY + avatarSize / 2;
  ctx.fillStyle = "#0c1326";
  ctx.beginPath();
  ctx.arc(acx, acy, avatarSize / 2 + 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = 26;
  ctx.strokeStyle = customStops.length > 1 ? stopGradient(avatarX, avatarY, avatarX + avatarSize, avatarY + avatarSize) : accent;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(acx, acy, avatarSize / 2 + 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  try {
    const avatar = await loadImage(user.displayAvatarURL({ extension: "png", size: 512 }));
    ctx.save();
    ctx.beginPath();
    ctx.arc(acx, acy, avatarSize / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();
  } catch {
    ctx.fillStyle = "#26334d";
    ctx.beginPath();
    ctx.arc(acx, acy, avatarSize / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Имя ──
  const safeName = String(displayName || user.username).slice(0, 32);
  ctx.fillStyle = "#ffffff";
  ctx.font = font("HeradeXB", fitSize(ctx, safeName, 880, 44, "HeradeXB"));
  ctx.fillText(safeName, 245, 300);

  // ── Уровень и прогресс ──
  const pct = Math.min(100, Math.max(0, Number(percent) || 0));
  ctx.fillStyle = "rgba(255,255,255,0.055)";
  roundedRect(ctx, 245, 332, 897, 92, 16);
  ctx.fill();
  ctx.fillStyle = "#dce7ff";
  ctx.font = font("HeradeSB", 19);
  ctx.fillText(`УРОВЕНЬ ${level}   •   ${Number(xp).toLocaleString("ru-RU")} XP`, 268, 367);
  ctx.textAlign = "right";
  ctx.fillStyle = accent;
  ctx.font = font("HeradeB", 19);
  ctx.fillText(`${pct}%`, 1118, 367);
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  roundedRect(ctx, 268, 384, 850, 14, 7);
  ctx.fill();
  const progressWidth = Math.max(14, 850 * pct / 100);
  const progressGradient = stopGradient(268, 0, 1118, 0);
  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = 12;
  ctx.fillStyle = progressGradient;
  roundedRect(ctx, 268, 384, progressWidth, 14, 7);
  ctx.fill();
  ctx.restore();

  // ── Карточки статистики ──
  const stats = [
    ["БАЛАНС", Number(balance).toLocaleString("ru-RU"), "coin"],
    ["УРОВЕНЬ", String(level), null],
    ["КОЛЛЕКЦИЯ", String(inventoryCount), null],
  ];
  stats.forEach(([label, value, icon], index) => {
    const x = 58 + index * 375;
    ctx.fillStyle = "rgba(255,255,255,0.055)";
    roundedRect(ctx, x, 448, 350, 92, 16);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.font = font("HeradeB", 15);
    ctx.fillText(label, x + 22, 477);
    let textX = x + 22;
    if (icon === "coin") {
      const coin = ctx.createLinearGradient(0, 495, 0, 525);
      coin.addColorStop(0, "#ffe9a0");
      coin.addColorStop(1, "#d99a2a");
      ctx.fillStyle = coin;
      ctx.beginPath();
      ctx.arc(x + 36, 510, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#a86e12";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + 36, 510, 9, 0, Math.PI * 2);
      ctx.stroke();
      textX = x + 62;
    }
    ctx.fillStyle = "#ffffff";
    ctx.font = font("HeradeXB", fitSize(ctx, value, 350 - (textX - x) - 20, 30, "HeradeXB"));
    ctx.fillText(value, textX, 518);
  });

  // ── Титул (оформление по редкости) ──
  const rar = RARITY_STYLE[titleRarity] || null;
  const rc = rar ? rar.color : accent;
  const panelX = 58, panelY = 562, panelW = 1084, panelH = 92;
  ctx.fillStyle = "rgba(255,255,255,0.055)";
  roundedRect(ctx, panelX, panelY, panelW, panelH, 16);
  ctx.fill();
  if (rar) {
    const tintGrad = ctx.createLinearGradient(panelX, 0, panelX + panelW, 0);
    tintGrad.addColorStop(0, rc + "30");
    tintGrad.addColorStop(0.6, rc + "0d");
    tintGrad.addColorStop(1, (rar.color2 || rc) + "22");
    ctx.fillStyle = tintGrad;
    roundedRect(ctx, panelX, panelY, panelW, panelH, 16);
    ctx.fill();
    // рамка панели: чем выше редкость, тем ярче
    ctx.save();
    if (rar.glow) { ctx.shadowColor = rc; ctx.shadowBlur = rar.glow; }
    const border = ctx.createLinearGradient(panelX, 0, panelX + panelW, 0);
    border.addColorStop(0, rc);
    border.addColorStop(1, rar.color2 || rc + "55");
    ctx.strokeStyle = border;
    ctx.lineWidth = rar.glow ? 2 : 1.4;
    roundedRect(ctx, panelX + 1, panelY + 1, panelW - 2, panelH - 2, 16);
    ctx.stroke();
    ctx.restore();
  }
  // цветная планка слева
  ctx.fillStyle = rc;
  roundedRect(ctx, panelX + 14, panelY + 16, 5, panelH - 32, 2.5);
  ctx.fill();
  ctx.fillStyle = rc;
  ctx.font = font("HeradeB", 15);
  ctx.fillText("ТИТУЛ УЧАСТНИКА", 92, 590);

  // плашка редкости справа
  let chipW = 0;
  if (rar) {
    ctx.font = font("HeradeXB", 16);
    const textW = ctx.measureText(rar.label).width;
    chipW = Math.ceil(textW) + 56;
    const chipH = 36;
    const chipX = panelX + panelW - 26 - chipW;
    const chipY = panelY + (panelH - chipH) / 2;
    if (rar.glow) {
      // свечение только вокруг контура, чтобы не заливать текст внутри
      ctx.save();
      ctx.shadowColor = rc;
      ctx.shadowBlur = rar.glow;
      ctx.strokeStyle = rc;
      ctx.lineWidth = 2;
      roundedRect(ctx, chipX, chipY, chipW, chipH, 18);
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = "#0b1224";
    roundedRect(ctx, chipX, chipY, chipW, chipH, 18);
    ctx.fill();
    ctx.fillStyle = rc + "30";
    roundedRect(ctx, chipX, chipY, chipW, chipH, 18);
    ctx.fill();
    ctx.strokeStyle = rc;
    ctx.lineWidth = 1.8;
    roundedRect(ctx, chipX, chipY, chipW, chipH, 18);
    ctx.stroke();
    // ромб-кристалл
    const dx = chipX + 24, dy = chipY + chipH / 2;
    ctx.fillStyle = rc;
    ctx.beginPath();
    ctx.moveTo(dx, dy - 7); ctx.lineTo(dx + 6, dy); ctx.lineTo(dx, dy + 7); ctx.lineTo(dx - 6, dy);
    ctx.closePath();
    ctx.fill();
    let textFill = rc;
    if (rar.color2) {
      textFill = ctx.createLinearGradient(chipX, 0, chipX + chipW, 0);
      textFill.addColorStop(0, rar.color);
      textFill.addColorStop(1, rar.color2);
    }
    ctx.fillStyle = textFill;
    ctx.font = font("HeradeXB", 16);
    ctx.fillText(rar.label, chipX + 40, chipY + 24);
  }

  ctx.fillStyle = "#ffffff";
  const titleText = `${badge || "🌱"}  ${String(title || "Участник сообщества").slice(0, 40)}`;
  const titleMax = 1084 - 92 + 58 - 40 - chipW - (chipW ? 30 : 0);
  ctx.font = font("HeradeB", fitSize(ctx, titleText, titleMax, 30, "HeradeB"));
  ctx.save();
  if (rar && rar.glow) { ctx.shadowColor = rc; ctx.shadowBlur = Math.round(rar.glow / 2); }
  ctx.fillText(titleText, 92, 632);
  ctx.restore();

  // ── Акцентная полоса ──
  ctx.fillStyle = stopGradient(58, 0, 1142, 0);
  roundedRect(ctx, 58, 676, 1084, 4, 2);
  ctx.fill();

  ctx.restore();
  return canvas.toBuffer("image/png");
}

function fitSize(ctx, text, maxWidth, startSize, family) {
  let size = startSize;
  while (size > 14) {
    ctx.font = font(family, size);
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 1;
  }
  return size;
}

module.exports = { renderProfileCard, THEMES, ensureFonts };
