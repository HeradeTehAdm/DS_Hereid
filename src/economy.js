const db = require("./database");

const DAILY_REWARD = 100;
const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const DAILY_QUESTS = Object.freeze([
  { key: "messages", name: "Активное общение", description: "Получи XP за 5 подходящих сообщений", target: 5, reward: 25 },
  { key: "daily", name: "Забери ежедневную награду", description: "Используй /daily", target: 1, reward: 10 },
  { key: "purchase", name: "Первая покупка дня", description: "Купи любой предмет в /shop", target: 1, reward: 20 },
]);
const CATALOG = Object.freeze([
  // Титулы
  { id: "title_newcomer", name: "Титул «Новичок»", category: "Титулы", description: "Небольшой титул для профиля.", price: 150, type: "title", value: "Новичок" },
  { id: "title_friend", name: "Титул «Свой человек»", category: "Титулы", description: "Для тех, кто уже освоился на сервере.", price: 300, type: "title", value: "Свой человек" },
  { id: "title_regular", name: "Титул «Постоянный»", category: "Титулы", description: "Покажи, что ты часть сообщества.", price: 450, type: "title", value: "Постоянный" },
  { id: "title_veteran", name: "Титул «Ветеран»", category: "Титулы", description: "Титул для коллекции профиля.", price: 650, type: "title", value: "Ветеран" },
  { id: "title_creator", name: "Титул «Создатель»", category: "Титулы", description: "Для участников с творческим подходом.", price: 850, type: "title", value: "Создатель" },
  { id: "title_elite", name: "Титул «Элита»", category: "Титулы", description: "Статусный титул для профиля.", price: 1200, type: "title", value: "Элита" },
  { id: "title_legend", name: "Титул «Легенда»", category: "Титулы", description: "Редкий косметический титул.", price: 1500, type: "title", value: "Легенда" },
  { id: "title_mythic", name: "Титул «Мифический»", category: "Титулы", description: "Один из самых дорогих титулов магазина.", price: 2500, type: "title", value: "Мифический" },
  { id: "title_night_owl", name: "Титул «Ночной житель»", category: "Титулы", description: "Для тех, кто оживает после заката.", price: 350, type: "title", value: "Ночной житель" },
  { id: "title_soul_of_server", name: "Титул «Душа сервера»", category: "Титулы", description: "Тёплый титул для важной части сообщества.", price: 700, type: "title", value: "Душа сервера" },
  { id: "title_talker", name: "Титул «Болтун»", category: "Титулы", description: "Для тех, у кого всегда найдётся тема.", price: 400, type: "title", value: "Болтун" },
  { id: "title_silent", name: "Титул «Тихий наблюдатель»", category: "Титулы", description: "Мало слов — много присутствия.", price: 500, type: "title", value: "Тихий наблюдатель" },
  { id: "title_memelord", name: "Титул «Повелитель мемов»", category: "Титулы", description: "Для главного поставщика мемов.", price: 850, type: "title", value: "Повелитель мемов" },
  { id: "title_chaos", name: "Титул «Агент хаоса»", category: "Титулы", description: "Немного хаоса никогда не помешает.", price: 900, type: "title", value: "Агент хаоса" },
  { id: "title_peacemaker", name: "Титул «Миротворец»", category: "Титулы", description: "За спокойствие и дружелюбную атмосферу.", price: 950, type: "title", value: "Миротворец" },
  { id: "title_ghost", name: "Титул «Призрак чата»", category: "Титулы", description: "Появляется неожиданно и исчезает бесследно.", price: 1000, type: "title", value: "Призрак чата" },
  { id: "title_vip", name: "Титул «VIP»", category: "Титулы", description: "Лаконичный статус для профиля.", price: 1100, type: "title", value: "VIP" },
  { id: "title_architect", name: "Титул «Архитектор»", category: "Титулы", description: "Для тех, кто помогает строить сообщество.", price: 1250, type: "title", value: "Архитектор" },
  { id: "title_guardian", name: "Титул «Страж свободы»", category: "Титулы", description: "В духе HeradeLegend и свободы общения.", price: 1400, type: "title", value: "Страж свободы" },
  { id: "title_phoenix", name: "Титул «Феникс»", category: "Титулы", description: "Символ возвращения и нового начала.", price: 1450, type: "title", value: "Феникс" },
  { id: "title_storm", name: "Титул «Гроза чата»", category: "Титулы", description: "Яркое имя для активного участника.", price: 1550, type: "title", value: "Гроза чата" },
  { id: "title_oracle", name: "Титул «Оракул»", category: "Титулы", description: "Для того, кто всегда знает ответ.", price: 1650, type: "title", value: "Оракул" },
  { id: "title_shadow", name: "Титул «Тень»", category: "Титулы", description: "Тёмный и загадочный стиль.", price: 1750, type: "title", value: "Тень" },
  { id: "title_stargazer", name: "Титул «Покоритель звёзд»", category: "Титулы", description: "Для мечтателей с космическими амбициями.", price: 1900, type: "title", value: "Покоритель звёзд" },
  { id: "title_immortal", name: "Титул «Бессмертный»", category: "Титулы", description: "Редкий титул для коллекции.", price: 2200, type: "title", value: "Бессмертный" },
  { id: "title_herade", name: "Титул «Herade»", category: "Титулы", description: "Фирменный титул сообщества.", price: 2500, type: "title", value: "Herade" },
  { id: "title_free_spirit", name: "Титул «Свободный дух»", category: "Титулы", description: "Для тех, кто ценит свободу и индивидуальность.", price: 2800, type: "title", value: "Свободный дух" },
  { id: "title_eternal_legend", name: "Титул «Вечная легенда»", category: "Титулы", description: "Премиальный титул верхнего уровня.", price: 4000, type: "title", value: "Вечная легенда" },

  { id: "title_abyss_walker", name: "Титул «Странник бездны»", category: "Титулы", description: "Для исследователей тёмных глубин.", price: 2100, type: "title", value: "Странник бездны" },
  { id: "title_cyber_ghost", name: "Титул «Кибер-призрак»", category: "Титулы", description: "Неоновый след в цифровом мире.", price: 1850, type: "title", value: "Кибер-призрак" },
  { id: "title_frostborn", name: "Титул «Рождённый льдом»", category: "Титулы", description: "Холодный характер и стальной настрой.", price: 1750, type: "title", value: "Рождённый льдом" },
  { id: "title_sun_chaser", name: "Титул «Охотник за солнцем»", category: "Титулы", description: "Всегда движется к новым горизонтам.", price: 1300, type: "title", value: "Охотник за солнцем" },
  { id: "title_lone_wolf", name: "Титул «Одинокий волк»", category: "Титулы", description: "Самостоятельность — его стиль.", price: 1200, type: "title", value: "Одинокий волк" },
  { id: "title_chat_champion", name: "Титул «Чемпион чата»", category: "Титулы", description: "Для заметного участника бесед.", price: 1350, type: "title", value: "Чемпион чата" },
  { id: "title_lore_keeper", name: "Титул «Хранитель истории»", category: "Титулы", description: "Помнит важные моменты сообщества.", price: 1600, type: "title", value: "Хранитель истории" },
  { id: "title_moon_emperor", name: "Титул «Лунный император»", category: "Титулы", description: "Редкий титул с ночной атмосферой.", price: 2600, type: "title", value: "Лунный император" },
  { id: "title_starborn", name: "Титул «Дитя звёзд»", category: "Титулы", description: "Космический стиль для профиля.", price: 2300, type: "title", value: "Дитя звёзд" },
  { id: "title_dragon_heart", name: "Титул «Сердце дракона»", category: "Титулы", description: "Символ смелости и упорства.", price: 2700, type: "title", value: "Сердце дракона" },
  { id: "title_royal_blood", name: "Титул «Королевская кровь»", category: "Титулы", description: "Для коллекционеров статусных титулов.", price: 3200, type: "title", value: "Королевская кровь" },
  { id: "title_void_master", name: "Титул «Повелитель пустоты»", category: "Титулы", description: "Мрачный титул высокого уровня.", price: 3300, type: "title", value: "Повелитель пустоты" },
  { id: "title_herade_original", name: "Титул «Оригинал Herade»", category: "Титулы", description: "Фирменный знак старожилов сообщества.", price: 3000, type: "title", value: "Оригинал Herade" },
  { id: "title_freedom_icon", name: "Титул «Икона свободы»", category: "Титулы", description: "Воплощение духа свободы HeradeLegend.", price: 3600, type: "title", value: "Икона свободы" },
  { id: "title_legendary_founder", name: "Титул «Легендарный основатель»", category: "Титулы", description: "Премиальный титул для настоящей легенды.", price: 5000, type: "title", value: "Легендарный основатель" },
  { id: "title_eternal_guard", name: "Титул «Вечный страж»", category: "Титулы", description: "Символ верности и защиты сообщества.", price: 3900, type: "title", value: "Вечный страж" },
  { id: "title_glitch_king", name: "Титул «Король глитча»", category: "Титулы", description: "Для любителей цифрового хаоса.", price: 2450, type: "title", value: "Король глитча" },
  { id: "title_emerald_soul", name: "Титул «Изумрудная душа»", category: "Титулы", description: "Редкий природный стиль.", price: 1950, type: "title", value: "Изумрудная душа" },
  { id: "title_silent_storm", name: "Титул «Тихая буря»", category: "Титулы", description: "Спокойствие, за которым скрывается сила.", price: 2050, type: "title", value: "Тихая буря" },
  { id: "title_ultimate_herade", name: "Титул «Абсолют Herade»", category: "Титулы", description: "Эксклюзивный титул верхней ценовой категории.", price: 6500, type: "title", value: "Абсолют Herade" },

  // Новая линейка титулов: редкость и цены согласованы для магазина.
  { id: "title_joker", name: "Титул «Шутник»", category: "Титулы", description: "Для тех, кто умеет поднять настроение.", price: 150, type: "title", value: "Шутник", rarity: "Обычный" },
  { id: "title_gamer", name: "Титул «Игрок»", category: "Титулы", description: "Для любителей игр и соревнований.", price: 200, type: "title", value: "Игрок", rarity: "Обычный" },
  { id: "title_wanderer", name: "Титул «Странник»", category: "Титулы", description: "Сам выбирает путь и направление.", price: 250, type: "title", value: "Странник", rarity: "Обычный" },
  { id: "title_spark", name: "Титул «Искра»", category: "Титулы", description: "Небольшой титул с ярким характером.", price: 300, type: "title", value: "Искра", rarity: "Обычный" },
  { id: "title_moonlit", name: "Титул «Лунный»", category: "Титулы", description: "Для ценителей ночной атмосферы.", price: 350, type: "title", value: "Лунный", rarity: "Обычный" },
  { id: "title_fox", name: "Титул «Хитрый лис»", category: "Титулы", description: "Находчивость — его главное преимущество.", price: 400, type: "title", value: "Хитрый лис", rarity: "Обычный" },
  { id: "title_enigma", name: "Титул «Загадка»", category: "Титулы", description: "Не всё о нём известно с первого взгляда.", price: 500, type: "title", value: "Загадка", rarity: "Обычный" },

  { id: "title_iceborn", name: "Титул «Ледяной»", category: "Титулы", description: "Холодная выдержка и спокойствие.", price: 750, type: "title", value: "Ледяной", rarity: "Редкий" },
  { id: "title_eagle", name: "Титул «Орёл»", category: "Титулы", description: "Символ свободы и дальнего взгляда.", price: 850, type: "title", value: "Орёл", rarity: "Редкий" },
  { id: "title_diamond", name: "Титул «Алмаз»", category: "Титулы", description: "Редкий блеск в коллекции профиля.", price: 950, type: "title", value: "Алмаз", rarity: "Редкий" },
  { id: "title_cosmic_wanderer", name: "Титул «Космический странник»", category: "Титулы", description: "Путешественник среди звёзд.", price: 1100, type: "title", value: "Космический странник", rarity: "Редкий" },
  { id: "title_sharpshooter", name: "Титул «Меткий»", category: "Титулы", description: "Всегда попадает точно в цель.", price: 1250, type: "title", value: "Меткий", rarity: "Редкий" },
  { id: "title_observer", name: "Титул «Наблюдатель»", category: "Титулы", description: "Замечает то, что другие пропускают.", price: 1500, type: "title", value: "Наблюдатель", rarity: "Редкий" },

  { id: "title_warrior", name: "Титул «Воин»", category: "Титулы", description: "Для тех, кто не отступает перед вызовами.", price: 2000, type: "title", value: "Воин", rarity: "Эпический" },
  { id: "title_dark_mage", name: "Титул «Тёмный маг»", category: "Титулы", description: "Мрачная эстетика и загадочная сила.", price: 2300, type: "title", value: "Тёмный маг", rarity: "Эпический" },
  { id: "title_stellar", name: "Титул «Звёздный»", category: "Титулы", description: "Для тех, кто стремится выше горизонта.", price: 2600, type: "title", value: "Звёздный", rarity: "Эпический" },
  { id: "title_dragon", name: "Титул «Дракон»", category: "Титулы", description: "Мощный символ силы и характера.", price: 3000, type: "title", value: "Дракон", rarity: "Эпический" },
  { id: "title_overlord", name: "Титул «Повелитель»", category: "Титулы", description: "Статусный титул высокой редкости.", price: 3500, type: "title", value: "Повелитель", rarity: "Эпический" },
  { id: "title_dimension_keeper", name: "Титул «Хранитель измерений»", category: "Титулы", description: "Хранитель границ между мирами.", price: 4000, type: "title", value: "Хранитель измерений", rarity: "Эпический" },

  { id: "title_emperor", name: "Титул «Император»", category: "Титулы", description: "Королевский титул для коллекции.", price: 6000, type: "title", value: "Император", rarity: "Легендарный" },
  { id: "title_abyss_lord", name: "Титул «Владыка Бездны»", category: "Титулы", description: "Легендарный титул с тёмной атмосферой.", price: 7000, type: "title", value: "Владыка Бездны", rarity: "Легендарный" },
  { id: "title_freedom_spirit", name: "Титул «Дух Свободы»", category: "Титулы", description: "Фирменный титул HERADE HOUSE 2.0.", price: 8500, type: "title", value: "Дух Свободы", rarity: "Легендарный" },
  { id: "title_absolute", name: "Титул «Абсолют»", category: "Титулы", description: "Вершина легендарной коллекции.", price: 10000, type: "title", value: "Абсолют", rarity: "Легендарный" },

  { id: "title_heavenly_archon", name: "Титул «Небесный архонт»", category: "Титулы", description: "Мифический титул небесной коллекции.", price: 15000, type: "title", value: "Небесный архонт", rarity: "Мифический" },
  { id: "title_beyond_reality", name: "Титул «Вне реальности»", category: "Титулы", description: "Для тех, кто выходит за пределы привычного.", price: 22000, type: "title", value: "Вне реальности", rarity: "Мифический" },
  { id: "title_absolute_legend", name: "Титул «Абсолютная легенда»", category: "Титулы", description: "Один из самых редких титулов магазина.", price: 25000, type: "title", value: "Абсолютная легенда", rarity: "Мифический" },
  { id: "title_world_creator", name: "Титул «Создатель миров»", category: "Титулы", description: "Главный мифический титул каталога.", price: 30000, type: "title", value: "Создатель миров", rarity: "Мифический" },

  // Значки
  { id: "badge_star", name: "Значок «Звезда»", category: "Значки", description: "Значок рядом с оформлением профиля.", price: 300, type: "badge", value: "⭐" },
  { id: "badge_spark", name: "Значок «Искра»", category: "Значки", description: "Яркий значок для профиля.", price: 450, type: "badge", value: "✨" },
  { id: "badge_fire", name: "Значок «Огонь»", category: "Значки", description: "Для активного участника.", price: 500, type: "badge", value: "🔥" },
  { id: "badge_crown", name: "Значок «Корона»", category: "Значки", description: "Королевский акцент в профиле.", price: 800, type: "badge", value: "👑" },
  { id: "badge_diamond", name: "Значок «Алмаз»", category: "Значки", description: "Редкий блестящий значок.", price: 1000, type: "badge", value: "💎" },
  { id: "badge_moon", name: "Значок «Луна»", category: "Значки", description: "Спокойный ночной стиль.", price: 550, type: "badge", value: "🌙" },
  { id: "badge_comet", name: "Значок «Комета»", category: "Значки", description: "Космический значок для профиля.", price: 750, type: "badge", value: "☄️" },
  { id: "badge_heart", name: "Значок «Сердце»", category: "Значки", description: "Небольшая деталь оформления.", price: 350, type: "badge", value: "💜" },

  // Баннеры профиля: индивидуальные художественные темы вместо рамок.
  { id: "banner_ocean", name: "Баннер «Бездна океана»", category: "Баннеры", description: "Глубокая вода, бирюзовые лучи и морская дымка.", price: 900, type: "banner", value: "Океан" },
  { id: "banner_forest", name: "Баннер «Изумрудная чаща»", category: "Баннеры", description: "Изумрудный туман, светлячки и древний лес.", price: 1100, type: "banner", value: "Лес" },
  { id: "banner_sunset", name: "Баннер «Последний закат»", category: "Баннеры", description: "Горизонт в огненных оттенках и мягкое сияние.", price: 1250, type: "banner", value: "Закат" },
  { id: "banner_neon", name: "Баннер «Неоновый импульс»", category: "Баннеры", description: "Киберпанк-линии, электрический свет и глубина.", price: 1800, type: "banner", value: "Неон" },
  { id: "banner_ice", name: "Баннер «Кристальный шторм»", category: "Баннеры", description: "Ледяные кристаллы и холодное северное сияние.", price: 2200, type: "banner", value: "Лёд" },
  { id: "banner_galaxy", name: "Баннер «Рождение галактики»", category: "Баннеры", description: "Космическая туманность, звёздная пыль и орбиты.", price: 2800, type: "banner", value: "Галактика" },
  { id: "banner_shadow", name: "Баннер «Тихая тень»", category: "Баннеры", description: "Графитовая дымка, глубокие тени и серебряные акценты.", price: 3500, type: "banner", value: "Тень" },
  { id: "banner_gold", name: "Баннер «Золотая династия»", category: "Баннеры", description: "Тёмный шёлк, золотая пыль и царственное сияние.", price: 4200, type: "banner", value: "Золото" },
  // Хэллоуин
  { id: "banner_pumpkin", name: "Баннер «Тыквенная ночь»", category: "Баннеры", description: "Полная луна, светящиеся тыквы и старый особняк.", price: 3000, type: "banner", value: "Тыква" },
  { id: "banner_graveyard", name: "Баннер «Проклятое кладбище»", category: "Баннеры", description: "Призраки, болотные огни и густой туман.", price: 3600, type: "banner", value: "Кладбище" },
  // Новые баннеры по редкостям
  { id: "banner_dawn", name: "Баннер «Туманный рассвет»", category: "Баннеры", description: "Мягкий свет и холмы в утренней дымке.", price: 350, type: "banner", value: "Рассвет" },
  { id: "banner_lake", name: "Баннер «Тихое озеро»", category: "Баннеры", description: "Закат отражается в неподвижной воде.", price: 400, type: "banner", value: "Озеро" },
  { id: "banner_dunes", name: "Баннер «Золотые дюны»", category: "Баннеры", description: "Тёплый песок и бескрайний горизонт.", price: 450, type: "banner", value: "Дюны" },
  { id: "banner_sakura", name: "Баннер «Сакура»", category: "Баннеры", description: "Лепестки на ветру под розовой луной.", price: 800, type: "banner", value: "Сакура" },
  { id: "banner_storm", name: "Баннер «Грозовой фронт»", category: "Баннеры", description: "Молнии над штормовым морем.", price: 1000, type: "banner", value: "Гроза" },
  { id: "banner_autumn", name: "Баннер «Осенний лес»", category: "Баннеры", description: "Золотой свет и падающая листва.", price: 1400, type: "banner", value: "Осень" },
  { id: "banner_megacity", name: "Баннер «Ночной мегаполис»", category: "Баннеры", description: "Дождь, неон и бесконечные небоскрёбы.", price: 2000, type: "banner", value: "Мегаполис" },
  { id: "banner_orbit", name: "Баннер «Орбитальный рассвет»", category: "Баннеры", description: "Солнце встаёт над краем планеты.", price: 2600, type: "banner", value: "Орбита" },
  { id: "banner_volcano", name: "Баннер «Гнев вулкана»", category: "Баннеры", description: "Лава, пепел и раскалённое небо.", price: 3300, type: "banner", value: "Вулкан" },
  { id: "banner_skycastle", name: "Баннер «Небесный замок»", category: "Баннеры", description: "Парящие острова над морем облаков.", price: 5000, type: "banner", value: "Замок" },
  { id: "banner_moontemple", name: "Баннер «Лунный храм»", category: "Баннеры", description: "Врата над водой под огромной луной.", price: 6500, type: "banner", value: "Храм" },
  { id: "banner_phoenix", name: "Баннер «Крылья феникса»", category: "Баннеры", description: "Огненное перо, рождённое из пепла.", price: 8500, type: "banner", value: "Феникс" },
  { id: "banner_rift", name: "Баннер «Разрыв реальности»", category: "Баннеры", description: "Портал между мирами, которых не должно быть.", price: 12000, type: "banner", value: "Разрыв" },
  { id: "banner_fractal", name: "Баннер «Фрактальная бездна»", category: "Баннеры", description: "Бесконечность, которая смотрит в ответ.", price: 16000, type: "banner", value: "Фрактал" },
  { id: "banner_worldtree", name: "Баннер «Древо миров»", category: "Баннеры", description: "Корни в бездне, ветви среди звёзд.", price: 22000, type: "banner", value: "Древо" },
  // Ещё баннеры по редкостям
  { id: "banner_lavender", name: "Баннер «Лавандовые поля»", category: "Баннеры", description: "Фиолетовые ряды под тёплым закатом.", price: 380, type: "banner", value: "Лаванда" },
  { id: "banner_camp", name: "Баннер «Ночной лагерь»", category: "Баннеры", description: "Костёр, палатка и Млечный Путь над головой.", price: 420, type: "banner", value: "Лагерь" },
  { id: "banner_harbor", name: "Баннер «Тихая гавань»", category: "Баннеры", description: "Паруса и чайки в лучах утреннего солнца.", price: 480, type: "banner", value: "Гавань" },
  { id: "banner_village", name: "Баннер «Снежная деревня»", category: "Баннеры", description: "Тёплые окна и тихий снегопад.", price: 950, type: "banner", value: "Деревня" },
  { id: "banner_tropic", name: "Баннер «Тропический закат»", category: "Баннеры", description: "Пальмы и солнечная дорожка по воде.", price: 1150, type: "banner", value: "Тропики" },
  { id: "banner_bamboo", name: "Баннер «Бамбуковая роща»", category: "Баннеры", description: "Зелёный полумрак и лучи света.", price: 1300, type: "banner", value: "Бамбук" },
  { id: "banner_aurora", name: "Баннер «Полярная аврора»", category: "Баннеры", description: "Сияние над ночным озером.", price: 2400, type: "banner", value: "Аврора" },
  { id: "banner_ghostship", name: "Баннер «Корабль-призрак»", category: "Баннеры", description: "Рваные паруса в лунном тумане.", price: 3100, type: "banner", value: "Призрак" },
  { id: "banner_steam", name: "Баннер «Паровая эра»", category: "Баннеры", description: "Медные шестерни и жар котлов.", price: 3800, type: "banner", value: "Пар" },
  { id: "banner_ruins", name: "Баннер «Затерянный храм»", category: "Баннеры", description: "Светящиеся руны в сердце джунглей.", price: 5500, type: "banner", value: "Руины" },
  { id: "banner_dragoneye", name: "Баннер «Око дракона»", category: "Баннеры", description: "Взгляд, от которого плавится сталь.", price: 7500, type: "banner", value: "Дракон" },
  { id: "banner_bifrost", name: "Баннер «Радужный мост»", category: "Баннеры", description: "Путь между мирами через звёзды.", price: 9500, type: "banner", value: "Мост" },
  { id: "banner_blackhole", name: "Баннер «Горизонт событий»", category: "Баннеры", description: "Свет, который не смог убежать.", price: 14000, type: "banner", value: "Дыра" },
  { id: "banner_gem", name: "Баннер «Сердце мироздания»", category: "Баннеры", description: "Кристалл, в котором рождается свет.", price: 20000, type: "banner", value: "Кристалл" },
  { id: "banner_clock", name: "Баннер «Часы вечности»", category: "Баннеры", description: "Последняя минута перед полуночью времён.", price: 26000, type: "banner", value: "Часы" },

  // Цвета профиля
  { id: "color_blue", name: "Цвет «Синий»", category: "Цвета", description: "Синий цвет карточки профиля.", price: 250, type: "color", value: "5865F2" },
  { id: "color_purple", name: "Цвет «Фиолетовый»", category: "Цвета", description: "Фиолетовый цвет карточки профиля.", price: 400, type: "color", value: "9B59B6" },
  { id: "color_teal", name: "Цвет «Бирюзовый»", category: "Цвета", description: "Бирюзовый цвет карточки профиля.", price: 550, type: "color", value: "1ABC9C" },
  { id: "color_red", name: "Цвет «Рубиновый»", category: "Цвета", description: "Насыщенный красный оттенок.", price: 450, type: "color", value: "E74C3C" },
  { id: "color_green", name: "Цвет «Изумрудный»", category: "Цвета", description: "Глубокий зелёный оттенок.", price: 450, type: "color", value: "2ECC71" },
  { id: "color_orange", name: "Цвет «Оранжевый»", category: "Цвета", description: "Яркий тёплый оттенок.", price: 350, type: "color", value: "E67E22" },
  { id: "color_gold", name: "Цвет «Золотой»", category: "Цвета", description: "Золотой цвет карточки профиля.", price: 800, type: "color", value: "F1C40F" },
  { id: "color_pink", name: "Цвет «Розовый»", category: "Цвета", description: "Мягкий розовый оттенок.", price: 400, type: "color", value: "FF69B4" },
  { id: "color_silver", name: "Цвет «Серебряный»", category: "Цвета", description: "Сдержанный серебристый оттенок.", price: 700, type: "color", value: "BDC3C7" },
  { id: "color_crimson", name: "Цвет «Багровый»", category: "Цвета", description: "Глубокий багровый оттенок.", price: 650, type: "color", value: "8E244D" },
  // Новые цвета
  { id: "color_graphite", name: "Цвет «Графитовый»", category: "Цвета", description: "Сдержанный тёмный графит. Красит карточку профиля.", price: 300, type: "color", value: "4A5568" },
  { id: "color_sky", name: "Цвет «Небесный»", category: "Цвета", description: "Свежий небесно-голубой. Красит карточку профиля.", price: 350, type: "color", value: "4FC3F7" },
  { id: "color_mint", name: "Цвет «Мятный»", category: "Цвета", description: "Холодная мята. Красит карточку профиля.", price: 350, type: "color", value: "98E6C0" },
  { id: "color_lavender", name: "Цвет «Лавандовый»", category: "Цвета", description: "Нежный лавандовый тон. Красит карточку профиля.", price: 400, type: "color", value: "B39DDB" },
  { id: "color_coral", name: "Цвет «Коралловый»", category: "Цвета", description: "Тёплый коралловый. Красит карточку профиля.", price: 400, type: "color", value: "FF7F6B" },
  { id: "color_lime", name: "Цвет «Лаймовый»", category: "Цвета", description: "Яркий лайм. Красит карточку профиля.", price: 450, type: "color", value: "B6F23A" },
  { id: "color_amber", name: "Цвет «Янтарный»", category: "Цвета", description: "Тёплый янтарь. Красит карточку профиля.", price: 500, type: "color", value: "FFB300" },
  { id: "color_indigo", name: "Цвет «Индиго»", category: "Цвета", description: "Глубокий индиго. Красит карточку профиля.", price: 550, type: "color", value: "4B50E0" },
  { id: "color_fuchsia", name: "Цвет «Фуксия»", category: "Цвета", description: "Дерзкая фуксия. Красит карточку профиля.", price: 650, type: "color", value: "E040FB" },
  { id: "color_snow", name: "Цвет «Белоснежный»", category: "Цвета", description: "Чистый белый. Красит карточку профиля.", price: 750, type: "color", value: "F5F7FA" },
  // Градиенты
  { id: "grad_sunset", name: "Градиент «Закат»", category: "Цвета", description: "Градиент красит карточку профиля: баннер, кольцо аватарки, полоски.", price: 900, type: "color", value: "FF5E62-FF9966" },
  { id: "grad_ocean", name: "Градиент «Океан»", category: "Цвета", description: "Градиент красит карточку профиля: баннер, кольцо аватарки, полоски.", price: 900, type: "color", value: "2193B0-6DD5ED" },
  { id: "grad_forest", name: "Градиент «Лес»", category: "Цвета", description: "Градиент красит карточку профиля: баннер, кольцо аватарки, полоски.", price: 950, type: "color", value: "11998E-38EF7D" },
  { id: "grad_berry", name: "Градиент «Ягодный»", category: "Цвета", description: "Градиент красит карточку профиля: баннер, кольцо аватарки, полоски.", price: 1100, type: "color", value: "DA4453-89216B" },
  { id: "grad_peach", name: "Градиент «Персик»", category: "Цвета", description: "Градиент красит карточку профиля: баннер, кольцо аватарки, полоски.", price: 1100, type: "color", value: "FFB88C-DE6262" },
  { id: "grad_ultraviolet", name: "Градиент «Ультрафиолет»", category: "Цвета", description: "Градиент красит карточку профиля: баннер, кольцо аватарки, полоски.", price: 1300, type: "color", value: "8E2DE2-4A00E0" },
  { id: "grad_ice", name: "Градиент «Ледяной»", category: "Цвета", description: "Градиент красит карточку профиля: баннер, кольцо аватарки, полоски.", price: 2000, type: "color", value: "74EBD5-ACB6E5" },
  { id: "grad_neon", name: "Градиент «Неон»", category: "Цвета", description: "Градиент красит карточку профиля: баннер, кольцо аватарки, полоски.", price: 2400, type: "color", value: "00F5FF-FF00E5" },
  { id: "grad_dawn", name: "Градиент «Заря»", category: "Цвета", description: "Градиент красит карточку профиля: баннер, кольцо аватарки, полоски.", price: 2600, type: "color", value: "FF512F-DD2476" },
  { id: "grad_fire", name: "Градиент «Огонь»", category: "Цвета", description: "Градиент красит карточку профиля: баннер, кольцо аватарки, полоски.", price: 2900, type: "color", value: "F83600-F9D423" },
  { id: "grad_northern", name: "Градиент «Северное сияние»", category: "Цвета", description: "Градиент красит карточку профиля: баннер, кольцо аватарки, полоски.", price: 3300, type: "color", value: "43E97B-38F9D7-4A5CFF" },
  { id: "grad_cosmic", name: "Градиент «Космос»", category: "Цвета", description: "Градиент красит карточку профиля: баннер, кольцо аватарки, полоски.", price: 3800, type: "color", value: "7F00FF-E100FF" },
  { id: "grad_gold", name: "Градиент «Королевское золото»", category: "Цвета", description: "Градиент красит карточку профиля: баннер, кольцо аватарки, полоски.", price: 5500, type: "color", value: "BF953F-FCF6BA-B38728" },
  { id: "grad_aurora", name: "Градиент «Аврора»", category: "Цвета", description: "Градиент красит карточку профиля: баннер, кольцо аватарки, полоски.", price: 7000, type: "color", value: "00C9FF-92FE9D-C471ED" },
  { id: "grad_rainbow", name: "Градиент «Радуга»", category: "Цвета", description: "Градиент красит карточку профиля: баннер, кольцо аватарки, полоски.", price: 9000, type: "color", value: "FF3B3B-FF9900-33CC33-0099FF-9933FF" },
  { id: "grad_universe", name: "Градиент «Вселенная»", category: "Цвета", description: "Градиент красит карточку профиля: баннер, кольцо аватарки, полоски.", price: 13000, type: "color", value: "12C2E9-C471ED-F64F59" },
  { id: "grad_phoenix", name: "Градиент «Феникс»", category: "Цвета", description: "Градиент красит карточку профиля: баннер, кольцо аватарки, полоски.", price: 17000, type: "color", value: "FF0844-FFB199-FFD27A" },
  { id: "grad_absolute", name: "Градиент «Абсолют»", category: "Цвета", description: "Градиент красит карточку профиля: баннер, кольцо аватарки, полоски.", price: 24000, type: "color", value: "FFFFFF-FFD27A-FF6AD5-5EF5FF" },
]);

