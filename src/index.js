const fs = require("node:fs");
const path = require("node:path");
const {
  Client, Collection, GatewayIntentBits, Partials, Events, MessageFlags,
} = require("discord.js");
const config = require("./config");
const logger = require("./logger");
const db = require("./database");
const { startMinecraftApi } = require("./minecraft-api");
const { isFeatureEnabled } = require("./features");
const { addMessageXp } = require("./member-profile");
const { ensureMember, recordMessage, recordVoiceState, evaluateMember, evaluateGuild } = require("./rank-system");
const { evaluateAchievements } = require("./achievements");
const { recordQuestProgress } = require("./economy");
const reports = require("./commands/report");
const shopBrowser = require("./shop-browser");
const casino = require("./casino");
const promoCodes = require("./promo");
const { moderateMessage } = require("./automod");
const { startAutomationScheduler, stopAutomationScheduler } = require("./automation");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember, Partials.User],
});

client.config = config;
client.logger = logger;
client.commands = new Collection();

async function notifyAchievementUnlocks(user, guild, achievements) {
  if (!achievements?.length) return;
  for (const achievement of achievements) {
    logger.info(`Achievement unlocked: guild=${guild.id} user=${user.id} achievement=${achievement.id}`);
  }

  const lines = achievements.map((achievement) =>
    `${achievement.emoji} **${achievement.name}** — ${achievement.description}`,
  );
  const message = [
    `🏅 **Новые достижения в HeradeLegend — ${guild.name}!**`,
    "",
    ...lines,
    "",
    "Посмотреть всю коллекцию можно командой `/achievements`.",
  ].join("\n");

  await user.send({ content: message }).catch((error) => {
    logger.debug(`Could not DM achievement notification to ${user.id}: ${error.message || error}`);
  });
}

function loadCommands() {
  const commandsDir = path.join(__dirname, "commands");
  if (!fs.existsSync(commandsDir) || !fs.statSync(commandsDir).isDirectory()) {
    throw new Error("Commands directory is missing: src/commands");
  }

  const files = fs.readdirSync(commandsDir)
    .filter((name) => name.endsWith(".js"))
    .sort();

  if (files.length === 0) {
    throw new Error("No command modules were found in src/commands.");
  }

  for (const file of files) {
    const fullPath = path.join(commandsDir, file);
    const command = require(fullPath);
    if (!command?.data || typeof command.data.toJSON !== "function" ||
        typeof command.execute !== "function") {
      throw new Error(`Invalid command module "${file}": expected data.toJSON() and execute().`);
    }

    const definition = command.data.toJSON();
    if (!definition.name || typeof definition.name !== "string") {
      throw new Error(`Invalid command name in "${file}".`);
    }
    if (client.commands.has(definition.name)) {
      throw new Error(`Duplicate slash command name "${definition.name}" in "${file}".`);
    }
    client.commands.set(definition.name, command);
    logger.debug(`Loaded command module: ${definition.name} (${file})`);
  }

  logger.info(`Loaded ${client.commands.size} slash command module(s).`);
}

loadCommands();
const adminPanel = client.commands.get("admin");
const minecraftApi = startMinecraftApi({ db, config, logger });
minecraftApi.ready?.catch((error) => logger.error("Herade Security API failed to start; Minecraft login verification will remain unavailable.", error));

