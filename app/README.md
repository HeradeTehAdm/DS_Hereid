# Дух Свободы App

Отдельный Vite-фронтенд с серверными Vercel Functions для входа через Discord. Ветка `feature/spirit-freedom-app` развёрнута на Vercel отдельно от бота.

## Текущий статус
- Главная страница, адаптивная навигация, вкладки профиля и наград.
- Discord OAuth2 `identify`: авторизация, проверка state, серверный обмен code, шифрованная HttpOnly Secure SameSite=Lax сессия, выход.
- `GET /api/me` возвращает только проверенный Discord identity владельца сессии.
- **XP, баланс, награды пока не синхронизированы с Discord-ботом.** Не показываем вымышленные данные.
- В `/admin` бота появилась функция выбора текстового канала и публикации ссылки, которую берёт из `SPIRIT_APP_URL`.

## Что требуется от владельца Discord-приложения
1. В Discord Developer Portal откройте **существующее приложение того же бота**, раздел OAuth2 → Redirects.
2. Зарегистрируйте callback (строго с HTTPS): `https://duh-svobody-app.vercel.app/api/auth/callback`.
3. В Vercel Project → Settings → Environment Variables задайте:
   - `DISCORD_CLIENT_ID`: Application ID того же Discord-приложения.
   - `DISCORD_CLIENT_SECRET`: OAuth2 Client Secret (**секрет**, только Vercel Server Environment, никогда не коммитить).
   - `DISCORD_REDIRECT_URI`: `https://duh-svobody-app.vercel.app/api/auth/callback`.
   - `SESSION_SECRET`: криптографически случайная секретная строка от 32 символов; хранить только в Vercel, не копировать в чат и репозиторий.
4. Назначьте переменные для Production; для Preview используйте отдельный зарегистрированный Redirect URI, если необходима авторизация на Preview.
5. Запустите Redeploy проекта, затем проверьте вход на `https://duh-svobody-app.vercel.app`.
6. Для бота в Pterodactyl добавьте `SPIRIT_APP_URL=https://duh-svobody-app.vercel.app`, затем перезапустите бота; вызовите `/admin` → Spirit App.

Токен самого бота `DISCORD_TOKEN` в Vercel **не добавляйте**. В продакшене API требует однозначный `DISCORD_REDIRECT_URI`. Состояние входа действительно 10 минут, сессия — 12 часов. Функции бота и его база остаются на сервере бота.

## Локальная разработка
```bash
cd app
npm install
npm run check
npm run test
npm run dev
npm run build
```

Локальный OAuth требует отдельной конфигурации HTTPS и отдельно разрешённого Discord redirect; нельзя перенаправлять авторизацию на произвольный домен. 

## Архитектурный следующий шаг
Безопасная синхронизация `guild_id + user_id` через серверный API, с аутентификацией между Vercel и сервером бота. Нельзя подключать браузер напрямую к SQLite или отдавать пользователю чужие записи. Текущая кнопка публикации открывает сайт, **не Discord Activity**.
