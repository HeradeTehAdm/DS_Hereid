# HERADETALE: БЕЗДНА

Отдельная игра во вселенной Herade. Игровой сервер и база данных отделены от Discord-бота HeradeLegend.

## Архитектура

- Client: Phaser 3 (общая игровая логика для PC и Mobile).
- PC wrapper: Electron (подключается на следующих этапах).
- Game server: Node.js 22, HTTP health endpoint и WebSocket.
- Persistence: отдельная SQLite база `heradetale.sqlite` (будет подключена отдельным модулем).
- Hosting: отдельный Pterodactyl server/process.

## Принципы

1. Не менять и не использовать базу `bot.sqlite` от HeradeLegend.
2. Не хранить Discord bot token в игровом клиенте.
3. Игровой сервер является авторитетным источником состояния сессии.
4. Клиенты отправляют намерения, сервер проверяет действия.
5. Сохранения должны переживать перезапуск сервера.

## Текущий этап

Foundation: начальный серверный каркас, конфигурация и health endpoint. Это ещё не играбельный прототип.
