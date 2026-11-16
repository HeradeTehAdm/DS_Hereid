"use strict";

// Данные достижений. Чистые данные без зависимостей, чтобы экономика и достижения не ссылались друг на друга.
// metric — что считаем у участника, target — порог. badge — эксклюзивный значок-награда (купить его нельзя).
const H = 3600;
const ACHIEVEMENT_DEFS = Object.freeze([
  // Сообщения
  { id: "first_message", name: "Первое слово", badge: "💬", rarity: "Обычный", metric: "messages", target: 1, description: "Отправить первое подходящее сообщение" },
  { id: "messages_10", name: "Разговор пошёл", badge: "📢", rarity: "Обычный", metric: "messages", target: 10, description: "Отправить 10 сообщений" },
  { id: "messages_100", name: "Свой человек", badge: "🤝", rarity: "Редкий", metric: "messages", target: 100, description: "Отправить 100 сообщений" },
  { id: "messages_1000", name: "Душа компании", badge: "🔊", rarity: "Эпический", metric: "messages", target: 1000, description: "Отправить 1 000 сообщений" },
  { id: "messages_5000", name: "Голос сервера", badge: "📯", rarity: "Мифический", metric: "messages", target: 5000, description: "Отправить 5 000 сообщений" },
  // Активность
  { id: "active_7", name: "На связи", badge: "📅", rarity: "Обычный", metric: "activeDays", target: 7, description: "Быть активным 7 дней" },
  { id: "active_30", name: "Постоянный участник", badge: "📆", rarity: "Редкий", metric: "activeDays", target: 30, description: "Быть активным 30 дней" },
  { id: "active_100", name: "Сто дней вместе", badge: "🌳", rarity: "Легендарный", metric: "activeDays", target: 100, description: "Быть активным 100 дней" },
  // Голос
  { id: "voice_1h", name: "Голос знаком", badge: "📻", rarity: "Обычный", metric: "voiceSeconds", target: H, description: "Провести час в голосовых каналах" },
  { id: "voice_10h", name: "Голосовой ветеран", badge: "🎤", rarity: "Эпический", metric: "voiceSeconds", target: 10 * H, description: "Провести 10 часов в голосовых каналах" },
  { id: "voice_100h", name: "Живая легенда эфира", badge: "🎹", rarity: "Легендарный", metric: "voiceSeconds", target: 100 * H, description: "Провести 100 часов в голосовых каналах" },
  // Уровень
  { id: "level_5", name: "Первые вершины", badge: "📈", rarity: "Редкий", metric: "level", target: 5, description: "Достичь 5-го уровня" },
  { id: "level_10", name: "Опытный", badge: "🎓", rarity: "Эпический", metric: "level", target: 10, description: "Достичь 10-го уровня" },
  { id: "level_25", name: "Мастер уровней", badge: "🧠", rarity: "Легендарный", metric: "level", target: 25, description: "Достичь 25-го уровня" },
  // Время на сервере
  { id: "server_30", name: "Уже освоился", badge: "🏡", rarity: "Редкий", metric: "days", target: 30, description: "Провести на сервере 30 дней" },
  { id: "server_180", name: "Легенда сообщества", badge: "🏛", rarity: "Легендарный", metric: "days", target: 180, description: "Провести на сервере 180 дней" },
  { id: "server_365", name: "Год в Herade", badge: "🗽", rarity: "Мифический", metric: "days", target: 365, description: "Провести на сервере 365 дней" },
  // Магазин и коллекция
  { id: "first_purchase", name: "Первая покупка", badge: "🛒", rarity: "Обычный", metric: "purchases", target: 1, description: "Купить первый предмет в магазине" },
  { id: "collector_10", name: "Коллекционер", badge: "🎒", rarity: "Редкий", metric: "collection", target: 10, description: "Собрать 10 предметов" },
  { id: "collector_50", name: "Хранитель коллекции", badge: "🧩", rarity: "Эпический", metric: "collection", target: 50, description: "Собрать 50 предметов" },
  { id: "collector_150", name: "Музей Herade", badge: "🗂", rarity: "Легендарный", metric: "collection", target: 150, description: "Собрать 150 предметов" },
  { id: "all_rarities", name: "Радуга редкостей", badge: "🔆", rarity: "Легендарный", metric: "raritiesOwned", target: 5, description: "Иметь предметы всех пяти редкостей" },
  // Монеты
  { id: "rich_10000", name: "Состоятельный", badge: "💵", rarity: "Эпический", metric: "balance", target: 10000, description: "Накопить 10 000 монет" },
  { id: "rich_100000", name: "Магнат", badge: "💹", rarity: "Мифический", metric: "balance", target: 100000, description: "Накопить 100 000 монет" },
  { id: "quests_30", name: "Трудяга", badge: "📋", rarity: "Редкий", metric: "questsDone", target: 30, description: "Выполнить 30 ежедневных заданий" },
  { id: "promo_first", name: "Кодовое слово", badge: "🎟", rarity: "Обычный", metric: "promos", target: 1, description: "Активировать промокод" },
  // Казино
  { id: "casino_first", name: "Рискнул", badge: "🎱", rarity: "Обычный", metric: "casinoGames", target: 1, description: "Сыграть в казино первый раз" },
  { id: "casino_100", name: "Азартный игрок", badge: "🎳", rarity: "Эпический", metric: "casinoGames", target: 100, description: "Сыграть в казино 100 раз" },
  { id: "casino_bigwin", name: "Крупный выигрыш", badge: "🥇", rarity: "Редкий", metric: "casinoBestWin", target: 10000, description: "Выиграть за одну игру 10 000 монет и больше" },
  { id: "casino_jackpot", name: "Джекпот", badge: "💯", rarity: "Легендарный", metric: "casinoBestWin", target: 100000, description: "Выиграть за одну игру 100 000 монет и больше" },
  // Подарки и обмен
  { id: "gifts_1", name: "Щедрая душа", badge: "🧧", rarity: "Обычный", metric: "gifts", target: 1, description: "Подарить предмет другому участнику" },
  { id: "gifts_10", name: "Дед Мороз", badge: "🎅", rarity: "Эпический", metric: "gifts", target: 10, description: "Подарить 10 предметов" },
  { id: "trades_1", name: "Первая сделка", badge: "🔄", rarity: "Редкий", metric: "trades", target: 1, description: "Завершить первый обмен с участником" },
  { id: "trades_10", name: "Торговец", badge: "💱", rarity: "Эпический", metric: "trades", target: 10, description: "Завершить 10 обменов" },
  // Мета
  { id: "ach_10", name: "Охотник за наградами", badge: "🥈", rarity: "Эпический", metric: "unlocked", target: 10, description: "Открыть 10 других достижений" },
  { id: "ach_all", name: "Легенда достижений", badge: "🎖", rarity: "Мифический", metric: "unlocked", target: 35, description: "Открыть все остальные достижения" },
].map((d) => Object.freeze({ ...d, emoji: d.badge })));

const EXCLUSIVE_BADGES = Object.freeze(ACHIEVEMENT_DEFS.map((d) => Object.freeze({
  id: `ach_${d.id}`,
  name: `Значок «${d.name}»`,
  category: "Достижения",
  description: `Эксклюзивный значок за достижение «${d.name}». Купить или передать его нельзя.`,
  price: 0,
  type: "badge",
  value: d.badge,
  rarity: d.rarity,
  exclusive: true,
  achievementId: d.id,
})));

module.exports = { ACHIEVEMENT_DEFS, EXCLUSIVE_BADGES };
