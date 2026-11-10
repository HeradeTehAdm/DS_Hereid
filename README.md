# Дух Свободы 🕊 — HeradeLegend Discord bot

Universal Discord community bot built with Node.js 22, discord.js 14 and SQLite for Pterodactyl.

## Features

- Discord login, structured logging and graceful shutdown.
- Slash commands: `/help`, `/ping`, `/botinfo`, `/admin`, `/serverconfig`.
- Interactive ephemeral administration panel with sections for member lookup, XP management, moderation, staff-role access, server settings, feature controls, statistics and audit.
- Persistent feature switches for welcome messages, goodbye messages, automatic roles, repeated-message spam detection and the moderation panel; each change is access-checked and audited.
- Role-based access grants stored in SQLite; server Administrators and configured bot owners have full panel access.
- Moderation actions: 10-minute timeout, kick and ban with required reason, hierarchy/permission checks, case history and optional mod-log channel.
- Welcome/goodbye messages and automatic role assignment.
- Repeated-message spam detection (log-only; no automatic deletion or punishment).
- Herade Core Minecraft registration through this existing bot: one-time login challenges, Discord account linking, staff approval and audit records.

## Requirements and setup

- Node.js 22 or newer.
- A Discord application/bot and a test server.
- Enable **Server Members Intent** and **Message Content Intent** in Discord Developer Portal.
- Invite the bot with `bot` and `applications.commands` scopes and only the permissions required for the enabled features.

1. Set `DISCORD_TOKEN`, `CLIENT_ID`, and `GUILD_ID` in your environment.
2. Optionally set `BOT_OWNER_IDS` to comma-separated Discord user IDs for bot owners.
3. For Minecraft integration, set `HERADE_CORE_API_TOKEN` to a random secret of at least 32 UTF-8 bytes. Use the exact same secret in the Minecraft server environment. Optionally set `HERADE_CORE_API_HOST` (default `127.0.0.1`) and `HERADE_CORE_API_PORT` (default `3068`).
4. Put the API behind a trusted TLS reverse proxy. The Minecraft mod must call its public HTTPS URL; do not expose the bot's plain HTTP listener directly to the internet.
5. Install dependencies with `npm install`.
6. Check JavaScript syntax with `npm run check` and run feature tests with `npm test`.
7. Start with `npm start`. Slash commands are registered automatically when the bot connects.

## Pterodactyl

- Use a Node.js 22 egg.
- Initial install command: `npm install`.
- For a Git clone of this repository, use this startup command to pull the latest `main` branch before launching: `git pull --ff-only origin main && npm install --omit=dev && npm start`.
- Set the environment variables in Pterodactyl's Variables panel; never commit `.env` or put the token in source.
- Keep `DATABASE_PATH` pointed to persistent storage, default `./data/bot.sqlite`.
- Follow `pterodactyl-startup.txt` for the full deployment procedure and troubleshooting steps.

## Admin panel

Use `/admin` in a server. Server Administrators and IDs listed in `BOT_OWNER_IDS` can manage panel access roles. Other staff members need a role granted access to one or more sections. Permissions are checked again when interactive components are used.

The panel includes:
- Member lookup and XP adjustments.
- Timeout (10 minutes), kick and ban; each requires a reason and checks the Discord role hierarchy.
- Per-section staff-role access grants.
- Current server configuration, summary statistics and audit log.
- Feature switches: welcome messages, goodbye messages, automatic roles, spam detection and moderation. Existing installations keep current behavior by default; settings are stored per guild in SQLite and changes are recorded in the audit log.
- Moderation case history and optional posting to the configured moderation-log channel.

## Minecraft registration

- Players use `/minecraft link username`, then attempt to join the server. The link request remains active for 30 minutes; the server displays an eight-digit one-time code after receiving the authenticated Minecraft profile for that UUID.
- The player enters that code with `/minecraft confirm code`. The code expires after 10 minutes and can be rotated by attempting to join again while the request is active. Confirmation creates a pending request; it does not grant access by itself.
- Staff with Manage Server or Administrator permission use `/minecraft approve uuid` or `/minecraft reject uuid` to decide the request. Players can check `/minecraft status` or remove their link with `/minecraft unlink`.
- The Minecraft server must use `online-mode=true`. Enable `authentication.enabled=true` in the mod configuration and set the same `HERADE_CORE_API_TOKEN` in the mod's environment. Configure the mod's `authentication.api-base-url` as the public HTTPS base URL of the reverse proxy.
- The API uses HMAC-SHA256 signatures, a short timestamp window, one-time nonces and a small request body limit. It stores link requests, challenge hashes and expiries, approved UUIDs and replay-prevention nonces in the existing SQLite database. Existing tables are upgraded additively; existing bot tables and member data are not reset.
- Keep the API listener bound to loopback when the reverse proxy runs on the same host. If the proxy is in another container or host, restrict network access to that proxy and terminate TLS there.

## Data and safety notes

- Existing SQLite files are preserved; tables are created with `CREATE TABLE IF NOT EXISTS`. Feature settings use a separate `guild_features` table and do not reset member statistics or other existing data.
- The repository ignores `.env`, `node_modules/`, `data/`, and SQLite database files.
- Never commit `.env` or share the bot token.
- Ensure the bot role is above roles it must manage and has the necessary Discord permissions.
- Spam detection remains log-only. It does not delete messages or issue automatic punishments.
- A successful syntax check does not prove live Discord permissions, interactions, or Pterodactyl startup. Test these on a test server before using the panel on a production community.
