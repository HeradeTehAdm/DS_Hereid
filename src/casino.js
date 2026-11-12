// Казино на монеты сервера: слоты, монетка и рулетка. Монеты виртуальные, шансы честные и показаны в правилах.
const crypto = require("node:crypto");
const {
  ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
  MessageFlags, StringSelectMenuBuilder,
} = require("discord.js");
const { CASINO_MIN_BET, CASINO_MAX_BET, getBalance, getCasinoStats, settleCasinoBet } = require("./economy");
const { isFeatureEnabled } = require("./features");
const art = require("./casino-art");

const PREFIX = "cas";
const DEFAULT_BET = 100;
const BET_PRESETS = [50, 100, 250, 500, 1000, 2500, 5000, 10000];
const GAMES = {
  slots: { label: "Слоты", emoji: "🎰" },
  coin: { label: "Монетка", emoji: "🪙" },
  roulette: { label: "Рулетка", emoji: "🎡" },
};
const config = { animationMs: 850, cooldownMs: 1200 };
let random = (max) => crypto.randomInt(0, max); // подменяется в тестах
function setRandom(fn) { random = fn || ((max) => crypto.randomInt(0, max)); }

// ---------- слоты ----------
const REEL = [["cherry", 30], ["lemon", 26], ["bell", 18], ["star", 12], ["diamond", 8], ["seven", 6]];
const REEL_TOTAL = REEL.reduce((sum, [, weight]) => sum + weight, 0);
const TRIPLE = { cherry: 4, lemon: 6, bell: 12, star: 25, diamond: 60, seven: 150 };
const CHERRY_PAIR = 2;
const CHERRY_SINGLE = 0.4;
const SLOT_EMOJI = { cherry: "🍒", lemon: "🍋", bell: "🔔", star: "⭐", diamond: "💎", seven: "7️⃣" };
function spinReel() {
  let roll = random(REEL_TOTAL);
  for (const [symbol, weight] of REEL) { if (roll < weight) return symbol; roll -= weight; }
  return REEL[0][0];
}
function slotsMultiplier(reels) {
  if (reels[0] === reels[1] && reels[1] === reels[2]) return TRIPLE[reels[0]];
  const cherries = reels.filter((r) => r === "cherry").length;
  if (cherries === 2) return CHERRY_PAIR;
  if (cherries === 1) return CHERRY_SINGLE;
  return 0;
}
function slotsRtp() {
  let rtp = 0;
  for (const a of REEL) for (const b of REEL) for (const c of REEL) {
    rtp += (a[1] / REEL_TOTAL) * (b[1] / REEL_TOTAL) * (c[1] / REEL_TOTAL) * slotsMultiplier([a[0], b[0], c[0]]);
  }
  return rtp;
}
function playSlots(bet) {
  const reels = [spinReel(), spinReel(), spinReel()];
  const multiplier = slotsMultiplier(reels);
  const triple = reels[0] === reels[1] && reels[1] === reels[2];
  const win = reels.map((symbol) => triple || (multiplier > 0 && symbol === "cherry"));
  return { reels, multiplier, payout: Math.floor(bet * multiplier), win, detail: reels.map((r) => SLOT_EMOJI[r]).join("") };
}

// ---------- монетка ----------
const COIN_MULTIPLIER = 1.95;
function playCoin(bet, choice) {
  const face = random(2) === 0 ? "heads" : "tails";
  const won = face === choice;
  return { face, won, payout: won ? Math.floor(bet * COIN_MULTIPLIER) : 0, detail: `${choice}→${face}` };
}

// ---------- рулетка (европейская, 37 ячеек) ----------
const ROULETTE_MULTIPLIER = { red: 2, black: 2, green: 36 };
function rouletteColor(number) { return number === 0 ? "green" : art.RED_NUMBERS.has(number) ? "red" : "black"; }
function playRoulette(bet, choice) {
  const number = random(37);
  const color = rouletteColor(number);
  const won = color === choice;
  return { number, color, won, payout: won ? bet * ROULETTE_MULTIPLIER[choice] : 0, detail: `${choice}→${number}` };
}

