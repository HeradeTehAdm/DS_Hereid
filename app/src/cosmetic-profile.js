// Visual storefront for cosmetics already owned and equipped in the Discord bot.
// This module never changes inventory, balance, or the chosen equipment.
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, char =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const fmt = (value) => Number(value || 0).toLocaleString("ru-RU");
const slots = [
  { type: "banner", label: "Баннеры", icon: "✦" },
  { type: "color", label: "Цвета профиля", icon: "◈" },
  { type: "badge", label: "Значки", icon: "✧" },
  { type: "title", label: "Титулы", icon: "♛" },
];
const normalize = value => String(value || "").trim().toLowerCase();
const stripPrefix = (item) => String(item?.name || "").replace(/^(Баннер|Цвет|Значок|Титул)\s*[«"](.+)[»"]$/i, "$2");
const isOwned = (profile, item) => (profile.inventory || []).some(x => x.id === item.id);
const owned = (profile, type) => {
  const result = (profile.inventory || []).filter(item => item.type === type);
  const selected = profile.equipped?.[type];
  if (selected && !result.some(item => item.id === selected.id)) result.unshift(selected);
  return result;
};
const rarityClass = (value) => {
  const text = normalize(value);
  if (text.includes("миф")) return "mythic";
  if (text.includes("легенд")) return "legendary";
  if (text.includes("эпич")) return "epic";
  if (text.includes("редк")) return "rare";
  return "common";
};
const iconFor = (item, type) => {
  if (type === "badge" && typeof item?.value === "string" && item.value.length > 0 && item.value.length <= 8) return item.value;
  const value = normalize(item?.id + " " + item?.name);
  if (value.includes("корон") || value.includes("crown")) return "♛";
  if (value.includes("алмаз") || value.includes("diamond")) return "💎";
  if (value.includes("звезд") || value.includes("звёзд") || value.includes("star")) return "✦";
  if (value.includes("луна") || value.includes("moon")) return "☾";
  if (value.includes("огон") || value.includes("fire")) return "✹";
  if (value.includes("сердц") || value.includes("heart")) return "♥";
  return type === "title" ? "♛" : type === "color" ? "◈" : type === "badge" ? "✦" : "✧";
};
function palette(item) {
  // Paint color purchases with their actual catalog hex values, not a guessed theme.
  if (item?.type === "color" && /^[0-9a-fA-F]{6}$/.test(String(item.value || ""))) {
    const hex = "#" + item.value;
    return ["#0a0b25", hex, hex];
  }
  const id = normalize(item?.id + " " + item?.name);
  if (/blackhole|_hole|дыра|горизонт событий/.test(id)) return ["#09041a", "#ae29b4", "#ff9e71"];
  if (/galaxy|галакт|звезд|звёзд|cosmic|космо|orbit|орбит/.test(id)) return ["#0a0e3f", "#6744f6", "#5ce2fc"];
  if (/gold|золот|sun|солн|dunes|дюн/.test(id)) return ["#27120d", "#a85b29", "#ffe08e"];
  if (/ocean|океан|lake|озер|ice|лёд|frost|cyan|бирюз/.test(id)) return ["#051f43", "#1267b3", "#5df2f0"];
  if (/forest|лес|emerald|изумруд|bamboo|бамбук|aurora|аврор/.test(id)) return ["#092c2a", "#138e79", "#97f8be"];
  if (/sunset|закат|sakura|сакура|pink|розов|lavender|лаванд/.test(id)) return ["#311244", "#b92c98", "#ffb7bf"];
  if (/volcano|вулкан|phoenix|феникс|огон|pumpkin|тыкв/.test(id)) return ["#290a20", "#ce3c46", "#ffc36c"];
  if (/shadow|тень|night|ноч|black|черн/.test(id)) return ["#0c1024", "#424477", "#a3b5e8"];
  if (/purple|фиолет|neon|неон|rift|разрыв/.test(id)) return ["#160c45", "#8f3bfb", "#5df5ff"];
  let hash = 7;
  for (const c of id) hash = (Math.imul(hash, 33) + c.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  return ["hsl(" + hue + " 57% 11%)", "hsl(" + ((hue + 28) % 360) + " 70% 36%)", "hsl(" + ((hue + 75) % 360) + " 95% 72%)"];
}
const cssVars = item => {
  const [a,b,c] = palette(item);
  return "--cos-a:" + a + ";--cos-b:" + b + ";--cos-c:" + c + ";";
};
function avatar(identity) {
  if (/^\d{17,20}$/.test(String(identity?.id)) && /^[a-f0-9]{32}$/.test(String(identity?.avatar))) {
    return '<img loading="lazy" alt="" src="https://cdn.discordapp.com/avatars/' +
      esc(identity.id) + "/" + esc(identity.avatar) + '.png?size=256">';
  }
  return "<span>" + esc(String(identity?.displayName || identity?.username || "?").slice(0,1).toUpperCase()) + "</span>";
}
const equipped = (profile, type, item) => Boolean(profile.equipped?.[type] && profile.equipped[type].id === item?.id);
function art(item, type, large = false) {
  const base = '<span class="cos-stars" aria-hidden="true">✦ · ✧ · ✦</span>';
  if (type === "banner") {
    // Exact JPEG frames extracted from the bot's original profile-assets.js,
    // served as self-contained SVG wrappers (no third-party image host).
    const match = /^banner_([a-z0-9]+)$/.exec(String(item?.id || ""));
    const original = match ? '/profile-banners/' + match[1] + '.svg' : '/profile-banners/classic.svg';
    // Generated artwork is present for the first 20 banner IDs.
    // The original embedded bot artwork is the fallback for missing assets.
    const generatedIds = new Set([
      "banner_ocean", "banner_forest", "banner_sunset", "banner_neon",
      "banner_ice", "banner_galaxy", "banner_shadow",
      "banner_gold", "banner_pumpkin", "banner_graveyard",
      "banner_dawn", "banner_lake", "banner_dunes", "banner_sakura",
      "banner_storm", "banner_autumn", "banner_megacity", "banner_orbit",
      "banner_volcano", "banner_skycastle",
    ]);
    const generated = generatedIds.has(item?.id) ? '/banners/' + item.id + '.webp' : null;
    const images = generated ? 'url(' + generated + '),url(' + original + ')' : 'url(' + original + ')';
    return '<div class="cos-banner-art cos-original ' + (large ? "cos-banner-large" : "") +
      '" style="' + cssVars(item) + 'background-image:' + images + ';background-size:cover;background-position:center">' +
      '</div>';
  }
  if (type === "color") return '<div class="cos-swatch" style="' + cssVars(item) + '"></div>';
  return '<div class="cos-symbol" style="' + cssVars(item) + '" aria-hidden="true">' +
    esc(iconFor(item,type)) + '</div>';
}
export function renderCosmeticArtwork(item) {
  return art(item, item?.type || 'banner');
}
function rarity(item) {
  return '<span class="cos-rarity cos-' + rarityClass(item?.rarity) + '">' +
    esc(item?.rarity || "Косметика") + '</span>';
}
function card(item,type,profile) {
  const chosen = equipped(profile,type,item);
  return '<div class="cos-item ' + (chosen ? "cos-picked" : "") + '" title="' +
    esc(item.description || item.name) + '">' + art(item,type) +
    '<div class="cos-item-bottom"><strong>' + esc(stripPrefix(item)) +
    '</strong>' + rarity(item) + '</div>' +
    (chosen ? '<span class="cos-equipped">✓ Экипировано</span>' :
      '<button type="button" class="cos-equip-button" data-equip-id="' + esc(item.id) +
      '">Экипировать</button>') + '</div>';
}
function tiles(profile, type, limit=0) {
  const list = owned(profile,type);
  if (!list.length) return '<div class="cos-empty">Пока нет предметов этой категории. Их можно получить в Discord.</div>';
  return '<div class="cos-item-grid">' + (limit ? list.slice(0,limit) : list).map(item => card(item,type,profile)).join("") + '</div>';
}
function gallery(profile, all=false) {
  const groups = slots.map(slot => {
    const count = owned(profile,slot.type).length;
    return '<section class="cos-group"><div class="cos-group-heading"><div><span class="cos-group-icon">' +
      slot.icon + '</span><h3>' + slot.label + '</h3><span class="cos-count">' + fmt(count) +
      '</span></div>' + (!all && count > 4 ? '<button class="cos-see-all" type="button" data-go="cosmetics">Все предметы ↗</button>' : '') +
      '</div>' + tiles(profile,slot.type,all?0:4) + '</section>';
  });
  return '<div class="cos-galleries">' + groups.join("") + '</div>';
}
function equippedSummary(profile) {
  return '<aside class="cos-summary"><h3>✧ Экипированная косметика</h3>' +
    slots.map(slot => {
      const item = profile.equipped?.[slot.type];
      return '<div class="cos-summary-row">' +
        (item ? art(item,slot.type) : '<div class="cos-symbol cos-none">—</div>') +
        '<div><small>' + slot.label + '</small><strong>' + esc(item ? stripPrefix(item) : "Не выбрано") +
        '</strong></div>' + (item ? rarity(item) : '') + '</div>';
    }).join("") + '</aside>';
}
function stat(label, value, icon) {
  return '<div class="cos-stat"><span class="cos-stat-icon">' + icon + '</span><div><small>' +
    label + '</small><strong>' + esc(value) + '</strong></div></div>';
}
export function renderCosmeticProfile(session) {
  const p = session.profile;
  const identity = session.identity;
  const banner = p.equipped?.banner;
  const color = p.equipped?.color;
  const title = p.equipped?.title;
  const level = Math.max(0, Number(p.level || 0));
  const xp = Math.max(0, Number(p.xp || 0));
  const base = 100*level*level;
  const span = 100*((level+1)*(level+1)-level*level);
  const progress = Math.round(Math.max(0,Math.min(100,(xp-base)/span*100)));
  const count = (p.inventory || []).length;
  return '<div class="cos-page" style="' + cssVars(color || banner) + '">' +
    '<div class="cos-eyebrow">SPIRIT FREEDOM / ПРОФИЛЬ УЧАСТНИКА</div>' +
    '<div class="cos-layout"><section class="cos-identity">' +
    '<div class="cos-banner">' + art(banner || { id:"banner_default", name:"Космический профиль" }, "banner",true) +
    '<div class="cos-banner-caption"><small>БАННЕР ПРОФИЛЯ</small><h1>' +
    esc(banner ? stripPrefix(banner) : "МОЙ МИР") +
    '</h1><span>' + (banner ? "ЭКИПИРОВАНО" : "СТАНДАРТНЫЙ ФОН") + '</span></div></div>' +
    '<div class="cos-identity-inner"><div class="cos-userline"><div class="cos-avatar">' +
    avatar(identity) + '</div><div><span class="cos-muted">ПРОФИЛЬ УЧАСТНИКА</span><h2>' +
    esc(identity.displayName || identity.username) + '</h2><p>' +
    esc(title ? stripPrefix(title) : "Участник сообщества") +
    '</p></div></div>' +
    '<div class="cos-xp"><div><strong>УРОВЕНЬ ' + fmt(level) + '</strong><span>' + fmt(xp) +
    ' XP</span><b>' + progress + '%</b></div><div class="cos-progress"><span style="width:' +
    progress + '%"></span></div></div>' +
    '<div class="cos-stats">' +
    stat("МОНЕТЫ",fmt(p.balance),"🪙") + stat("УРОВЕНЬ",fmt(level),"⇧") +
    stat("КОЛЛЕКЦИЯ",fmt(count),"◈") +
    stat("РАНГ",p.rank?.rank || "—","♛") +
    stat("СООБЩЕНИЯ",fmt(p.rank?.messages),"☏") +
    stat("АКТИВНЫЕ ДНИ",fmt(p.rank?.activeDays),"▦") +
    '</div>' +
    '<div class="cos-title-strip"><span>✧ ТИТУЛ УЧАСТНИКА</span><strong>' +
    esc(title ? stripPrefix(title) : "Титул не выбран") + '</strong>' +
    (title ? rarity(title) : '') + '</div></div></section>' +
    equippedSummary(p) + '</div>' + gallery(p) +
    '<p class="cos-disclaimer">Предметы и выбранное оформление загружены из Discord-бота. Нажми «Экипировать», чтобы применить принадлежащий тебе предмет.</p></div>';
}
export function renderCosmeticsGallery(session) {
  const p = session.profile;
  return '<div class="cos-page"><div class="cos-eyebrow">МОЯ КОЛЛЕКЦИЯ</div>' +
    '<div class="cos-gallery-heading"><h1>Косметика <em>профиля</em></h1>' +
    '<p>Все твои баннеры, цвета, значки и титулы из Discord.</p></div>' +
    equippedSummary(p) + gallery(p,true) +
    '<p class="cos-disclaimer">Показаны только твои предметы из Discord. Выбор экипировки подтверждается ботом и автоматически обновляет профиль.</p></div>';
}
