import "./style.css";
import "./cosmetic-profile.css";
import "./shop-view.css";
import "./community.css";
import "./appearance.css";
import "./memory-game.css";
import { memoryPage, bindMemory } from "./memory-game.js";
import { appearancePage, setAppearance } from "./appearance.js";
import { bindPromo, promoForm } from "./web-promos.js";
import { renderCosmeticProfile, renderCosmeticsGallery } from "./cosmetic-profile.js";
import { renderShopPage, renderShopResults, STORE_CATEGORIES } from "./shop-view.js";
import { isDiscordActivity, activityApiPath, activityAuthHeaders, connectDiscordActivity, clearActivitySession } from "./discord-activity.js";

const svg = (name, size = 22) => {
  const shapes = {
    games: '<rect x="3" y="7" width="18" height="12" rx="4"/><path d="M6 13h6m-3-3v6m6-4h.01m3 3h.01"/>',
    inventory: '<path d="M3 8l9-5 9 5-9 5zM3 8v9l9 5 9-5V8M12 13v9"/>',
    cosmetics: '<path d="M4 16l9-9 4 4-9 9H4zM15 5l2-2 4 4-2 2M4 4v4M2 6h4"/>',
    shop: '<path d="M4 10v10h16V10M3 10l2-6h14l2 6M3 10q2 4 5 0 2 4 4 0 2 4 4 0 3 4 5 0M9 20v-6h6v6"/>',
    quests: '<path d="M9 5H5v16h14V5h-4M9 3h6v4H9zM8 13l3 3 5-6"/>',
    promos: '<path d="M3 7h18v4a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4zM15 8v2m0 3v2"/>',
    history: '<path d="M3 11a9 9 0 1 1 2 7M3 5v6h6M12 7v6l4 2"/>',
    bird: '<path d="M16 7h.01M7 17c3-1 5-4 5-8 2 3 5 3 8 2-2 3-5 5-9 6l-4 3 1-4-4-3c3 0 5-2 6-5"/>',
    home: '<path d="m3 10 9-7 9 7v10H3V10Z"/><path d="M9 20v-7h6v7"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    trophy: '<path d="M7 3h10v8a5 5 0 0 1-10 0V3ZM7 5H4v3a4 4 0 0 0 4 4m9-7h3v3a4 4 0 0 1-4 4M12 16v5m-4 0h8"/>',
    spark: '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z"/>',
    arrow: '<path d="m9 18 6-6-6-6"/>'
  };
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (shapes[name] || shapes.spark) + '</svg>';
};

const sections = [
  { id: "home", label: "Главная", icon: "home" },
  { id: "profile", label: "Профиль", icon: "user" },
  { id: "achievements", label: "Награды", icon: "trophy" },
  { id: "inventory", label: "Коллекция", icon: "inventory" },
  { id: "cosmetics", label: "Косметика", icon: "cosmetics" },
  { id: "shop", label: "Магазин", icon: "shop" },
  { id: "quests", label: "Задания", icon: "quests" },
  { id: "admin", label: "Администрация", icon: "quests" },
  { id: "promos", label: "Промокоды", icon: "promos" },
  { id: "games", label: "Мини-игры", icon: "games" },
  { id: "appearance", label: "Оформление", icon: "cosmetics" },
  { id: "history", label: "История", icon: "history" },
];

const root = document.getElementById("app");
let current = "home";
let session = null;
let refreshTimer = null;
let profileAttempts = 0;
const checkDelay = attempt => document.hidden ? 15000 : Math.min(8000, 1200 * 2 ** Math.min(attempt, 3));
let activityState = isDiscordActivity ? "connecting" : "browser";
let activityError = "";
let equipPending = false;
let equipFeedback = "";
let purchasePending = false;
let purchaseFeedback = "";
const shopFilters = { category: "all", search: "", sort: "featured", affordable: false, page: 0 };