// ---------- интерфейс ----------
const money = (n) => Number(n).toLocaleString("ru-RU");
const busy = new Set();
const lastPlay = new Map();
const sleep = (ms) => (ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve());
const COLOR_LABEL = { red: "🔴 красное", black: "⚫ чёрное", green: "🟢 зеро" };
const COLOR_TEXT = { red: "красное", black: "чёрное", green: "зеро" };
const COIN_LABEL = { heads: "Орёл", tails: "Решка" };

function rulesText(game) {
  if (game === "slots") {
    return [
      "**Слоты:** три барабана, выигрыш по центральной линии.",
      `3 в ряд: 🍒 ×${TRIPLE.cherry} · 🍋 ×${TRIPLE.lemon} · 🔔 ×${TRIPLE.bell} · ⭐ ×${TRIPLE.star} · 💎 ×${TRIPLE.diamond} · 7️⃣ ×${TRIPLE.seven}`,
      `Две 🍒 — ×${CHERRY_PAIR} · одна 🍒 — ×${CHERRY_SINGLE}`,
    ].join("\n");
  }
  if (game === "coin") return `**Монетка:** выбери орла или решку. Угадал — выплата ×${COIN_MULTIPLIER}.`;
  return "**Рулетка:** красное или чёрное — ×2, зеро — ×36 (37 ячеек, как в европейской рулетке).";
}

function actionRow(game, bet, balance, disabled) {
  const cant = disabled || balance < bet;
  const button = (id, label, style = ButtonStyle.Success, emoji) => {
    const b = new ButtonBuilder().setCustomId(`${PREFIX}:play:${game}:${bet}:${id}`).setLabel(label).setStyle(style).setDisabled(cant);
    if (emoji) b.setEmoji(emoji);
    return b;
  };
  if (game === "slots") return new ActionRowBuilder().addComponents(button("spin", `Крутить за ${money(bet)}`, ButtonStyle.Success, "🎰"));
  if (game === "coin") return new ActionRowBuilder().addComponents(button("heads", "Орёл", ButtonStyle.Primary, "🦅"), button("tails", "Решка", ButtonStyle.Primary, "🪙"));
  return new ActionRowBuilder().addComponents(button("red", "Красное ×2", ButtonStyle.Danger, "🔴"), button("black", "Чёрное ×2", ButtonStyle.Secondary, "⚫"), button("green", "Зеро ×36", ButtonStyle.Success, "🟢"));
}

function buildPayload(guildId, userId, { game = "slots", bet = DEFAULT_BET, note = null, image = null, color = 0x7C5CFC, disabled = false } = {}) {
  const balance = getBalance(guildId, userId).balance;
  const stats = getCasinoStats(guildId, userId);
  const g = GAMES[game];
  const embed = new EmbedBuilder().setColor(color)
    .setTitle(`${g.emoji} КАЗИНО HERADE · ${g.label.toUpperCase()}`)
    .setDescription([
      note || null,
      `Твой баланс: **${money(balance)}** 🪙 · ставка: **${money(bet)}** 🪙`,
      balance < bet ? "⚠️ Не хватает монет на такую ставку — выбери меньше или заработай через `/daily` и задания." : null,
      "",
      rulesText(game),
    ].filter((line) => line !== null).join("\n"))
    .setFooter({ text: `Ставка от ${money(CASINO_MIN_BET)} до ${money(CASINO_MAX_BET)} · монеты виртуальные, играй в удовольствие${stats.games ? ` · игр: ${stats.games}, рекорд выигрыша: ${money(stats.bestWin)}` : ""}` });
  const files = [];
  if (image) { embed.setImage("attachment://casino.png"); files.push(new AttachmentBuilder(image, { name: "casino.png" })); }
  const options = [...BET_PRESETS.map((value) => ({ label: `${money(value)} монет`, value: String(value), default: value === bet })), { label: "Ва-банк (максимум)", value: "max", emoji: "🔥" }];
  const components = [
    new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`${PREFIX}:bet:${game}:${bet}`).setPlaceholder(`Ставка: ${money(bet)} монет`).setDisabled(disabled).addOptions(options)),
    new ActionRowBuilder().addComponents(...Object.entries(GAMES).map(([key, info]) => new ButtonBuilder()
      .setCustomId(`${PREFIX}:game:${key}:${bet}`).setLabel(info.label).setEmoji(info.emoji)
      .setStyle(key === game ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(disabled || key === game))),
    actionRow(game, bet, balance, disabled),
    new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`${PREFIX}:shop`).setLabel("В магазин").setEmoji("🛍️").setStyle(ButtonStyle.Secondary).setDisabled(disabled)),
  ];
  return { embeds: [embed], files, components, attachments: [] };
}

