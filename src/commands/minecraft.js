const crypto = require("node:crypto");
const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require("discord.js");
const db = require("../database");
const config = require("../config");
const logger = require("../logger");
const { ensureSchema } = require("../minecraft-api");

ensureSchema(db);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/;

function hashCode(userId, code) {
  return crypto.createHmac("sha256", config.minecraftApiToken)
    .update(userId + ":" + code, "utf8").digest("hex");
}

function safeEqualHex(left, right) {
  if (typeof left !== "string" || typeof right !== "string" ||
      !/^[0-9a-f]{64}$/i.test(left) || !/^[0-9a-f]{64}$/i.test(right)) return false;
  return crypto.timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function formatUuid(compact) {
  return compact.replace(/^([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/i,
    "$1-$2-$3-$4-$5").toLowerCase();
}

async function resolveMinecraftProfile(username) {
  if (!USERNAME_PATTERN.test(username)) throw new Error("Имя Minecraft должно содержать 3–16 латинских букв, цифр или подчёркиваний.");
  const response = await fetch("https://api.mojang.com/users/profiles/minecraft/" + encodeURIComponent(username),
    { signal: AbortSignal.timeout(7000), headers: { Accept: "application/json" } });
  if (response.status === 404) throw new Error("Аккаунт Minecraft с таким именем не найден.");
  if (!response.ok) throw new Error("Сервис профилей Minecraft временно недоступен. Попробуй позже.");
  const profile = await response.json();
  if (typeof profile.id !== "string" || !/^[0-9a-f]{32}$/i.test(profile.id) ||
      typeof profile.name !== "string" || !USERNAME_PATTERN.test(profile.name)) {
    throw new Error("Сервис профилей вернул некорректный профиль.");
  }
  return { uuid: formatUuid(profile.id), username: profile.name };
}

function isGuildAdmin(interaction) {
  return Boolean(interaction.guild &&
    (interaction.user.id === interaction.guild.ownerId ||
     config.ownerIds.includes(interaction.user.id) ||
     interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
     interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)));
}

async function notifyOwners(client, message) {
  const recipients = new Set(config.ownerIds);
  try {
    const guild = await client.guilds.fetch(config.guildId);
    if (guild?.ownerId) recipients.add(guild.ownerId);
  } catch {
    logger.warn("Could not resolve the configured Discord guild owner for Minecraft registration notice.");
  }
  for (const userId of recipients) {
    const user = await client.users.fetch(userId).catch(() => null);
    if (user) await user.send({ content: message, allowedMentions: { parse: [] } })
      .catch(() => logger.warn("Could not send Minecraft registration notice to owner " + userId + "."));
  }
}

async function linkAccount(interaction) {
  if (!config.minecraftApiToken) {
    return interaction.reply({ content: "🛑 Интеграция Minecraft пока не включена администратором.", flags: MessageFlags.Ephemeral });
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  let profile;
  try {
    profile = await resolveMinecraftProfile(interaction.options.getString("username", true).trim());
  } catch (error) {
    return interaction.editReply({ content: "⚠️ " + error.message });
  }

  const now = Date.now();
  const createRequest = db.transaction(() => {
    const activeRequest = db.prepare("SELECT discord_user_id, status, expires_at FROM minecraft_link_requests WHERE uuid=?").get(profile.uuid);
    if (activeRequest && activeRequest.expires_at > now &&
        ["awaiting_login", "pending_approval"].includes(activeRequest.status) &&
        activeRequest.discord_user_id !== interaction.user.id) {
      return { error: "Этот Minecraft-аккаунт уже имеет активную заявку от другого Discord. Если это твой аккаунт, обратись к администрации." };
    }
    if (activeRequest && activeRequest.expires_at > now && activeRequest.status === "pending_approval") {
      return { error: "Твоя заявка уже подтверждена и ожидает решения администрации. Проверь /minecraft status." };
    }

    const existing = db.prepare("SELECT discord_user_id FROM minecraft_accounts WHERE uuid=?").get(profile.uuid);
    if (existing) {
      return { error: existing.discord_user_id === interaction.user.id
        ? "Этот Minecraft-аккаунт уже привязан к твоему Discord."
        : "Этот Minecraft-аккаунт уже привязан к другому Discord-аккаунту. Обратись к администрации." };
    }
    const another = db.prepare("SELECT username FROM minecraft_accounts WHERE discord_user_id=?").get(interaction.user.id);
    if (another) {
      return { error: "К твоему Discord уже привязан Minecraft-аккаунт " + another.username + ". Сначала используй /minecraft unlink." };
    }
    const anotherRequest = db.prepare(`
      SELECT username, status FROM minecraft_link_requests
       WHERE discord_user_id=? AND uuid<>?
         AND status IN ('awaiting_login','pending_approval') AND expires_at>?
       LIMIT 1
    `).get(interaction.user.id, profile.uuid, now);
    if (anotherRequest) {
      return { error: "У тебя уже есть активная заявка для " + anotherRequest.username + ". Заверши её или дождись истечения срока." };
    }

    db.prepare(`
      INSERT INTO minecraft_link_requests
        (uuid, username, discord_user_id, code_hash, status, created_at, expires_at, observed_at, handled_by, handled_at)
      VALUES (?, ?, ?, '', 'awaiting_login', ?, ?, NULL, NULL, NULL)
      ON CONFLICT(uuid) DO UPDATE SET
        username=excluded.username, discord_user_id=excluded.discord_user_id,
        code_hash=excluded.code_hash, status='awaiting_login',
        created_at=excluded.created_at, expires_at=excluded.expires_at,
        observed_at=NULL, handled_by=NULL, handled_at=NULL
    `).run(profile.uuid, profile.username, interaction.user.id, now, now + 600000);
    return { error: null };
  });
  const created = createRequest();
  if (created.error) return interaction.editReply({ content: created.error });

  return interaction.editReply({ content: [
    "🔐 **Запрос привязки создан.**",
    "Minecraft: **" + profile.username + "**",
    "UUID: " + profile.uuid,
    "",
    "Теперь попробуй подключиться к Minecraft-серверу. Первая попытка будет отклонена, а одноразовый код появится в сообщении об отказе во входе.",
    "Скопируй код из Minecraft и выполни здесь /minecraft confirm с этим кодом.",
    "Код действует 10 минут. Не передавай его другим людям.",
  ].join("\n") });
}

async function confirmAccount(interaction) {
  if (!config.minecraftApiToken) {
    return interaction.reply({ content: "🛑 Интеграция Minecraft пока не включена.", flags: MessageFlags.Ephemeral });
  }
  const code = interaction.options.getString("code", true).trim();
  const now = Date.now();
  const confirmation = db.transaction(() => {
    const requests = db.prepare("SELECT uuid, username, code_hash, observed_at, challenge_expires_at FROM minecraft_link_requests WHERE discord_user_id=? AND status='awaiting_login' AND expires_at>?")
      .all(interaction.user.id, now);
    const request = requests.find((row) => safeEqualHex(row.code_hash, hashCode(interaction.user.id, code)));
    if (!request) return { error: "Код не найден или срок его действия истёк. Создай новый запрос командой /minecraft link." };
    if (!request.observed_at) {
      return { error: "Сначала попробуй подключиться к Minecraft-серверу. После отклонённой попытки повтори подтверждение." };
    }
    if (!request.challenge_expires_at || request.challenge_expires_at <= now) {
      return { error: "Одноразовый код истёк. Попробуй подключиться к серверу ещё раз, чтобы получить новый." };
    }
    const changed = db.prepare("UPDATE minecraft_link_requests SET status='pending_approval' WHERE uuid=? AND discord_user_id=? AND status='awaiting_login'")
      .run(request.uuid, interaction.user.id);
    if (changed.changes !== 1) return { error: "Этот код уже был использован." };
    return { error: null, request };
  });
  const confirmed = confirmation();
  if (confirmed.error) {
    return interaction.reply({ content: "⛔ " + confirmed.error, flags: MessageFlags.Ephemeral });
  }
  const request = confirmed.request;
  await notifyOwners(interaction.client, [
    "🆕 **Новая заявка на доступ к Herade House Minecraft**",
    "Игрок: " + request.username,
    "UUID: " + request.uuid,
    "Discord: " + interaction.user.id,
    "",
    "Одобрение: /minecraft approve uuid:" + request.uuid,
    "Отказ: /minecraft reject uuid:" + request.uuid,
  ].join("\n"));
  return interaction.reply({ content: "✅ Личность Minecraft подтверждена. Заявка отправлена администрации на одобрение.", flags: MessageFlags.Ephemeral });
}

async function showStatus(interaction) {
  const account = db.prepare("SELECT username, uuid, approved_at FROM minecraft_accounts WHERE discord_user_id=?").get(interaction.user.id);
  if (account) {
    return interaction.reply({ content: "🟢 Аккаунт привязан: **" + account.username + "**\nUUID: " + account.uuid +
      "\nОдобрен: <t:" + Math.floor(account.approved_at / 1000) + ":F>", flags: MessageFlags.Ephemeral });
  }
  const request = db.prepare("SELECT username, uuid, status, expires_at FROM minecraft_link_requests WHERE discord_user_id=? AND status IN ('awaiting_login','pending_approval') ORDER BY created_at DESC LIMIT 1")
    .get(interaction.user.id);
  if (!request) return interaction.reply({ content: "Minecraft-аккаунт не привязан.", flags: MessageFlags.Ephemeral });
  const status = request.status === "pending_approval" ? "Ожидает одобрения администрации" : "Ожидает попытки входа и подтверждения кода";
  return interaction.reply({ content: "Minecraft: **" + request.username + "**\nUUID: " + request.uuid +
    "\nСтатус: **" + status + "**\nИстекает: <t:" + Math.floor(request.expires_at / 1000) + ":R>", flags: MessageFlags.Ephemeral });
}

async function unlinkAccount(interaction) {
  const now = Date.now();
  const result = db.transaction(() => {
    const deleted = db.prepare("DELETE FROM minecraft_accounts WHERE discord_user_id=?")
      .run(interaction.user.id);
    db.prepare("UPDATE minecraft_link_requests SET status='rejected', handled_by=?, handled_at=? WHERE discord_user_id=? AND status IN ('awaiting_login','pending_approval','approved')")
      .run(interaction.user.id, now, interaction.user.id);
    return deleted.changes;
  })();
  return interaction.reply({ content: result
    ? "Привязка Minecraft-аккаунта удалена. Для повторного доступа потребуется новая регистрация и одобрение."
    : "У тебя нет привязанного Minecraft-аккаунта.", flags: MessageFlags.Ephemeral });
}

async function reviewRequest(interaction, approve) {
  if (!interaction.inGuild() || !isGuildAdmin(interaction)) {
    return interaction.reply({ content: "⛔ Одобрять и отклонять заявки может только администрация сервера.", flags: MessageFlags.Ephemeral });
  }
  const uuid = interaction.options.getString("uuid", true).trim().toLowerCase();
  if (!UUID_PATTERN.test(uuid)) {
    return interaction.reply({ content: "⛔ Некорректный UUID.", flags: MessageFlags.Ephemeral });
  }
  const request = db.prepare("SELECT uuid, username, discord_user_id, status, expires_at, observed_at FROM minecraft_link_requests WHERE uuid=?").get(uuid);
  if (!request || request.status !== "pending_approval" || !request.observed_at || request.expires_at <= Date.now()) {
    return interaction.reply({ content: "Заявка не найдена, не подтверждена игроком или уже истекла.", flags: MessageFlags.Ephemeral });
  }

  const now = Date.now();
  if (approve) {
    const approval = db.transaction(() => {
      const anotherAccount = db.prepare(
        "SELECT username FROM minecraft_accounts WHERE discord_user_id=? AND uuid<>?",
      ).get(request.discord_user_id, request.uuid);
      if (anotherAccount) {
        return { error: "Пользователь уже привязал другой Minecraft-аккаунт: " + anotherAccount.username };
      }
      const linkedAccount = db.prepare(
        "SELECT discord_user_id FROM minecraft_accounts WHERE uuid=?",
      ).get(request.uuid);
      if (linkedAccount && linkedAccount.discord_user_id !== request.discord_user_id) {
        return { error: "Этот Minecraft-аккаунт уже привязан к другому Discord-пользователю." };
      }

      const changed = db.prepare(
        "UPDATE minecraft_link_requests SET status='approved', handled_by=?, handled_at=? WHERE uuid=? AND status='pending_approval' AND observed_at IS NOT NULL AND expires_at>?",
      ).run(interaction.user.id, now, request.uuid, now);
      if (changed.changes !== 1) {
        return { error: "Заявка уже была обработана другим администратором." };
      }

      db.prepare(`
        INSERT INTO minecraft_accounts (uuid, username, discord_user_id, approved_at, approved_by, last_seen_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(uuid) DO UPDATE SET username=excluded.username,
          discord_user_id=excluded.discord_user_id, approved_at=excluded.approved_at,
          approved_by=excluded.approved_by, last_seen_at=excluded.last_seen_at
      `).run(request.uuid, request.username, request.discord_user_id, now, interaction.user.id, request.observed_at);
      db.prepare("INSERT INTO admin_audit (guild_id,actor_id,action,target_id,details) VALUES (?,?,?,?,?)")
        .run(interaction.guildId, interaction.user.id, "minecraft_access_approved", request.discord_user_id,
          "uuid=" + request.uuid + "; username=" + request.username);
      return { error: null };
    })();
    if (approval.error) {
      return interaction.reply({ content: "⛔ " + approval.error, flags: MessageFlags.Ephemeral });
    }

    const user = await interaction.client.users.fetch(request.discord_user_id).catch(() => null);
    if (user) await user.send({ content: "✅ Доступ к Minecraft-серверу одобрен для " + request.username + ". Теперь можно подключаться.", allowedMentions: { parse: [] } }).catch(() => {});
    return interaction.reply({ content: "✅ Доступ одобрен: **" + request.username + "** (" + request.uuid + ").", flags: MessageFlags.Ephemeral });
  }

  const rejection = db.transaction(() => {
    const changed = db.prepare(
      "UPDATE minecraft_link_requests SET status='rejected', handled_by=?, handled_at=? WHERE uuid=? AND status='pending_approval' AND observed_at IS NOT NULL AND expires_at>?",
    ).run(interaction.user.id, now, request.uuid, now);
    if (changed.changes !== 1) return false;
    db.prepare("INSERT INTO admin_audit (guild_id,actor_id,action,target_id,details) VALUES (?,?,?,?,?)")
      .run(interaction.guildId, interaction.user.id, "minecraft_access_rejected", request.discord_user_id,
        "uuid=" + request.uuid + "; username=" + request.username);
    return true;
  })();
  if (!rejection) {
    return interaction.reply({ content: "Заявка уже обработана, не подтверждена или истекла.", flags: MessageFlags.Ephemeral });
  }
  const user = await interaction.client.users.fetch(request.discord_user_id).catch(() => null);
  if (user) await user.send({ content: "Заявка на доступ к Minecraft для " + request.username + " отклонена администрацией.", allowedMentions: { parse: [] } }).catch(() => {});
  return interaction.reply({ content: "Заявка для **" + request.username + "** отклонена.", flags: MessageFlags.Ephemeral });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("minecraft")
    .setDescription("Регистрация и управление доступом к Herade House Minecraft.")
    .addSubcommand((s) => s.setName("link").setDescription("Создать запрос привязки Minecraft-аккаунта.")
      .addStringOption((o) => o.setName("username").setDescription("Имя Minecraft").setMinLength(3).setMaxLength(16).setRequired(true)))
    .addSubcommand((s) => s.setName("confirm").setDescription("Подтвердить владение Minecraft-аккаунтом восьмизначным кодом.")
      .addStringOption((o) => o.setName("code").setDescription("Восьмизначный код").setMinLength(8).setMaxLength(8).setRequired(true)))
    .addSubcommand((s) => s.setName("status").setDescription("Показать статус привязки Minecraft."))
    .addSubcommand((s) => s.setName("unlink").setDescription("Удалить свою привязку Minecraft."))
    .addSubcommand((s) => s.setName("approve").setDescription("Одобрить подтверждённую заявку Minecraft.")
      .addStringOption((o) => o.setName("uuid").setDescription("UUID Minecraft-аккаунта").setMinLength(36).setMaxLength(36).setRequired(true)))
    .addSubcommand((s) => s.setName("reject").setDescription("Отклонить подтверждённую заявку Minecraft.")
      .addStringOption((o) => o.setName("uuid").setDescription("UUID Minecraft-аккаунта").setMinLength(36).setMaxLength(36).setRequired(true))),
  async execute(interaction) {
    const action = interaction.options.getSubcommand();
    if (action === "link") return linkAccount(interaction);
    if (action === "confirm") return confirmAccount(interaction);
    if (action === "status") return showStatus(interaction);
    if (action === "unlink") return unlinkAccount(interaction);
    if (action === "approve") return reviewRequest(interaction, true);
    if (action === "reject") return reviewRequest(interaction, false);
    return interaction.reply({ content: "Неизвестное действие Minecraft.", flags: MessageFlags.Ephemeral });
  },
};