db.exec(`
  CREATE TABLE IF NOT EXISTS economy_inventory (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    purchased_at INTEGER NOT NULL,
    PRIMARY KEY (guild_id, user_id, item_id)
  );
  CREATE TABLE IF NOT EXISTS economy_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    actor_id TEXT,
    amount INTEGER NOT NULL,
    kind TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS member_custom_profiles (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    title_item_id TEXT,
    badge_item_id TEXT,
    frame_item_id TEXT,
    banner_item_id TEXT,
    color_item_id TEXT,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (guild_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_economy_transactions_member ON economy_transactions(guild_id, user_id, id DESC);
  CREATE TABLE IF NOT EXISTS economy_daily_quests (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    day_key TEXT NOT NULL,
    task_key TEXT NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0),
    completed_at INTEGER,
    PRIMARY KEY (guild_id, user_id, day_key, task_key)
  );
  CREATE INDEX IF NOT EXISTS idx_economy_daily_quests_member ON economy_daily_quests(guild_id, user_id, day_key);
`);

const itemById = new Map(CATALOG.map((item) => [item.id, item]));

const RARITY_ORDER = Object.freeze(["Обычный", "Редкий", "Эпический", "Легендарный", "Мифический"]);
function getItemRarity(itemOrId) {
  const item = typeof itemOrId === "string" ? itemById.get(itemOrId) : itemOrId;
  if (!item) return null;
  if (item.rarity) return item.rarity;
  if (item.price <= 500) return "Обычный";
  if (item.price <= 1500) return "Редкий";
  if (item.price <= 4000) return "Эпический";
  if (item.price <= 10000) return "Легендарный";
  return "Мифический";
}


