import "./style.css";
import "./cosmetic-profile.css";
import { renderCosmeticProfile, renderCosmeticsGallery } from "./cosmetic-profile.js";
import { isDiscordActivity, activityApiPath, activityAuthHeaders, connectDiscordActivity, clearActivitySession } from "./discord-activity.js";

const svg = (name, size = 22) => {
  const shapes = {
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
  { id: "inventory", label: "Коллекция", icon: "spark" },
  { id: "cosmetics", label: "Косметика", icon: "spark" },
  { id: "shop", label: "Магазин", icon: "spark" },
  { id: "quests", label: "Задания", icon: "trophy" },
  { id: "promos", label: "Промокоды", icon: "spark" },
  { id: "history", label: "История", icon: "spark" },
];

const root = document.getElementById("app");
let current = "home";
let session = null;
let refreshTimer = null;
let activityState = isDiscordActivity ? "connecting" : "browser";
let activityError = "";
let equipPending = false;
let equipFeedback = "";

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
    refreshTimer = setTimeout(() => { void loadSession(); }, 15000);
  }
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
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 3000));
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

function profileContent() {
  if (isDiscordActivity && activityState !== "ready") return '<div class="empty"><h3>' + safe(activityState === "error" ? "Ошибка входа" : "Входим через Discord") + '</h3><p>' + safe(activityError || "Подключаем приложение к твоей учётной записи Discord…") + '</p>' + (activityState === "error" ? '<button class="logout" data-activity-retry>Повторить попытку</button>' : '') + '</div>';
  if (!session?.identity) return '<div class="empty"><div class="empty-symbol">' + svg("user", 38) + '</div><h3>Войди через Discord</h3><p>Чтобы открыть личный профиль, сначала подтверди свою учётную запись Discord.</p><a class="primary login-button" href="/api/auth/login">Войти через Discord ' + svg("arrow", 20) + '</a></div>';
if (!session?.profile) return '<div class="profile-card"><div class="profile-avatar">' + safe((session.identity.displayName || "?").slice(0, 1)) + '</div><div><span class="eyebrow">DISCORD ПОДКЛЮЧЁН</span><h2>' + safe(session.identity.displayName) + '</h2><p>@' + safe(session.identity.username) + '</p></div></div><div class="empty"><div class="empty-symbol">' + svg("spark", 34) + '</div><h3>Аккаунт подключён!</h3><p>Ты успешно авторизован через Discord. Уровень, XP и награды появятся после подключения. Проверь статус синхронизации и повтори запрос.</p><span class="tag">Синхронизация профиля — следующий этап</span><div><button class="logout" data-retry>Проверить соединение</button> <button class="logout" data-logout>Выйти из аккаунта</button></div></div>';
  return renderCosmeticProfile(session);
}

function syncPage(title, description, body) {
  const heading = '<section class="heading"><span class="eyebrow">ДАННЫЕ ИЗ DISCORD</span><h1>' + safe(title) + '</h1><p>' + safe(description) + '</p></section>';
  if (isDiscordActivity && activityState !== "ready") return heading + '<div class="empty"><h3>Подключаем Discord</h3><p>' + safe(activityError || "Проверяем учётную запись…") + '</p></div>';
  if (!session?.identity) return heading + '<div class="empty"><h3>Войди через Discord</h3><p>Нужна авторизация для просмотра своих данных.</p><a class="primary login-button" href="/api/auth/login">Войти через Discord</a></div>';
  if (!session.profile) return heading + '<div class="empty"><h3>Ожидается соединение с ботом</h3><p>Профильное API временно недоступно или ещё не подключено.</p></div>';
  return heading + body;
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
  if (current === "inventory" || current === "cosmetics") return syncPage("Моя коллекция", "Все предметы и оформление из Discord.", renderCosmeticsGallery(session));
  if (current === "shop") return syncPage("Магазин", "Каталог бота. Покупки пока доступны через команду /shop в Discord.",
    itemCards(p?.catalog, "Каталог пока недоступен"));
  if (current === "quests") return syncPage("Ежедневные задания", "Текущий прогресс заданий из Discord.",
    p?.quests?.length ? '<div class="feature-grid">' + p.quests.map(q =>
      '<div class="feature"><strong>' + safe(q.name) + '</strong><small>' + safe(q.description) +
      '</small><span class="tag">' + num(q.progress) + '/' + num(q.target) +
      ' · ' + (q.completed ? 'Выполнено' : 'В процессе') +
      ' · +' + num(q.reward) + ' 🪙</span></div>').join("") + '</div>' :
      '<div class="empty"><h3>Пока нет заданий</h3></div>');
  if (current === "promos") return syncPage("Мои промокоды", "Показываем только уже использованные тобой промокоды. Активируй новые через /promo в Discord.",
    p?.redeemedPromos?.length ? '<div class="feature-grid">' + p.redeemedPromos.map(x =>
      '<div class="feature"><strong>' + safe(x.code) + '</strong><small>Промокод активирован</small></div>').join("") +
      '</div>' : '<div class="empty"><h3>Использованных промокодов пока нет</h3><p>Доступные коды публикуются администрацией Discord-сервера.</p></div>');
  if (current === "history") return syncPage("История монет", "Твои последние операции. Источник — база Discord-бота.",
    p?.transactions?.length ? '<div class="feature-grid">' + p.transactions.map(t =>
      '<div class="feature"><strong>' + (t.amount >= 0 ? '+' : '') + num(t.amount) +
      ' 🪙</strong><small>' + safe(t.details || t.kind) + '</small><span class="tag">' +
      safe(t.kind) + '</span></div>').join("") + '</div>' :
      '<div class="empty"><h3>Пока нет операций</h3></div>');
  return "";
}

