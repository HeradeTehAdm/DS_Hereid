// The storefront is a view of the Discord bot's authoritative catalog.
// Purchases are NOT simulated: only the Discord bot may charge balances.
import { renderCosmeticArtwork } from "./cosmetic-profile.js";
const escape = (value) => String(value ?? "").replace(/[&<>"']/g, ch => (
  {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]
));
const format = value => Number(value || 0).toLocaleString("ru-RU");
const categories = [
  {type:"all",name:"Весь магазин",symbol:"✦"},
  {type:"banner",name:"Баннеры",symbol:"▧"},
  {type:"color",name:"Цвета",symbol:"◈"},
  {type:"badge",name:"Значки",symbol:"✧"},
  {type:"title",name:"Титулы",symbol:"♛"},
];
export const STORE_CATEGORIES = categories.map(x => x.type);
export const itemIsOwned = (profile,item) => Boolean((profile?.inventory || []).some(x => x.id === item.id));
export const itemIsEquipped = (profile,item) => Boolean(profile?.equipped?.[item.type]?.id === item.id);
const stripName = name => String(name || "").replace(/^(Баннер|Цвет|Значок|Титул)\s*[«"](.+)[»"]$/i,"$2");
export function filterShopItems(items, {category="all",search="",sort="featured",affordable=false,balance=0}={}) {
  const needle = String(search).trim().toLocaleLowerCase("ru").slice(0,80);
  const source = Array.isArray(items) ? items : [];
  const valid = source.filter(item => item && ["banner","color","badge","title"].includes(item.type) &&
    (category === "all" || item.type === category) &&
    (!affordable || (Number.isFinite(item.price) && item.price <= balance)) &&
    (!needle || [item.name,item.description,item.category].some(value => String(value||"").toLocaleLowerCase("ru").includes(needle))));
  if (sort === "price-low") return valid.sort((a,b) => a.price-b.price || a.id.localeCompare(b.id));
  if (sort === "price-high") return valid.sort((a,b) => b.price-a.price || a.id.localeCompare(b.id));
  if (sort === "name") return valid.sort((a,b) => String(a.name).localeCompare(String(b.name),"ru"));
  return valid;
}
function rarity(item) {
  const value = String(item.rarity || "Обычный");
  const kind = value.includes("Миф") ? "mythic" : value.includes("Леген") ? "legendary" :
    value.includes("Эпич") ? "epic" : value.includes("Редк") ? "rare" : "common";
  return '<span class="sf-rarity sf-'+kind+'">'+escape(value)+'</span>';
}
export function renderShopResults(profile, options={}) {
  const items = filterShopItems(profile?.catalog, {...options,balance:profile?.balance});
  if (!items.length) return '<div class="sf-no-results"><div>✧</div><h3>Предметы не найдены</h3><p>Попробуй другую категорию или поисковый запрос.</p></div>';
  const visible = items.slice(0,120);
  const cards = visible.map(item => {
    const owned = itemIsOwned(profile,item);
    const equipped = itemIsEquipped(profile,item);
    const canAfford = Number(profile?.balance||0) >= Number(item.price||0);
    const label = equipped ? "✓ Экипировано" : owned ? "Экипировать" : canAfford ? "Купить" : "Недостаточно монет";
    const action = owned && !equipped ? '<button class="sf-action sf-action-equip" data-equip-id="'+escape(item.id)+'" type="button">Экипировать</button>' :
      !owned && canAfford ? '<button class="sf-action sf-action-buy" data-buy-id="'+escape(item.id)+'" data-buy-price="'+item.price+'" type="button">Купить</button>' :
      '<span class="sf-action sf-action-static '+(equipped?"sf-action-equipped":"")+'">'+escape(label)+'</span>';
    return '<article class="sf-product" data-type="'+escape(item.type)+'">'+
      '<div class="sf-art">'+renderCosmeticArtwork(item)+'</div>'+
      '<div class="sf-product-body"><div class="sf-product-head">'+rarity(item)+
      (owned?'<span class="sf-own-tag">В коллекции</span>':'')+'</div>'+
      '<h3>'+escape(stripName(item.name))+'</h3><p>'+escape(item.description||"Предмет оформления")+'</p>'+
      '<div class="sf-product-footer"><strong>🪙 '+format(item.price)+'</strong>'+action+'</div></div></article>';
  }).join("");
  return '<div class="sf-result-count">Показано '+format(visible.length)+' из '+format(items.length)+' предметов'+
    (visible.length<items.length?' · Уточни поиск для остальных':'')+'</div><div class="sf-product-grid">'+cards+'</div>';
}
export function renderShopPage(profile, options={}) {
  const category = options.category || "all";
  const count = (type) => (profile?.catalog||[]).filter(i => i.type === type).length;
  return '<div class="sf-store"><div class="sf-store-hero"><div class="sf-store-eyebrow">SPIRIT MARKET · КОЛЛЕКЦИЯ СООБЩЕСТВА</div>'+
    '<h1>Магазин <em>легенд</em></h1><p>Открой свой стиль — баннеры, цвета, значки и титулы из Discord. Все цены и предметы загружены из бота.</p>'+
    '<div class="sf-store-summary"><div><small>ТВОЙ БАЛАНС</small><strong>🪙 '+format(profile.balance)+'</strong></div>'+
    '<div><small>В КАТАЛОГЕ</small><strong>'+format(profile.catalog?.length)+'</strong></div>'+
    '<div><small>МОЯ КОЛЛЕКЦИЯ</small><strong>'+format(profile.inventory?.length)+'</strong></div></div></div>'+
    '<div class="sf-store-toolbar"><nav class="sf-tabs" aria-label="Категории магазина">'+categories.map(x =>
      '<button type="button" data-shop-category="'+x.type+'" class="'+(category===x.type?"selected":"")+'" aria-pressed="'+(category===x.type)+'">'+
      '<span>'+x.symbol+'</span>'+x.name+'<small>'+format(x.type==="all" ? (profile?.catalog||[]).length:count(x.type))+'</small></button>').join("")+'</nav>'+
    '<div class="sf-filters"><label class="sf-search"><span aria-hidden="true">⌕</span><input type="search" data-shop-search maxlength="80" placeholder="Поиск по названию..." aria-label="Поиск по предметам" value="'+escape(options.search||"")+'"></label>'+
    '<label class="sf-select-wrap">Сортировка <select data-shop-sort aria-label="Сортировать предметы">'+
    [["featured","По умолчанию"],["price-low","Сначала дешёвые"],["price-high","Сначала дорогие"],["name","По названию"]].map(([v,label])=>
    '<option value="'+v+'" '+(options.sort===v?"selected":"")+'>'+label+'</option>').join("")+'</select></label>'+
    '<label class="sf-affordable"><input type="checkbox" data-shop-affordable '+(options.affordable?"checked":"")+'> По карману</label></div></div>'+
    '<div id="shop-results">'+renderShopResults(profile,options)+'</div>'+
    '<p class="sf-shop-note">Покупки и экипировка отправляются Discord-боту для проверки. Монеты списывает только бот в своей базе данных, после подтверждения операции.</p></div>';
}