// Safe in-place migration: preserve ownership and equipped legacy frame cosmetics.
const customProfileColumns = db.prepare("PRAGMA table_info(member_custom_profiles)").all().map((column) => column.name);
if (!customProfileColumns.includes("banner_item_id")) db.exec("ALTER TABLE member_custom_profiles ADD COLUMN banner_item_id TEXT");
const legacyBannerMap = { frame_ocean: "banner_ocean", frame_forest: "banner_forest", frame_sunset: "banner_sunset", frame_neon: "banner_neon", frame_galaxy: "banner_galaxy", frame_gold: "banner_gold", frame_ice: "banner_ice", frame_shadow: "banner_shadow" };
const migrateLegacyBanners = db.transaction(() => {
  for (const [legacyId, bannerId] of Object.entries(legacyBannerMap)) {
    db.prepare("UPDATE economy_inventory SET item_id=? WHERE item_id=?").run(bannerId, legacyId);
    db.prepare("UPDATE member_custom_profiles SET banner_item_id=?, frame_item_id=NULL WHERE frame_item_id=?").run(bannerId, legacyId);
  }
});
migrateLegacyBanners();
const ensureMember = db.prepare("INSERT INTO member_stats (guild_id,user_id) VALUES (?,?) ON CONFLICT(guild_id,user_id) DO NOTHING");
const getBalanceStatement = db.prepare("SELECT balance, last_daily_at FROM member_stats WHERE guild_id=? AND user_id=?");
const logTransaction = db.prepare("INSERT INTO economy_transactions (guild_id,user_id,actor_id,amount,kind,details,created_at) VALUES (?,?,?,?,?,?,?)");