function content() {
  if (["inventory", "cosmetics", "shop", "quests", "promos", "history"].includes(current)) return extendedContent();
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
  return '<section class="hero"><div class="halo"></div><span class="eyebrow">WELCOME TO YOUR SPACE</span><div class="hero-icon">' + svg("bird", 54) + '</div><h1>ДУХ<br><em>СВОБОДЫ</em></h1><p>Одно сообщество. Тысячи возможностей.<br>Твоя история начинается здесь.</p><button class="primary" data-go="profile">Мой профиль ' + svg("arrow", 20) + '</button><span class="hero-foot">✦ MADE FOR THE COMMUNITY ✦</span></section><div class="section-title"><h2>Исследуй мир</h2><span>01 / 03</span></div><div class="feature-grid"><button class="feature" data-go="profile"><span class="feature-icon purple">' + svg("user", 29) + '</span><strong>Мой профиль</strong><small>Твой уровень, опыт и стиль</small><span class="feature-next">' + svg("arrow", 19) + '</span></button><button class="feature" data-go="achievements"><span class="feature-icon blue">' + svg("trophy", 29) + '</span><strong>Достижения</strong><small>Коллекция твоих побед</small><span class="feature-next">' + svg("arrow", 19) + '</span></button></div>';
}

function render() {
  root.innerHTML = '<div class="shell"><aside class="sidebar"><div class="brand"><div class="brand-mark">' + svg("bird", 25) + '</div><div><strong>ДУХ СВОБОДЫ</strong><small>COMMUNITY APP</small></div></div><nav aria-label="Разделы">' + sections.map(x => '<button data-go="' + x.id + '" class="nav-link ' + (current === x.id ? "active" : "") + '" aria-current="' + (current === x.id ? "page" : "false") + '">' + svg(x.icon, 21) + '<span>' + x.label + '</span></button>').join("") + '</nav><div class="side-foot"><span class="status-dot"></span><span>Ранняя версия приложения</span></div></aside><div class="workspace"><header class="topbar"><div class="topbrand"><span>' + svg("bird", 21) + '</span> ДУХ СВОБОДЫ</div><span class="top-status"><span class="status-dot"></span> ' + safe(syncStateLabel()) + '</span></header><main id="content">' + (equipFeedback ? '<div role="status" class="cos-toast">' + safe(equipFeedback) + '</div>' : '') + content() + '</main><footer>ДУХ СВОБОДЫ © 2026 <span>СОЗДАНО ДЛЯ СООБЩЕСТВА</span></footer></div><nav class="bottom-nav" aria-label="Мобильная навигация">' + sections.map(x => '<button data-go="' + x.id + '" class="' + (current === x.id ? "active" : "") + '">' + svg(x.icon, 22) + '<span>' + x.label + '</span></button>').join("") + '</nav></div>';
  for (const button of root.querySelectorAll("[data-equip-id]")) {
    button.disabled = equipPending;
    button.addEventListener("click", () => { void handleEquip(button.dataset.equipId); });
  }
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
  for (const button of root.querySelectorAll("[data-go]")) button.addEventListener("click", () => {
    current = button.dataset.go;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
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