client.once(Events.ClientReady, async (readyClient) => {
  logger.info(`Logged in as ${readyClient.user.tag} (${readyClient.user.id})`);
  logger.info(`Connected to ${readyClient.guilds.cache.size} guild(s).`);
  startAutomationScheduler(readyClient);
  for (const guild of readyClient.guilds.cache.values()) {
    try { if (promoCodes.seedDefaultPromos(guild.id)) logger.info(`Создан стартовый промокод для сервера ${guild.id}.`); } catch (error) { logger.error("Не удалось создать стартовый промокод.", error); }
  }

  const rankGuild = await readyClient.guilds.fetch(config.guildId).catch(() => null);
  if (rankGuild) {
    await evaluateGuild(rankGuild, logger);
    const rankSweep = setInterval(() => { void evaluateGuild(rankGuild, logger); }, 10 * 60_000);
    rankSweep.unref?.();
  } else {
    logger.warn("Configured guild unavailable; automatic rank evaluation will start when the guild is reachable.");
  }

  // Register guild commands on startup, so Pterodactyl does not require a
  // separate manual command-registration step after every code update.
  try {
    const payload = [...client.commands.values()].map((command) => command.data.toJSON());
    await readyClient.application.commands.set(payload, config.guildId);
    logger.info(`Automatically registered ${payload.length} guild slash command(s) for guild ${config.guildId}.`);
  } catch (error) {
    logger.error("Automatic slash-command registration failed. Check CLIENT_ID, GUILD_ID and the bot application's access.", error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        logger.warn(`No handler for slash command: ${interaction.commandName}`);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "⚠️ Эта команда больше не поддерживается. Обнови список команд или обратись к администратору.",
            flags: MessageFlags.Ephemeral,
          });
        }
        return;
      }

      await command.execute(interaction);
      if (!interaction.replied && !interaction.deferred) {
        logger.warn(`Command handler did not acknowledge interaction: ${interaction.commandName}`);
        await interaction.reply({
          content: "⚠️ Команда не вернула ответ. Ошибка записана в журнал.",
          flags: MessageFlags.Ephemeral,
        });
      }
      return;
    }

    if ((interaction.isButton() || interaction.isStringSelectMenu()) && interaction.customId?.startsWith("cas:")) {
      await casino.handle(interaction);
      return;
    }

    if ((interaction.isButton() || interaction.isStringSelectMenu()) && interaction.customId?.startsWith("shc:")) {
      await shopBrowser.handle(interaction);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId?.startsWith("rp:")) {
      await reports.handleModal(interaction);
      return;
    }

    if (adminPanel &&
        (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isChannelSelectMenu() || interaction.isModalSubmit()) &&
        interaction.customId?.startsWith("ha:")) {
      await adminPanel.handle(interaction);
      // Protect against stale/unknown component IDs that a handler may not
      // recognize; Discord interactions must always receive an acknowledgement.
      if (!interaction.replied && !interaction.deferred) {
        logger.warn(`Unacknowledged admin component interaction: ${interaction.customId}`);
        await interaction.reply({
          content: "⚠️ Это действие больше недоступно. Открой панель заново командой /admin.",
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  } catch (error) {
    logger.error("Interaction handler failed.", error);
    const payload = {
      content: "⚠️ При выполнении действия произошла ошибка. Проверь журнал бота.",
      flags: MessageFlags.Ephemeral,
    };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch((followUpError) =>
        logger.error("Could not send interaction error response.", followUpError));
    } else {
      await interaction.reply(payload).catch((replyError) =>
        logger.error("Could not send interaction error response.", replyError));
    }
  }
});

client.on(Events.GuildMemberAdd, async (member) => {
  try {
    ensureMember(member);
    await evaluateMember(member);
    const settings = db.prepare(
      "SELECT welcome_channel_id, welcome_message, autorole_id FROM guild_settings WHERE guild_id = ?",
    ).get(member.guild.id);

    if (settings?.autorole_id && isFeatureEnabled(member.guild.id, "autorole")) {
      const role = await member.guild.roles.fetch(settings.autorole_id).catch(() => null);
      if (role && role.editable) {
        await member.roles.add(role, "Configured automatic member role");
      } else {
        logger.warn(`Autorole missing or not manageable in guild ${member.guild.id}`);
      }
    }

    if (settings?.welcome_channel_id && isFeatureEnabled(member.guild.id, "welcome_messages")) {
      const channel = await member.guild.channels.fetch(settings.welcome_channel_id).catch(() => null);
      if (channel?.isTextBased()) {
        const message = (settings.welcome_message || "Добро пожаловать, {user}, на сервер **{server}**!")
          .replaceAll("{user}", `<@${member.id}>`)
          .replaceAll("{server}", member.guild.name);
        await channel.send({
          content: message,
          allowedMentions: { parse: [], users: [member.id] },
        }).catch((error) => logger.warn("Welcome message could not be sent.", error));
      }
    }
  } catch (error) {
    logger.error("Guild member join handler failed.", error);
  }
});

