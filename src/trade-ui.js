"use strict";

// Интерфейс подарков, обмена и продажи: карточки, кнопки, подсказки.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, MessageFlags } = require("discord.js");
const trade = require("./trade");
const art = require("./trade-art");
const { getItem, getBalance, sellPrice, TRANSFER_FEE_PERCENT } = require("./economy");
const { refreshAchievements } = require("./achievement-notify");
const { preload } = require("./shop-browser");
const logger = require("./logger");

const PREFIX = "tr:";
const money = (n) => Number(n).toLocaleString("ru-RU");
const eph = MessageFlags.Ephemeral;

async function nameOf(guild, userId) {
  const member = await guild.members.fetch(userId).catch(() => null);
  return member?.displayName || member?.user?.username || "Участник";
}
async function userOf(client, userId) {
  return client.users.fetch(userId).catch(() => ({ id: userId, send: async () => null }));
}

// ---------- тексты ошибок ----------
function createReason(result) {
  const name = result.item?.name || "предмет";
  return ({
    self: "Нельзя меняться с самим собой.",
    invalid_amount: `Сумма монет должна быть от 0 до ${money(trade.MAX_COINS)}.`,
    empty_side: "С каждой стороны должно быть что-то: предмет или монеты.",
    coins_both: "Монеты можно указать только с одной стороны обмена.",
    unknown_item: "Такого предмета нет.",
    not_tradable: `«${name}» нельзя передавать: эксклюзивные значки за достижения остаются у владельца.`,
    not_owned: `У тебя нет предмета «${name}».`,
    partner_owns_give: `У партнёра уже есть «${name}», такой предмет ему не нужен.`,
    partner_lacks_take: `У партнёра нет предмета «${name}».`,
    you_own_take: `«${name}» уже есть у тебя.`,
    insufficient_funds: `Не хватает монет: нужно ${money(result.total || 0)} (с комиссией ${TRANSFER_FEE_PERCENT}%), у тебя ${money(result.balance || 0)}.`,
    too_many: `Нельзя держать больше ${trade.MAX_PENDING_PER_MEMBER} открытых предложений. Дождись ответа или отмени одно.`,
    pair_pending: "Между вами уже есть открытое предложение. Закончи его, потом создавай новое.",
    invalid_participants: "Не удалось определить участников.",
  })[result.reason] || "Предложение не создано. Попробуй позже.";
}
function failReason(code) {
  return ({
    not_tradable: "предмет нельзя передавать",
    sender_lost_item: "у отправителя больше нет его предмета",
    recipient_lost_item: "у получателя больше нет его предмета",
    recipient_owns: "у получателя уже есть этот предмет",
    sender_owns: "у отправителя уже есть этот предмет",
    sender_funds: "у отправителя не хватает монет",
    recipient_funds: "у получателя не хватает монет",
  })[code] || "условия изменились";
}