const safe = (text) => String(text ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const num = (value) => Number(value || 0).toLocaleString("ru-RU");

function syncStateLabel() {
  if (isDiscordActivity && activityState === "connecting") return "ВХОД ЧЕРЕЗ DISCORD";
  if (isDiscordActivity && activityState === "error") return "ОШИБКА ПОДКЛЮЧЕНИЯ";
  if (!session?.identity) return "ГОСТЕВОЙ РЕЖИМ";
  if (session.sync === "connected") return "СИНХРОНИЗАЦИЯ АКТИВНА";
  if (session.sync === "pending") return "ОЖИДАЕМ ДАННЫЕ БОТА";
  if (session.sync === "not_configured") return "ПОДКЛЮЧЕНИЕ НЕ НАСТРОЕНО";
  return "НЕТ СВЯЗИ С БОТОМ";
}

async function loadSession() {
  try {
    const response = await fetch(activityApiPath("/api/me"), { credentials: isDiscordActivity ? "omit" : "same-origin", headers: { "Accept": "application/json", ...activityAuthHeaders() }, cache: "no-store" });
    if (response.ok) session = await response.json();
    else session = null;
  } catch { session = null; }
  render();
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
  if (session?.sync === "pending") {
    refreshTimer = setTimeout(() => { void loadSession(); }, checkDelay(profileAttempts++));
  } else profileAttempts = 0;
}

async function handleEquip(itemId) {
  if (equipPending || !session?.profile) return;
  equipPending = true;
  equipFeedback = "Отправляем запрос на экипировку в Discord…";
  render();
  const headers = {
    "Accept": "application/json", "Content-Type": "application/json",
    "x-spirit-action": "equip", ...activityAuthHeaders(),
  };
  try {
    const response = await fetch(activityApiPath("/api/equip"), {
      method: "POST", headers, body: JSON.stringify({ itemId }),
      credentials: isDiscordActivity ? "omit" : "same-origin", cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok || !payload?.id) {
      if (response.status === 409) throw new Error("Предыдущий запрос ещё выполняется.");
      if (response.status === 403) throw new Error("Предмет не принадлежит тебе или профиль нужно обновить.");
      throw new Error("Не удалось отправить запрос. Проверь соединение.");
    }
    equipFeedback = "Запрос принят. Бот проверяет предмет и применяет оформление…";
    render();
    const deadline = Date.now() + 110000;
    let statusAttempt = 0;
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, checkDelay(statusAttempt++)));
      const statusResponse = await fetch(activityApiPath("/api/equip?id=" + encodeURIComponent(payload.id)), {
        headers: { "Accept": "application/json", ...activityAuthHeaders() },
        credentials: isDiscordActivity ? "omit" : "same-origin", cache: "no-store",
      });
      if (!statusResponse.ok) throw new Error("Не удалось получить состояние запроса.");
      const status = await statusResponse.json();
      if (status.status === "complete") {
        equipFeedback = "✓ Экипировка применена! Обновляем профиль…";
        await loadSession();
        return;
      }
      if (status.status === "rejected") {
        throw new Error(status.code === "not_owned" ? "Предмет больше не находится в инвентаре." :
          status.code === "expired" ? "Истекло время выполнения. Попробуй ещё раз." :
          "Бот отклонил смену оформления.");
      }
    }
    throw new Error("Бот пока не подтвердил запрос. Проверь соединение и повтори позже.");
  } catch (error) {
    equipFeedback = error?.message || "Ошибка экипировки.";
  } finally {
    equipPending = false;
    render();
  }
}

async function handlePurchase(itemId, price) {
  if (purchasePending || !session?.profile) return;
  const item = session.profile.catalog?.find(x => x.id === itemId);
  if (!item || session.profile.inventory?.some(x => x.id === itemId)) return;
  if (item.price !== price || price > session.profile.balance) return;
  if (!window.confirm("Купить «" + item.name + "» за " + num(price) + " монет?")) return;
  purchasePending = true;
  purchaseFeedback = "Подтверждаем покупку в Discord…";
  render();
  try {
    const response = await fetch(activityApiPath("/api/purchase"), {
      method: "POST", headers: {
        Accept:"application/json","Content-Type":"application/json",
        "x-spirit-action":"purchase",...activityAuthHeaders()
      }, body:JSON.stringify({itemId}),
      credentials:isDiscordActivity ? "omit" : "same-origin",cache:"no-store",
    });
    const data = await response.json();
    if (!response.ok || !data.id) {
      if (response.status === 409) throw new Error(({
        "already_owned":"Предмет уже куплен.",
        "insufficient_funds":"Недостаточно монет.",
        "profile_not_synced":"Обнови профиль перед покупкой.",
        "not_for_sale":"Предмет недоступен для покупки."
      })[data.error] || "Другая покупка ещё выполняется.");
      throw new Error("Не удалось отправить запрос на покупку.");
    }
    purchaseFeedback = "Бот проверяет баланс и оформляет покупку…";
    render();
    const deadline = Date.now() + 110000;
    let statusAttempt = 0;
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, checkDelay(statusAttempt++)));
      const check = await fetch(activityApiPath("/api/purchase?id="+encodeURIComponent(data.id)),{
        headers:{Accept:"application/json",...activityAuthHeaders()},
        credentials:isDiscordActivity?"omit":"same-origin",cache:"no-store",
      });
      if (!check.ok) throw new Error("Ошибка проверки покупки.");
      const result = await check.json();
      if (result.status === "complete") {
        purchaseFeedback = "✓ Покупка подтверждена ботом! Обновляем инвентарь…";
        await loadSession();
        return;
      }
      if (result.status === "rejected") {
        throw new Error(({
          insufficient_funds:"Недостаточно монет.",
          not_for_sale:"Этот предмет сейчас не продаётся.",
          unknown_item:"Предмет отсутствует в каталоге.",
          expired:"Время ожидания истекло."
        })[result.code] || "Бот отклонил покупку.");
      }
    }
    throw new Error("Покупка ожидает подтверждения бота. Проверь профиль позже, не отправляй повторный запрос.");
  } catch(error) {
    purchaseFeedback = error?.message || "Ошибка покупки.";
  } finally {
    purchasePending = false;
    render();
  }
}