function openPayload(guildId, userId, game = "slots") {
  const balance = getBalance(guildId, userId).balance;
  const bet = Math.min(DEFAULT_BET, Math.max(CASINO_MIN_BET, balance)) || DEFAULT_BET;
  return buildPayload(guildId, userId, { game, bet: Math.max(CASINO_MIN_BET, Math.min(DEFAULT_BET, bet)), image: game === "slots" ? art.renderSlots([null, null, null], { caption: "Сделай ставку и крути!" }) : null });
}

function resultNote(bet, payout, balance) {
  const net = payout - bet;
  if (net > 0) return `🎉 **Выигрыш +${money(net)}** 🪙 (выплата ${money(payout)})`;
  if (net === 0) return "🤝 Ставка возвращена.";
  return payout > 0 ? `😕 Возврат ${money(payout)} из ${money(bet)} · минус **${money(-net)}** 🪙` : `💸 Проигрыш **−${money(bet)}** 🪙`;
}

async function play(interaction, game, bet, choice) {
  const { guildId } = interaction; const userId = interaction.user.id;
  if (!GAMES[game] || !Number.isSafeInteger(bet) || bet < CASINO_MIN_BET || bet > CASINO_MAX_BET) { await interaction.deferUpdate(); return; }
  const key = `${guildId}:${userId}`;
  if (busy.has(key) || Date.now() - (lastPlay.get(key) || 0) < config.cooldownMs) { await interaction.deferUpdate(); return; }
  busy.add(key);
  try {
    if (getBalance(guildId, userId).balance < bet) {
      await interaction.update(buildPayload(guildId, userId, { game, bet, note: "❌ Недостаточно монет для такой ставки.", color: 0xED4245 }));
      return;
    }
    let outcome;
    if (game === "slots") outcome = playSlots(bet);
    else if (game === "coin") { if (!COIN_LABEL[choice]) { await interaction.deferUpdate(); return; } outcome = playCoin(bet, choice); }
    else { if (!ROULETTE_MULTIPLIER[choice]) { await interaction.deferUpdate(); return; } outcome = playRoulette(bet, choice); }
    // Деньги списываются и начисляются сразу и атомарно, анимация только показывает уже готовый результат.
    const settled = settleCasinoBet(guildId, userId, game, bet, outcome.payout, outcome.detail);
    lastPlay.set(key, Date.now());
    if (!settled.ok) {
      await interaction.update(buildPayload(guildId, userId, { game, bet, note: "❌ Недостаточно монет для такой ставки.", color: 0xED4245 }));
      return;
    }
    const net = settled.net;
    const color = net > 0 ? 0x57F287 : net === 0 ? 0xFEE75C : 0xED4245;
    const note = resultNote(bet, outcome.payout, settled.balance);
    if (game === "slots") {
      const spinning = (i) => art.renderSlots(i >= 3 ? outcome.reels : outcome.reels.map((r, idx) => (idx < i ? r : null)), { blur: [i <= 0, i <= 1, i <= 2], caption: i >= 3 ? "" : "Крутим…" });
      await interaction.update(buildPayload(guildId, userId, { game, bet, note: "🎰 Барабаны крутятся…", image: spinning(0), disabled: true }));
      await sleep(config.animationMs);
      await interaction.editReply(buildPayload(guildId, userId, { game, bet, note: "🎰 Барабаны крутятся…", image: spinning(1), disabled: true }));
      await sleep(config.animationMs);
      await interaction.editReply(buildPayload(guildId, userId, { game, bet, note: "🎰 Последний барабан…", image: spinning(2), disabled: true }));
      await sleep(config.animationMs);
      const caption = outcome.multiplier >= TRIPLE.seven ? "ДЖЕКПОТ! ×" + outcome.multiplier : outcome.multiplier > 0 ? `×${outcome.multiplier}` : "Не повезло";
      const image = art.renderSlots(outcome.reels, { win: outcome.win, caption, captionColor: net > 0 ? "#7dffb8" : net === 0 ? "#ffe27a" : "#ff8a8a" });
      await interaction.editReply(buildPayload(guildId, userId, { game, bet, note: `${note}\n${outcome.detail}`, image, color }));
    } else if (game === "coin") {
      await interaction.update(buildPayload(guildId, userId, { game, bet, note: "🪙 Монета в воздухе…", image: art.renderCoin(null, { title: "Подбрасываем…", sub: [`Ты выбрал: ${COIN_LABEL[choice]}`] }), disabled: true }));
      await sleep(config.animationMs);
      const image = art.renderCoin(outcome.face, { title: outcome.won ? "Угадал!" : "Не угадал", sub: [`Выпало: ${COIN_LABEL[outcome.face]}`, `Ты выбрал: ${COIN_LABEL[choice]}`], color: outcome.won ? "#7dffb8" : "#ff8a8a" });
      await interaction.editReply(buildPayload(guildId, userId, { game, bet, note, image, color }));
    } else {
      await interaction.update(buildPayload(guildId, userId, { game, bet, note: "🎡 Шарик катится…", image: art.renderRoulette(null, { title: "Крутим…", sub: [`Ставка: ${COLOR_TEXT[choice]}`] }), disabled: true }));
      await sleep(config.animationMs);
      const image = art.renderRoulette(outcome.number, { title: outcome.won ? "Выигрыш!" : "Мимо", sub: [`Выпало ${outcome.number} · ${COLOR_TEXT[outcome.color]}`, `Твоя ставка: ${COLOR_TEXT[choice]}`], color: outcome.won ? "#7dffb8" : "#ff8a8a" });
      await interaction.editReply(buildPayload(guildId, userId, { game, bet, note, image, color }));
    }
  } finally {
    busy.delete(key);
  }
}