// ---------- карточка предложения ----------
async function offerData(guild, offer, status) {
  const [fromName, toName] = await Promise.all([nameOf(guild, offer.from_id), nameOf(guild, offer.to_id)]);
  const coins = Math.max(offer.give_coins, offer.take_coins);
  return {
    fromName, toName,
    giveItem: offer.give_item ? getItem(offer.give_item) : null, giveCoins: offer.give_coins,
    takeItem: offer.take_item ? getItem(offer.take_item) : null, takeCoins: offer.take_coins,
    fee: trade.feeFor(coins), payerName: offer.give_coins > 0 ? fromName : toName,
    status: status || offer.status, minutes: Math.round(trade.OFFER_TTL_MS / 60000),
  };
}
function offerButtons(id, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${PREFIX}a:${id}`).setLabel("Принять").setEmoji("✅").setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`${PREFIX}d:${id}`).setLabel("Отклонить").setEmoji("✖️").setStyle(ButtonStyle.Danger).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`${PREFIX}c:${id}`).setLabel("Отменить").setStyle(ButtonStyle.Secondary).setDisabled(disabled),
  );
}
async function offerMessage(guild, offer, status = null, note = "") {
  await preload();
  const data = await offerData(guild, offer, status);
  const file = new AttachmentBuilder(art.renderTradeCard(data), { name: `trade-${offer.id}.png` });
  const pending = (status || offer.status) === "pending";
  const head = pending
    ? `<@${offer.to_id}>, <@${offer.from_id}> предлагает тебе обмен. Нажми «Принять» или «Отклонить».`
    : `Обмен между <@${offer.from_id}> и <@${offer.to_id}>.`;
  return {
    content: [head, note].filter(Boolean).join("\n"),
    files: [file], attachments: [],
    components: pending ? [offerButtons(offer.id)] : [],
    allowedMentions: pending ? { users: [offer.to_id] } : { parse: [] },
  };
}

// Если никто не ответил, по истечении срока гасим кнопки.
function scheduleExpiry(message, guild, offerId) {
  const timer = setTimeout(async () => {
    try {
      trade.expireOffers(Date.now());
      const offer = trade.getOffer(offerId);
      if (!offer || offer.status !== "expired") return;
      await message.edit(await offerMessage(guild, offer, "expired"));
    } catch (error) { logger.debug(`Trade expiry edit failed: ${error.message || error}`); }
  }, trade.OFFER_TTL_MS + 1500);
  timer.unref?.();
}

// ---------- подсказки по предметам ----------
async function itemChoices(interaction, ownerId) {
  const focused = String(interaction.options.getFocused() || "").toLowerCase().trim();
  const items = trade.tradableInventory(interaction.guildId, ownerId)
    .filter((item) => !focused || item.name.toLowerCase().includes(focused) || item.id.toLowerCase().includes(focused))
    .slice(0, 25);
  await interaction.respond(items.map((item) => ({ name: `${item.name} · ${item.price > 0 ? `${money(item.price)} монет` : ""}`.slice(0, 100), value: item.id })));
}

// ---------- кнопки ----------
async function handle(interaction) {
  const [, action, ...rest] = interaction.customId.split(":");
  const guild = interaction.guild;
  if (!guild) return;
  try {
    if (action === "a" || action === "d" || action === "c") {
      const id = Number(rest[0]);
      const verb = { a: "accept", d: "decline", c: "cancel" }[action];
      const result = trade.respondOffer(id, interaction.user.id, verb);
      if (!result.ok) {
        if (result.reason === "not_recipient") return interaction.reply({ content: "Принять или отклонить может только тот, кому адресовано предложение.", flags: eph });
        if (result.reason === "not_sender") return interaction.reply({ content: "Отменить предложение может только тот, кто его создал.", flags: eph });
        if (result.reason === "not_found") return interaction.reply({ content: "Это предложение не найдено.", flags: eph });
        if (result.reason === "expired" || result.reason === "resolved" || result.reason === "failed") {
          const offer = result.offer || trade.getOffer(id);
          const note = result.reason === "failed" ? `Обмен не состоялся: ${failReason(result.fail)}.` : "";
          return interaction.update(await offerMessage(guild, offer, offer.status, note));
        }
        return interaction.reply({ content: "Не удалось обработать предложение.", flags: eph });
      }
      const offer = result.offer;
      await interaction.update(await offerMessage(guild, offer, result.status, result.status === "accepted" ? "Предметы и монеты переданы." : ""));
      if (result.status === "accepted") {
        const [sender, recipient] = await Promise.all([userOf(interaction.client, offer.from_id), userOf(interaction.client, offer.to_id)]);
        await refreshAchievements(guild, sender); await refreshAchievements(guild, recipient);
      }
      return undefined;
    }

    if (action === "gy") {
      const [toId, itemId] = rest;
      const result = trade.giftItem(guild.id, interaction.user.id, toId, itemId);
      if (!result.ok) {
        const text = ({ not_owned: "У тебя уже нет этого предмета.", recipient_owns: "У получателя уже есть этот предмет.", not_tradable: "Этот предмет нельзя дарить.", self: "Нельзя дарить самому себе." })[result.reason] || "Подарок не отправлен.";
        return interaction.update({ content: `❌ ${text}`, files: [], attachments: [], components: [] });
      }
      await preload();
      const fromName = await nameOf(guild, interaction.user.id); const toName = await nameOf(guild, toId);
      const card = new AttachmentBuilder(art.renderItemCard(result.item, { label: "Подарок", line1: `От ${fromName}`, line2: `Для ${toName}`, accent: "#ff7ad9" }), { name: "gift.png" });
      await interaction.update({ content: "🎁 Подарок отправлен!", files: [], attachments: [], components: [] });
      await interaction.followUp({ content: `🎁 <@${interaction.user.id}> дарит <@${toId}> предмет «${result.item.name}».`, files: [card], allowedMentions: { users: [toId] } }).catch(() => null);
      const recipient = await userOf(interaction.client, toId);
      await recipient.send?.({ content: `🎁 Участник **${fromName}** подарил тебе «${result.item.name}» на сервере **${guild.name}**. Надеть: \`/equip item_id:${result.item.id}\`.` }).catch(() => null);
      await refreshAchievements(guild, interaction.user); await refreshAchievements(guild, recipient);
      return undefined;
    }

    if (action === "sy") {
      const itemId = rest[0];
      const result = trade.sellItem(guild.id, interaction.user.id, itemId);
      if (!result.ok) {
        const text = ({ not_owned: "У тебя уже нет этого предмета.", not_tradable: "Этот предмет нельзя продать." })[result.reason] || "Продажа не выполнена.";
        return interaction.update({ content: `❌ ${text}`, files: [], attachments: [], components: [] });
      }
      await interaction.update({ content: `💰 Продано: «${result.item.name}». Получено **${money(result.refund)}** монет, баланс **${money(result.balance)}**.`, files: [], attachments: [], components: [] });
      await refreshAchievements(guild, interaction.user);
      return undefined;
    }

    if (action === "x") return interaction.update({ content: "Отменено.", files: [], attachments: [], components: [] });
  } catch (error) {
    logger.error("Trade interaction failed.", error);
    if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: "⚠️ Ошибка. Попробуй ещё раз.", flags: eph }).catch(() => null);
  }
  return undefined;
}

function confirmRow(yesId, label) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(yesId).setLabel(label).setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`${PREFIX}x`).setLabel("Отмена").setStyle(ButtonStyle.Secondary),
  );
}

module.exports = { PREFIX, handle, offerMessage, scheduleExpiry, itemChoices, createReason, confirmRow, nameOf, sellPrice, getBalance, money };