function profileContent() {
  if (isDiscordActivity && activityState !== "ready") return '<div class="empty"><h3>' + safe(activityState === "error" ? "Ошибка входа" : "Входим через Discord") + '</h3><p>' + safe(activityError || "Подключаем приложение к твоей учётной записи Discord…") + '</p>' + (activityState === "error" ? '<button class="logout" data-activity-retry>Повторить попытку</button>' : '') + '</div>';
  if (!session?.identity) return '<div class="empty"><div class="empty-symbol">' + svg("user", 38) + '</div><h3>Войди через Discord</h3><p>Чтобы открыть личный профиль, сначала подтверди свою учётную запись Discord.</p><a class="primary login-button" href="/api/auth/login">Войти через Discord ' + svg("arrow", 20) + '</a></div>';
if (!session?.profile) return '<div class="profile-card"><div class="profile-avatar">' + safe((session.identity.displayName || "?").slice(0, 1)) + '</div><div><span class="eyebrow">DISCORD ПОДКЛЮЧЁН</span><h2>' + safe(session.identity.displayName) + '</h2><p>@' + safe(session.identity.username) + '</p></div></div><div class="empty"><div class="empty-symbol">' + svg("spark", 34) + '</div><h3>Аккаунт подключён!</h3><p>Ты успешно авторизован через Discord. Уровень, XP и награды появятся после подключения. Проверь статус синхронизации и повтори запрос.</p><span class="tag">Синхронизация профиля — следующий этап</span><div><button class="logout" data-retry>Проверить соединение</button> <button class="logout" data-logout>Выйти из аккаунта</button></div></div>';
  return renderCosmeticProfile(session);
}

function syncPage(title, description, renderBody) {
  const heading = '<section class="heading"><span class="eyebrow">ДАННЫЕ ИЗ DISCORD</span><h1>' + safe(title) + '</h1><p>' + safe(description) + '</p></section>';
  if (isDiscordActivity && activityState !== "ready") return heading + '<div class="empty"><h3>Подключаем Discord</h3><p>' + safe(activityError || "Проверяем учётную запись…") + '</p></div>';
  if (!session?.identity) return heading + '<div class="empty"><h3>Войди через Discord</h3><p>Нужна авторизация для просмотра своих данных.</p><a class="primary login-button" href="/api/auth/login">Войти через Discord</a></div>';
  if (!session.profile) return heading + '<div class="empty"><h3>Ожидается соединение с ботом</h3><p>Профильное API временно недоступно или ещё не подключено.</p></div>';
  return heading + renderBody();
}

function itemCards(items, empty = "Здесь пока ничего нет.") {
  if (!items?.length) return '<div class="empty"><h3>' + safe(empty) + '</h3></div>';
  return '<div class="feature-grid">' + items.map((item) =>
    '<div class="feature"><span class="feature-icon purple">' + svg("spark", 22) + '</span><strong>' +
    safe(item.name) + '</strong><small>' + safe(item.description || item.category || "") +
    '</small><span class="tag">' + safe(item.rarity || item.category || "") +
    (typeof item.price === "number" ? ' · ' + num(item.price) + ' 🪙' : '') +
    '</span></div>').join("") + '</div>';
}