client.on(Events.GuildMemberRemove, async (member) => {
  try {
    const settings = db.prepare(
      "SELECT goodbye_channel_id, goodbye_message FROM guild_settings WHERE guild_id = ?",
    ).get(member.guild.id);
    if (!settings?.goodbye_channel_id || !isFeatureEnabled(member.guild.id, "goodbye_messages")) return;

    const channel = await member.guild.channels.fetch(settings.goodbye_channel_id).catch(() => null);
    if (!channel?.isTextBased()) return;

    const message = (settings.goodbye_message || "Участник **{user}** покинул сервер.")
      .replaceAll("{user}", member.user?.tag || member.id)
      .replaceAll("{server}", member.guild.name);
    await channel.send({
      content: message,
      allowedMentions: { parse: [] },
    }).catch((error) => logger.warn("Goodbye message could not be sent.", error));
  } catch (error) {
    logger.error("Guild member remove handler failed.", error);
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (!message.guild || message.author.bot || !message.content.trim()) return;

  try {
    await moderateMessage(message);
    const result = addMessageXp(message.guild.id, message.author.id, Date.now(), message.content);
    if (result.awarded && isFeatureEnabled(message.guild.id, "economy")) recordQuestProgress(message.guild.id, message.author.id, "messages", 1, Date.now());
    const member = message.member || await message.guild.members.fetch(message.author.id).catch(() => null);
    if (member) {
      recordMessage(member, message.content);
      const newlyAwarded = evaluateAchievements(message.guild.id, message.author.id);
      await notifyAchievementUnlocks(message.author, message.guild, newlyAwarded);
      await evaluateMember(member).catch((error) => logger.warn("Automatic rank evaluation failed.", error));
    }
    if (result.awarded && result.level > result.previousLevel) logger.info(`Member leveled up: guild=${message.guild.id} user=${message.author.id} level=${result.level}`);
  } catch (error) { logger.error("Member activity XP could not be saved.", error); }

  // RP actions are not handled here; messages are checked only for repeated spam.
  if (!isFeatureEnabled(message.guild.id, "spam_detection")) return;
  const now = Date.now();
  const key = `${message.guild.id}:${message.author.id}`;
  const recent = client._recentMessages || (client._recentMessages = new Map());
  const entries = (recent.get(key) || []).filter((entry) => now - entry.time < 7000);
  entries.push({ time: now, content: message.content });
  recent.set(key, entries);

  const repeats = entries.filter((entry) => entry.content && entry.content === message.content).length;
  if (repeats >= 4) {
    logger.warn(`Possible spam detected: guild=${message.guild.id} user=${message.author.id}`);
  }
  // Detection only: no automatic message deletion or punishment is performed.
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  try {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;
    const wasInVoice = Boolean(oldState.channelId);
    const isInVoice = Boolean(newState.channelId);
    if (wasInVoice === isInVoice && oldState.channelId === newState.channelId) return;
    const afkChannelId = member.guild.afkChannelId;
    const wasAfk = Boolean(afkChannelId && oldState.channelId === afkChannelId);
    const isAfk = Boolean(afkChannelId && newState.channelId === afkChannelId);
    recordVoiceState(member, wasInVoice, isInVoice, Date.now(), { wasAfk, isAfk });
    const newlyAwarded = evaluateAchievements(member.guild.id, member.id);
    await notifyAchievementUnlocks(member.user, member.guild, newlyAwarded);
    await evaluateMember(member);
  } catch (error) {
    logger.warn("Voice activity tracking failed.", error);
  }
});

client.on(Events.Error, (error) => logger.error("Discord client error.", error));
client.on("warn", (warning) => logger.warn("Discord client warning.", warning));
process.on("unhandledRejection", (error) => logger.error("Unhandled promise rejection.", error));
process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception; exiting for process-manager restart.", error);
  process.exit(1);
});

let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`Received ${signal}; shutting down gracefully.`);

  try {
    stopAutomationScheduler();
    await minecraftApi.close();
    client.destroy();
    if (db.open) db.close();
    logger.info("Discord client and database closed.");
    process.exitCode = 0;
  } catch (error) {
    logger.error("Error during graceful shutdown.", error);
    process.exitCode = 1;
  }
}

process.once("SIGINT", () => { void shutdown("SIGINT"); });
process.once("SIGTERM", () => { void shutdown("SIGTERM"); });

client.login(config.token).catch((error) => {
  logger.error("Discord login failed. Check DISCORD_TOKEN and network access.", error);
  process.exit(1);
});