function moscowDayKey(now = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(now));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getDailyQuests(guildId, userId, now = Date.now()) {
  const dayKey = moscowDayKey(now);
  const run = db.transaction(() => {
    ensureMember.run(guildId, userId);
    const insert = db.prepare(
      "INSERT INTO economy_daily_quests (guild_id,user_id,day_key,task_key,progress) VALUES (?,?,?,?,0) ON CONFLICT(guild_id,user_id,day_key,task_key) DO NOTHING",
    );
    for (const task of DAILY_QUESTS) insert.run(guildId, userId, dayKey, task.key);
    const select = db.prepare(
      "SELECT progress, completed_at FROM economy_daily_quests WHERE guild_id=? AND user_id=? AND day_key=? AND task_key=?",
    );
    return DAILY_QUESTS.map((task) => {
      const row = select.get(guildId, userId, dayKey, task.key);
      return { ...task, progress: Math.min(task.target, Number(row?.progress || 0)), completed: row?.completed_at !== null && row?.completed_at !== undefined };
    });
  });
  return run();
}

function recordQuestProgress(guildId, userId, taskKey, amount = 1, now = Date.now()) {
  const task = DAILY_QUESTS.find((entry) => entry.key === taskKey);
  if (!task || !Number.isSafeInteger(amount) || amount < 1) {
    return { ok: false, reason: "invalid_task_or_amount" };
  }
  const dayKey = moscowDayKey(now);
  const run = db.transaction(() => {
    ensureMember.run(guildId, userId);
    db.prepare(
      "INSERT INTO economy_daily_quests (guild_id,user_id,day_key,task_key,progress) VALUES (?,?,?,?,0) ON CONFLICT(guild_id,user_id,day_key,task_key) DO NOTHING",
    ).run(guildId, userId, dayKey, taskKey);
    const current = db.prepare(
      "SELECT progress, completed_at FROM economy_daily_quests WHERE guild_id=? AND user_id=? AND day_key=? AND task_key=?",
    ).get(guildId, userId, dayKey, taskKey);
    if (current.completed_at !== null && current.completed_at !== undefined) {
      return { ok: true, completed: true, newlyCompleted: false, progress: task.target, reward: 0, balance: getBalance(guildId, userId).balance };
    }
    const progress = Math.min(task.target, Number(current.progress || 0) + amount);
    const completed = progress >= task.target;
    db.prepare(
      "UPDATE economy_daily_quests SET progress=?, completed_at=? WHERE guild_id=? AND user_id=? AND day_key=? AND task_key=?",
    ).run(progress, completed ? now : null, guildId, userId, dayKey, taskKey);
    if (completed) {
      db.prepare("UPDATE member_stats SET balance=balance+? WHERE guild_id=? AND user_id=?")
        .run(task.reward, guildId, userId);
      logTransaction.run(guildId, userId, null, task.reward, "quest", task.name, now);
    }
    return {
      ok: true, completed, newlyCompleted: completed, progress,
      reward: completed ? task.reward : 0,
      balance: getBalance(guildId, userId).balance,
    };
  });
  return run();
}