async function handle(interaction) {
  const [, action, game, rawBet, choice] = interaction.customId.split(":");
  if (!interaction.inGuild() || !isFeatureEnabled(interaction.guildId, "economy")) {
    await interaction.reply({ content: "Экономика сейчас недоступна.", flags: MessageFlags.Ephemeral });
    return;
  }
  const { guildId } = interaction; const userId = interaction.user.id;
  const gameKey = GAMES[game] ? game : "slots";
  const bet = Math.min(CASINO_MAX_BET, Math.max(CASINO_MIN_BET, Number(rawBet) || DEFAULT_BET));
  if (action === "shop") {
    const shopBrowser = require("./shop-browser");
    await interaction.update(await shopBrowser.openBrowser(guildId, userId, { mode: "t" }));
    return;
  }
  if (action === "game") {
    await interaction.update(buildPayload(guildId, userId, { game: gameKey, bet, image: gameKey === "slots" ? art.renderSlots([null, null, null], { caption: "Сделай ставку и крути!" }) : null }));
    return;
  }
  if (action === "bet" && interaction.isStringSelectMenu()) {
    const value = interaction.values[0];
    const chosen = value === "max" ? Math.max(CASINO_MIN_BET, Math.min(CASINO_MAX_BET, getBalance(guildId, userId).balance)) : Math.min(CASINO_MAX_BET, Math.max(CASINO_MIN_BET, Number(value) || DEFAULT_BET));
    await interaction.update(buildPayload(guildId, userId, { game: gameKey, bet: chosen, image: gameKey === "slots" ? art.renderSlots([null, null, null], { caption: "Сделай ставку и крути!" }) : null }));
    return;
  }
  if (action === "play") { await play(interaction, gameKey, Number(rawBet), choice); return; }
  await interaction.reply({ content: "⚠️ Это действие больше недоступно. Открой казино заново: /casino.", flags: MessageFlags.Ephemeral });
}

module.exports = {
  PREFIX, GAMES, TRIPLE, CHERRY_PAIR, CHERRY_SINGLE, COIN_MULTIPLIER, ROULETTE_MULTIPLIER, config,
  setRandom, slotsMultiplier, slotsRtp, playSlots, playCoin, playRoulette, rouletteColor,
  buildPayload, openPayload, handle,
};