function extendedContent() {
  const p = session?.profile;
  if (current === "inventory" || current === "cosmetics") return syncPage("Моя коллекция", "Все предметы и оформление из Discord.", () => renderCosmeticsGallery(session));
  if (current === "shop") return syncPage("Магазин", "Твой стиль — в одном месте.", () => renderShopPage(p, shopFilters));
  if (current === "quests") return syncPage("Ежедневные задания", "Текущий прогресс заданий из Discord.",
    () => p?.quests?.length ? '<div class="feature-grid">' + p.quests.map(q =>
      '<div class="feature"><strong>' + safe(q.name) + '</strong><small>' + safe(q.description) +
      '</small><span class="tag">' + num(q.progress) + '/' + num(q.target) +
      ' · ' + (q.completed ? 'Выполнено' : 'В процессе') +
      ' · +' + num(q.reward) + ' 🪙</span></div>').join("") + '</div>' :
      '<div class="empty"><h3>Пока нет заданий</h3></div>');
  if (current === "admin") return syncPage("Администрация", "Создание промокодов сообщества.",
    () => p.canManagePromos ? promoForm("create") : "<p>Нет доступа.</p>");
  if (current === "promos") return syncPage("Промокоды", "Введи код сообщества, чтобы получить монеты.",
    () => promoForm("redeem") + (p?.redeemedPromos?.length ? '<div class="feature-grid">' + p.redeemedPromos.map(x =>
      '<div class="feature"><strong>' + safe(x.code) + '</strong><small>Промокод активирован</small></div>').join("") +
      '</div>' : '<div class="empty"><h3>Использованных промокодов пока нет</h3><p>Доступные коды публикуются администрацией Discord-сервера.</p></div>'));
  if (current === "history") return syncPage("История монет", "Твои последние операции. Источник — база Discord-бота.",
    () => p?.transactions?.length ? '<div class="feature-grid">' + p.transactions.map(t =>
      '<div class="feature"><strong>' + (t.amount >= 0 ? '+' : '') + num(t.amount) +
      ' 🪙</strong><small>' + safe(t.details || t.kind) + '</small><span class="tag">' +
      safe(t.kind) + '</span></div>').join("") + '</div>' :
      '<div class="empty"><h3>Пока нет операций</h3></div>');
  return "";
}

function content() {
  if (current === "games") return memoryPage();
  if (current === "appearance") return appearancePage();
  if (["inventory", "cosmetics", "shop", "quests", "promos", "admin", "history"].includes(current)) return extendedContent();
  if (current === "profile") return profileContent();
  if (current === "achievements") {
    const heading = '<section class="heading"><span class="eyebrow">КОЛЛЕКЦИЯ</span><h1>Твои <em>награды</em></h1><p>Особенные моменты заслуживают признания.</p></section>';
    if (isDiscordActivity && activityState !== "ready") return heading + '<div class="empty"><h3>Подключаем Discord</h3><p>' + safe(activityError || "Проверяем учётную запись…") + '</p></div>';
    if (!session?.identity) return heading + '<div class="empty"><h3>Войди через Discord</h3><p>Авторизуйся, чтобы открыть свои награды.</p><a class="primary login-button" href="/api/auth/login">Войти через Discord</a></div>';
    if (!session?.profile) return heading + '<div class="empty"><h3>Синхронизация пока недоступна</h3><p>Подключение к профилю бота ещё не настроено или временно не отвечает.</p></div>';
    const awards = session.profile.achievements || [];
    if (!awards.length) return heading + '<div class="empty"><h3>Пока нет достижений</h3><p>Новые награды появятся здесь, когда бот их выдаст.</p></div>';
    return heading + '<div class="feature-grid">' + awards.map(a =>
      '<div class="feature"><span class="feature-icon purple">' + safe(a.badge) + '</span><strong>' +
      safe(a.name) + '</strong><small>' + safe(a.description) + '</small><span class="tag">' +
      safe(a.rarity) + '</span></div>'
    ).join("") + '</div>';
  }
  return '<section class="hero"><div class="hero-copy"><h1>Дух <em>Свободы</em></h1><p>Личный кабинет сообщества HeradeLegend</p><button class="primary" data-go="profile">Мой профиль ' + svg("arrow", 18) + '</button></div></section>' +
    '<section class="home-links"><h2>Разделы сообщества</h2><div class="feature-grid">' +
    sections.filter(section => ["achievements","inventory","shop","games"].includes(section.id)).map(section =>
      '<button type="button" class="feature" data-go="' + section.id + '"><span class="feature-icon">' +
      svg(section.icon, 25) + '</span><strong>' + section.label + '</strong><span class="feature-next">' + svg("arrow", 18) + '</span></button>'
    ).join("") + '</div></section>';
}