function getBalance(guildId, userId) {
  const row = getBalanceStatement.get(guildId, userId);
  return { balance: Number(row?.balance || 0), lastDailyAt: Number(row?.last_daily_at || 0) };
}
function claimDaily(guildId, userId, now = Date.now()) {
  const run = db.transaction(() => {
    ensureMember.run(guildId, userId);
    const current = getBalance(guildId, userId);
    const elapsed = now - current.lastDailyAt;
    if (current.lastDailyAt > 0 && elapsed < DAILY_COOLDOWN_MS) {
      return { claimed: false, balance: current.balance, remainingMs: Math.max(0, DAILY_COOLDOWN_MS - elapsed) };
    }
    db.prepare("UPDATE member_stats SET balance=balance+?, last_daily_at=? WHERE guild_id=? AND user_id=?")
      .run(DAILY_REWARD, now, guildId, userId);
    logTransaction.run(guildId, userId, null, DAILY_REWARD, "daily", "Ежедневная награда", now);
    return { claimed: true, reward: DAILY_REWARD, balance: current.balance + DAILY_REWARD, remainingMs: DAILY_COOLDOWN_MS };
  });
  const result = run();
  if (result.claimed) {
    const quest = recordQuestProgress(guildId, userId, "daily", 1, now);
    result.questReward = quest.reward || 0;
    result.balance = getBalance(guildId, userId).balance;
  }
  return result;
}
function buyItem(guildId, userId, itemId, now = Date.now()) {
  const item = itemById.get(itemId);
  if (!item) return { ok: false, reason: "unknown_item" };
  const run = db.transaction(() => {
    if (db.prepare("SELECT 1 FROM economy_inventory WHERE guild_id=? AND user_id=? AND item_id=?").get(guildId,userId,itemId)) {
      return { ok: false, reason: "already_owned", item, balance: getBalance(guildId,userId).balance };
    }
    ensureMember.run(guildId, userId);
    const debit = db.prepare("UPDATE member_stats SET balance=balance-? WHERE guild_id=? AND user_id=? AND balance>=?")
      .run(item.price, guildId, userId, item.price);
    if (debit.changes !== 1) return { ok: false, reason: "insufficient_funds", item, balance: getBalance(guildId,userId).balance };
    db.prepare("INSERT INTO economy_inventory (guild_id,user_id,item_id,purchased_at) VALUES (?,?,?,?)").run(guildId,userId,itemId,now);
    logTransaction.run(guildId,userId,null,-item.price,"purchase",item.id,now);
    return { ok: true, item, balance: getBalance(guildId,userId).balance };
  });
  const result = run();
  if (result.ok) {
    const quest = recordQuestProgress(guildId, userId, "purchase", 1, now);
    result.questReward = quest.reward || 0;
    result.balance = getBalance(guildId, userId).balance;
  }
  return result;
}
function getInventory(guildId, userId) {
  return db.prepare("SELECT item_id, purchased_at FROM economy_inventory WHERE guild_id=? AND user_id=? ORDER BY purchased_at, item_id")
    .all(guildId,userId).map((row) => ({ ...row, item: itemById.get(row.item_id) })).filter((row) => row.item);
}
function getCustomProfile(guildId, userId) {
  const row = db.prepare("SELECT * FROM member_custom_profiles WHERE guild_id=? AND user_id=?").get(guildId,userId);
  if (!row) return { title: null, badge: null, banner: null, color: null };
  return {
    title: row.title_item_id ? itemById.get(row.title_item_id) || null : null,
    badge: row.badge_item_id ? itemById.get(row.badge_item_id) || null : null,
    banner: row.banner_item_id ? itemById.get(row.banner_item_id) || null : (row.frame_item_id ? itemById.get(row.frame_item_id) || null : null),
    color: row.color_item_id ? itemById.get(row.color_item_id) || null : null,
  };
}
function equipItem(guildId, userId, itemId, now = Date.now()) {
  const item = itemById.get(itemId);
  if (!item) return { ok: false, reason: "unknown_item" };
  const owned = db.prepare("SELECT 1 FROM economy_inventory WHERE guild_id=? AND user_id=? AND item_id=?").get(guildId,userId,itemId);
  if (!owned) return { ok: false, reason: "not_owned", item };
  const column = ({ title: "title_item_id", badge: "badge_item_id", banner: "banner_item_id", color: "color_item_id" })[item.type];
  const run = db.transaction(() => {
    db.prepare(`INSERT INTO member_custom_profiles (guild_id,user_id,${column},updated_at) VALUES (?,?,?,?) ON CONFLICT(guild_id,user_id) DO UPDATE SET ${column}=excluded.${column},updated_at=excluded.updated_at`)
      .run(guildId,userId,itemId,now);
  });
  run();
  return { ok: true, item, profile: getCustomProfile(guildId,userId) };
}
function removeEquipped(guildId, userId, type, now = Date.now()) {
  const column = ({ title: "title_item_id", badge: "badge_item_id", banner: "banner_item_id", frame: "banner_item_id", color: "color_item_id" })[type];
  if (!column) return false;
  db.prepare(`UPDATE member_custom_profiles SET ${column}=NULL,updated_at=? WHERE guild_id=? AND user_id=?`).run(now,guildId,userId);
  return true;
}
function adjustBalance(guildId, userId, actorId, amount, reason = "Административная корректировка", now = Date.now()) {
  if (!Number.isSafeInteger(amount) || amount === 0 || Math.abs(amount) > 1_000_000) throw new RangeError("Сумма должна быть целым числом от -1000000 до 1000000, кроме нуля.");
  const run = db.transaction(() => {
    ensureMember.run(guildId,userId);
    const debit = db.prepare("UPDATE member_stats SET balance=balance+? WHERE guild_id=? AND user_id=? AND balance+?>=0")
      .run(amount,guildId,userId,amount);
    if (debit.changes !== 1) return { ok: false, reason: "negative_balance", balance: getBalance(guildId,userId).balance };
    const balance = getBalance(guildId,userId).balance;
    logTransaction.run(guildId,userId,actorId,amount,"admin_adjustment",String(reason).slice(0,300),now);
    return { ok: true, balance };
  });
  return run();
}
const TRANSFER_FEE_PERCENT = 5;
const MAX_TRANSFER_AMOUNT = 1_000_000;
function transferCoins(guildId, senderId, recipientId, amount, now = Date.now()) {
  if (typeof guildId !== "string" || !guildId || typeof senderId !== "string" || !senderId || typeof recipientId !== "string" || !recipientId) {
    return { ok: false, reason: "invalid_participants" };
  }
  if (senderId === recipientId) return { ok: false, reason: "self_transfer" };
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > MAX_TRANSFER_AMOUNT) {
    return { ok: false, reason: "invalid_amount" };
  }
  // The requested amount is what the recipient receives; the sender pays it plus 5%.
  const fee = Math.ceil(amount * TRANSFER_FEE_PERCENT / 100);
  const total = amount + fee;
  if (!Number.isSafeInteger(total)) return { ok: false, reason: "invalid_amount" };
  const run = db.transaction(() => {
    ensureMember.run(guildId, senderId);
    ensureMember.run(guildId, recipientId);
    const senderBalance = getBalance(guildId, senderId).balance;
    if (senderBalance < total) return { ok: false, reason: "insufficient_funds", balance: senderBalance, amount, fee, total };
    const debit = db.prepare("UPDATE member_stats SET balance=balance-? WHERE guild_id=? AND user_id=? AND balance>=?")
      .run(total, guildId, senderId, total);
    if (debit.changes !== 1) return { ok: false, reason: "insufficient_funds", balance: getBalance(guildId, senderId).balance, amount, fee, total };
    db.prepare("UPDATE member_stats SET balance=balance+? WHERE guild_id=? AND user_id=?").run(amount, guildId, recipientId);
    logTransaction.run(guildId, senderId, recipientId, -total, "transfer_sent", `Перевод участнику ${recipientId}; сумма ${amount}; комиссия ${fee}`, now);
    logTransaction.run(guildId, recipientId, senderId, amount, "transfer_received", `Перевод от участника ${senderId}`, now);
    return { ok: true, amount, fee, total, senderBalance: getBalance(guildId, senderId).balance, recipientBalance: getBalance(guildId, recipientId).balance };
  });
  return run();
}

function getTransactions(guildId, userId, limit = 10) {
  return db.prepare("SELECT amount,kind,details,created_at FROM economy_transactions WHERE guild_id=? AND user_id=? ORDER BY id DESC LIMIT ?")
    .all(guildId,userId,Math.min(25,Math.max(1,limit)));
}
module.exports = { DAILY_REWARD, DAILY_COOLDOWN_MS, DAILY_QUESTS, CATALOG, RARITY_ORDER, getItemRarity, TRANSFER_FEE_PERCENT, MAX_TRANSFER_AMOUNT, getBalance, claimDaily, buyItem, getInventory, getCustomProfile, equipItem, removeEquipped, adjustBalance, transferCoins, getTransactions, getDailyQuests, recordQuestProgress, moscowDayKey };
