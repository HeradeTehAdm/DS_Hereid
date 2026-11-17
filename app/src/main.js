import "./style.css";

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
];

const root = document.getElementById("app");
let current = "home";
let session = null;

const safe = (text) => String(text ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const num = (value) => Number(value || 0).toLocaleString("ru-RU");

async function loadSession() {
  try {
    const response = await fetch("/api/me", { credentials: "same-origin", headers: { "Accept": "application/json" } });
    if (response.ok) session = await response.json();
    else session = null;
  } catch { session = null; }
  render();
}

function profileContent() {
  if (!session?.profile) return '<div class="empty"><div class="empty-symbol">' + svg("user", 38) + '</div><h3>Твой профиль появится здесь</h3><p>Подключение Discord и защищённая синхронизация с ботом находятся в разработке. Данные других участников не отображаются без авторизации.</p><span class="tag">Скоро</span></div>';
  const p = session.profile;
  const level = Math.max(0, Number(p.level || 0));
  const xp = Math.max(0, Number(p.xp || 0));
  const base = 100 * level * level;
  const span = 100 * ((level + 1) ** 2 - level ** 2);
  const progress = Math.max(0, Math.min(100, (xp - base) / span * 100));
  return '<div class="profile-card"><div class="profile-avatar">' + safe((p.displayName || "?").slice(0, 1)) + '</div><div><span class="eyebrow">ПРОФИЛЬ УЧАСТНИКА</span><h2>' + safe(p.displayName || "Участник") + '</h2><p>' + safe(p.title || "Участник сообщества") + '</p></div></div><div class="stat-grid"><div class="stat"><span>УРОВЕНЬ</span><strong>' + num(level) + '</strong></div><div class="stat"><span>ОПЫТ</span><strong>' + num(xp) + ' XP</strong></div><div class="stat"><span>МОНЕТЫ</span><strong>' + num(p.balance) + '</strong></div></div><div class="progress-label"><span>До следующего уровня</span><span>' + Math.round(progress) + '%</span></div><div class="progress"><span style="width:' + progress + '%"></span></div>';
}

function content() {
  if (current === "profile") return '<section class="heading"><span class="eyebrow">МОЙ МИР</span><h1>Профиль <em>участника</em></h1><p>Твоя история и достижения в одном месте.</p></section>' + profileContent();
  if (current === "achievements") return '<section class="heading"><span class="eyebrow">КОЛЛЕКЦИЯ</span><h1>Твои <em>награды</em></h1><p>Особенные моменты заслуживают признания.</p></section><div class="empty"><div class="empty-symbol">' + svg("trophy", 40) + '</div><h3>Достижения скоро появятся</h3><p>Они будут синхронизироваться с наградами Discord-бота.</p><span class="tag">В разработке</span></div>';
  return '<section class="hero"><div class="halo"></div><span class="eyebrow">WELCOME TO YOUR SPACE</span><div class="hero-icon">' + svg("bird", 54) + '</div><h1>ДУХ<br><em>СВОБОДЫ</em></h1><p>Одно сообщество. Тысячи возможностей.<br>Твоя история начинается здесь.</p><button class="primary" data-go="profile">Мой профиль ' + svg("arrow", 20) + '</button><span class="hero-foot">✦ MADE FOR THE COMMUNITY ✦</span></section><div class="section-title"><h2>Исследуй мир</h2><span>01 / 03</span></div><div class="feature-grid"><button class="feature" data-go="profile"><span class="feature-icon purple">' + svg("user", 29) + '</span><strong>Мой профиль</strong><small>Твой уровень, опыт и стиль</small><span class="feature-next">' + svg("arrow", 19) + '</span></button><button class="feature" data-go="achievements"><span class="feature-icon blue">' + svg("trophy", 29) + '</span><strong>Достижения</strong><small>Коллекция твоих побед</small><span class="feature-next">' + svg("arrow", 19) + '</span></button></div>';
}

function render() {
  root.innerHTML = '<div class="shell"><aside class="sidebar"><div class="brand"><div class="brand-mark">' + svg("bird", 25) + '</div><div><strong>ДУХ СВОБОДЫ</strong><small>COMMUNITY APP</small></div></div><nav aria-label="Разделы">' + sections.map(x => '<button data-go="' + x.id + '" class="nav-link ' + (current === x.id ? "active" : "") + '" aria-current="' + (current === x.id ? "page" : "false") + '">' + svg(x.icon, 21) + '<span>' + x.label + '</span></button>').join("") + '</nav><div class="side-foot"><span class="status-dot"></span><span>Ранняя версия приложения</span></div></aside><div class="workspace"><header class="topbar"><div class="topbrand"><span>' + svg("bird", 21) + '</span> ДУХ СВОБОДЫ</div><span class="top-status"><span class="status-dot"></span> APP PREVIEW</span></header><main id="content">' + content() + '</main><footer>ДУХ СВОБОДЫ © 2026 <span>СОЗДАНО ДЛЯ СООБЩЕСТВА</span></footer></div><nav class="bottom-nav" aria-label="Мобильная навигация">' + sections.map(x => '<button data-go="' + x.id + '" class="' + (current === x.id ? "active" : "") + '">' + svg(x.icon, 22) + '<span>' + x.label + '</span></button>').join("") + '</nav></div>';
  for (const button of root.querySelectorAll("[data-go]")) button.addEventListener("click", () => {
    current = button.dataset.go;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}
render();
loadSession();