function navigation() {
  return '<span class="nav-indicator" aria-hidden="true"></span>' + sections.map(section =>
    '<button class="nav-link" type="button" data-go="' + section.id + '">' +
    svg(section.icon, 20) + '<span>' + section.label + '</span></button>'
  ).join("");
}

const avatarMark = '<span class="brand-mark bot-avatar"><span aria-hidden="true">ДС</span><img src="/bot-avatar.webp" alt="" width="44" height="44"></span>';
root.innerHTML = '<div class="shell"><aside class="sidebar"><div class="brand">' + avatarMark + '<div><strong>Дух Свободы</strong><small>HeradeLegend</small></div></div>' +
  '<nav class="section-nav" aria-label="Разделы">' + navigation() + '</nav></aside>' +
  '<div class="workspace"><header class="topbar">' + avatarMark + '<strong class="section-name"></strong><span class="top-status"><span class="status-dot"></span><span id="status-label"></span></span></header>' +
  '<main id="content" tabindex="-1"></main><footer>Дух Свободы © 2026</footer></div>' +
  '<nav class="bottom-nav section-nav" aria-label="Мобильная навигация">' + navigation() + '</nav></div>';

for (const img of root.querySelectorAll(".bot-avatar img")) {
  img.addEventListener("error", () => { img.hidden = true; });
  if (img.complete && !img.naturalWidth) img.hidden = true;
}
root.addEventListener("change", event => {
  if (event.target.matches("input[data-appearance]")) setAppearance(event.target.name,event.target.value);
});
const panel = root.querySelector("#content");
const menus = [...root.querySelectorAll(".section-nav")];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let entrance;

function positionIndicator(menu) {
  const active = menu.querySelector('[aria-current="page"]');
  if (!active || !menu.clientWidth) return;
  const indicator = menu.querySelector(".nav-indicator");
  indicator.style.width = active.offsetWidth + "px";
  indicator.style.height = active.offsetHeight + "px";
  indicator.style.transform = "translate(" + active.offsetLeft + "px," + active.offsetTop + "px)";
}

function updateNavigation() {
  for (const menu of menus) {
    for (const button of menu.querySelectorAll("[data-go]")) {
      if (button.dataset.go === current) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
    positionIndicator(menu);
  }
  root.querySelector(".section-name").textContent = sections.find(section => section.id === current).label;
}

const menuObserver = new ResizeObserver(entries => {
  for (const entry of entries) positionIndicator(entry.target);
});
for (const menu of menus) menuObserver.observe(menu);

root.addEventListener("click", event => {
  const button = event.target.closest("button[data-go]");
  if (!button || current === button.dataset.go) return;
  const fromContent = panel.contains(button);
  current = button.dataset.go;
  updateNavigation();
  render();
  if (fromContent) panel.focus({ preventScroll: true });
  window.scrollTo({top: 0, behavior: "instant"});
  const mobileMenu = root.querySelector(".bottom-nav");
  if (mobileMenu.clientWidth) mobileMenu.querySelector('[aria-current="page"]').scrollIntoView({
    block: "nearest", inline: "nearest", behavior: reducedMotion.matches ? "instant" : "smooth"
  });
  entrance?.cancel();
  if (!reducedMotion.matches) entrance = panel.animate([
    {opacity: .75, transform: "translateY(5px)"}, {opacity: 1, transform: "none"}
  ], {duration: 190, easing: "ease-out"});
});

updateNavigation();
let promoBinding;
function render() {
  promoBinding?.abort();
  if (current === "admin" && !session?.profile?.canManagePromos) current = "promos";
  for (const link of root.querySelectorAll('[data-go="admin"]')) link.hidden = !session?.profile?.canManagePromos;
  updateNavigation();
  root.querySelector("#status-label").textContent = syncStateLabel();
  panel.innerHTML = (equipFeedback ? '<div role="status" class="cos-toast">' + safe(equipFeedback) + '</div>' : '') +
    (purchaseFeedback ? '<div role="status" class="cos-toast">' + safe(purchaseFeedback) + '</div>' : '') + content();
  const board = panel.querySelector(".memory-game");
  if (board) bindMemory(board);
  const form = panel.querySelector("[data-promo]");
  if (form) {
    promoBinding = new AbortController();
    bindPromo(form,promoBinding.signal,loadSession);
  }
  const attachEquipHandlers = (scope = root) => {
    for (const button of scope.querySelectorAll("[data-equip-id]")) {
      button.disabled = equipPending;
      button.addEventListener("click", () => { void handleEquip(button.dataset.equipId); });
    }
  };
  const attachPurchaseHandlers = (scope = root) => {
    for (const button of scope.querySelectorAll("[data-buy-id]")) {
      button.disabled = purchasePending;
      button.addEventListener("click", () => {
        void handlePurchase(button.dataset.buyId,Number(button.dataset.buyPrice));
      });
    }
  };
  attachEquipHandlers();
  attachPurchaseHandlers();
  const redrawShop = () => {
    const mount = root.querySelector("#shop-results");
    if (!mount || !session?.profile) return;
    mount.innerHTML = renderShopResults(session.profile, shopFilters);
    attachEquipHandlers(mount);
    attachPurchaseHandlers(mount);
    attachPagination(mount);
  };
  const attachPagination = (scope = root) => {
    for (const button of scope.querySelectorAll("[data-shop-page]")) button.addEventListener("click", () => {
      const page = Number(button.dataset.shopPage);
      if (!Number.isSafeInteger(page) || page < 0) return;
      shopFilters.page = page;
      redrawShop();
      root.querySelector(".sf-store-toolbar")?.scrollIntoView({block:"start",behavior:"smooth"});
    });
  };
  attachPagination();
  for (const button of root.querySelectorAll("[data-shop-category]")) button.addEventListener("click", () => {
    if (!STORE_CATEGORIES.includes(button.dataset.shopCategory)) return;
    shopFilters.category = button.dataset.shopCategory;
    shopFilters.page = 0;
    for (const tab of root.querySelectorAll("[data-shop-category]")) {
      const selected = tab.dataset.shopCategory === shopFilters.category;
      tab.classList.toggle("selected", selected);
      tab.setAttribute("aria-pressed", String(selected));
    }
    redrawShop();
  });
  const searchInput = root.querySelector("[data-shop-search]");
  if (searchInput) searchInput.addEventListener("input", () => {
    shopFilters.search = searchInput.value.slice(0, 80);
    shopFilters.page = 0;
    redrawShop();
  });
  const selectInput = root.querySelector("[data-shop-sort]");
  if (selectInput) selectInput.addEventListener("change", () => { shopFilters.sort = selectInput.value; shopFilters.page = 0; redrawShop(); });
  const affordableInput = root.querySelector("[data-shop-affordable]");
  if (affordableInput) affordableInput.addEventListener("change", () => { shopFilters.affordable = affordableInput.checked; shopFilters.page = 0; redrawShop(); });
  const retryActivity = root.querySelector("[data-activity-retry]");
  if (retryActivity) retryActivity.addEventListener("click", () => { void bootstrap(); });
  const retry = root.querySelector("[data-retry]");
  if (retry) retry.addEventListener("click", async () => {
    retry.disabled = true;
    retry.textContent = "Проверяю…";
    await loadSession();
  });
  const logout = root.querySelector("[data-logout]");
  if (logout) logout.addEventListener("click", async () => {
    if (isDiscordActivity) { clearActivitySession(); session = null; activityState = "connecting"; render(); void bootstrap(); return; }
    logout.disabled = true;
    try {
      const result = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      if (!result.ok) throw new Error("logout failed");
      session = null;
      render();
    } catch {
      logout.disabled = false;
      logout.textContent = "Ошибка выхода. Повтори попытку.";
    }
  });

}
async function bootstrap() {
  if (isDiscordActivity) {
    activityState = "connecting";
    activityError = "";
    render();
    try {
      await connectDiscordActivity();
      activityState = "ready";
      await loadSession();
    } catch {
      activityState = "error";
      activityError = "Не удалось авторизоваться внутри Discord. Проверь настройки Activities и повтори попытку.";
      render();
    }
    return;
  }
  await loadSession();
}
render();
void bootstrap();
