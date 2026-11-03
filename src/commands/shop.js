const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const { CATALOG, RARITY_ORDER, getItemRarity } = require("../economy");
const { economyDisabled } = require("../economy-access");

const CATEGORY_LABELS = {
  Титулы: "🏷️ ТИТУЛЫ",
  Значки: "✨ ЗНАЧКИ",
  Баннеры: "🖼️ КАСТОМНЫЕ БАННЕРЫ",
  Цвета: "🎨 ЦВЕТА ПРОФИЛЯ",
};
const ITEM_STYLE = {
  title_joker: { emoji: "🃏" },
  title_gamer: { emoji: "🎮" },
  title_wanderer: { emoji: "🐾" },
  title_spark: { emoji: "⚡" },
  title_moonlit: { emoji: "🌙" },
  title_fox: { emoji: "🦊" },
  title_enigma: { emoji: "🎭" },
  title_iceborn: { emoji: "🧊" },
  title_eagle: { emoji: "🦅" },
  title_diamond: { emoji: "💎" },
  title_cosmic_wanderer: { emoji: "🌌" },
  title_sharpshooter: { emoji: "🎯" },
  title_observer: { emoji: "👁️" },
  title_warrior: { emoji: "⚔️" },
  title_dark_mage: { emoji: "🦇" },
  title_stellar: { emoji: "🌠" },
  title_dragon: { emoji: "🐉" },
  title_overlord: { emoji: "🔮" },
  title_dimension_keeper: { emoji: "🪬" },
  title_emperor: { emoji: "👑" },
  title_abyss_lord: { emoji: "🌑" },
  title_freedom_spirit: { emoji: "🕊️" },
  title_absolute: { emoji: "♛" },
  title_heavenly_archon: { emoji: "🪽" },
  title_beyond_reality: { emoji: "🪐" },
  title_absolute_legend: { emoji: "💠" },
  title_world_creator: { emoji: "🌌" },
  banner_ocean: { emoji: "🌊" },
  banner_forest: { emoji: "🌿" },
  banner_sunset: { emoji: "🌅" },
  banner_neon: { emoji: "💠" },
  banner_ice: { emoji: "❄️" },
  banner_shadow: { emoji: "🌑" },
  banner_galaxy: { emoji: "🌌" },
  banner_gold: { emoji: "👑" },
  banner_pumpkin: { emoji: "🎃" },
  banner_graveyard: { emoji: "👻" },
  banner_dawn: { emoji: "🌄" },
  banner_lake: { emoji: "🏞️" },
  banner_dunes: { emoji: "🏜️" },
  banner_sakura: { emoji: "🌸" },
  banner_storm: { emoji: "⛈️" },
  banner_autumn: { emoji: "🍂" },
  banner_megacity: { emoji: "🌃" },
  banner_orbit: { emoji: "🛰️" },
  banner_volcano: { emoji: "🌋" },
  banner_skycastle: { emoji: "🏰" },
  banner_moontemple: { emoji: "⛩️" },
  banner_phoenix: { emoji: "🔥" },
  banner_rift: { emoji: "🌀" },
  banner_fractal: { emoji: "🔮" },
  banner_worldtree: { emoji: "🌳" },
  banner_lavender: { emoji: "💜" },
  banner_camp: { emoji: "⛺" },
  banner_harbor: { emoji: "⛵" },
  banner_village: { emoji: "🏘️" },
  banner_tropic: { emoji: "🌴" },
  banner_bamboo: { emoji: "🎋" },
  banner_aurora: { emoji: "🌌" },
  banner_ghostship: { emoji: "☠️" },
  banner_steam: { emoji: "⚙️" },
  banner_ruins: { emoji: "🗿" },
  banner_dragoneye: { emoji: "🐉" },
  banner_bifrost: { emoji: "🌈" },
  banner_blackhole: { emoji: "🕳️" },
  banner_gem: { emoji: "💎" },
  banner_clock: { emoji: "🕰️" },
};
function sortCatalogItems(items) {
  const categoryOrder = ["Титулы", "Значки", "Баннеры", "Цвета"];
  return [...items].sort((a, b) => {
    const categoryDifference = categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
    if (categoryDifference !== 0) return categoryDifference;
    const rarityDifference = RARITY_ORDER.indexOf(getItemRarity(a)) - RARITY_ORDER.indexOf(getItemRarity(b));
    if (rarityDifference !== 0) return rarityDifference;
    return a.price - b.price || a.name.localeCompare(b.name, "ru");
  });
}
function itemLine(item) {
  const style = ITEM_STYLE[item.id] || {};
  const icon = style.emoji || (item.type === "title" ? "🏷️" : item.type === "badge" ? "✨" : item.type === "color" ? "🎨" : "🖼️");
  const rarity = getItemRarity(item);
  return `${icon} **${item.name}** · ${rarity.toLocaleUpperCase("ru-RU")}\n└ ${item.price.toLocaleString("ru-RU")} 🪙 · ID: \`${item.id}\``;
}

module.exports = {
  sortCatalogItems,
  data: new SlashCommandBuilder()
    .setName("shop")
    .setDescription("Открыть магазин оформления профиля.")
    .addStringOption((option) => option
      .setName("категория")
      .setDescription("Выбери раздел магазина")
      .setRequired(false)
      .addChoices(
        { name: "Все предметы", value: "all" },
        { name: "Титулы", value: "Титулы" },
        { name: "Значки", value: "Значки" },
        { name: "Кастомные баннеры", value: "Баннеры" },
        { name: "Цвета", value: "Цвета" },
      ))
    .addStringOption((option) => option
      .setName("редкость")
      .setDescription("Показать предметы выбранной редкости")
      .setRequired(false)
      .addChoices(
        { name: "Обычные", value: "Обычный" },
        { name: "Редкие", value: "Редкий" },
        { name: "Эпические", value: "Эпический" },
        { name: "Легендарные", value: "Легендарный" },
        { name: "Мифические", value: "Мифический" },
      )),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: "Магазин доступен только на сервере.", flags: MessageFlags.Ephemeral });
    }
    if (await economyDisabled(interaction)) return;

    // Both filters are optional: opening /shop without options shows the full catalog.
    const category = interaction.options.getString("категория") || "all";
    const rarityFilter = interaction.options.getString("редкость") || null;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const filtered = CATALOG.filter((item) =>
      (category === "all" || item.category === category) &&
      (!rarityFilter || getItemRarity(item) === rarityFilter));
    const items = sortCatalogItems(filtered);
    const banners = items.filter((item) => item.category === "Баннеры");
    const description = [
        "╭━━━━━━━━━━━━━━━━━━━━╮",
        "　**МАГАЗИН ПЕРСОНАЛИЗАЦИИ**",
        "　Собери стиль, который узнают с первого взгляда.",
        "╰━━━━━━━━━━━━━━━━━━━━╯",
        "",
        "🪙 **Покупка навсегда** · предмет останется в коллекции.",
        "🎒 Купи предмет → примени через `/equip` → посмотри в `/profile`.",
        rarityFilter ? `**Редкость:** ${rarityFilter}` : null,
        `**Предметов в разделе:** ${items.length}`,
      ].filter(Boolean).join("\n");
    const embeds = [];
    const createEmbed = () => new EmbedBuilder()
      .setColor(0x7C5CFC)
      .setTitle("✦ HERADELEGEND · ATELIER")
      .setDescription(description)
      .setFooter({ text: "HeradeLegend Atelier · Твой профиль — твой стиль" });
    let embed = createEmbed();
    let embedSize = embed.data.title.length + description.length + embed.data.footer.text.length;
    const addPagedField = (field) => {
      const fieldSize = field.name.length + field.value.length;
      if (embedSize + fieldSize > 5400 || (embed.data.fields || []).length >= 25) {
        embeds.push(embed);
        embed = createEmbed();
        embedSize = embed.data.title.length + description.length + embed.data.footer.text.length;
      }
      embed.addFields(field);
      embedSize += fieldSize;
    };

    const categoryOrder = ["Титулы", "Значки", "Баннеры", "Цвета"];
    const rarityEmoji = {
      Обычный: "⚪",
      Редкий: "🔹",
      Эпический: "🟣",
      Легендарный: "🟠",
      Мифический: "💠",
    };
    const renderCategory = (itemCategory) => {
      const categoryItems = items.filter((item) => item.category === itemCategory);
      if (!categoryItems.length) return;
      for (const rarity of RARITY_ORDER) {
        const group = categoryItems
          .filter((item) => getItemRarity(item) === rarity)
          .sort((a, b) => a.price - b.price || a.name.localeCompare(b.name, "ru"));
        if (!group.length) continue;
        for (let i = 0; i < group.length; i += 5) {
          const chunk = group.slice(i, i + 5);
          const range = group.length > 5 ? ` · ${i + 1}–${i + chunk.length}` : "";
          addPagedField({
            name: `${i === 0 ? CATEGORY_LABELS[itemCategory] : "↳ Продолжение"} · ${rarityEmoji[rarity]} ${rarity.toLocaleUpperCase("ru-RU")}${range}`,
            value: chunk.map(itemLine).join("\n\n"),
            inline: false,
          });
        }
      }
    };

    if (category === "all") {
      for (const itemCategory of categoryOrder) renderCategory(itemCategory);
    } else if (items.length) {
      renderCategory(category);
    } else {
      addPagedField({ name: CATEGORY_LABELS[category] || category, value: "Пока здесь пусто — загляни позже." });
    }

    if (banners.length) {
      const bannerPreview = banners
        .slice()
        .sort((a, b) => a.price - b.price || a.name.localeCompare(b.name, "ru"))
        .map((item) => `${ITEM_STYLE[item.id]?.emoji || "🖼️"} ${item.name} — ${item.price.toLocaleString("ru-RU")} 🪙`)
        .join("\n");
      const bannerLines = bannerPreview.split("\n");
      for (let i = 0; i < bannerLines.length; i += 12) {
        addPagedField({
          name: i === 0 ? "🖼️ ПОДБОРКА БАННЕРОВ · ОТ ДОСТУПНЫХ К ПРЕМИАЛЬНЫМ" : "🖼️ ПОДБОРКА БАННЕРОВ · ПРОДОЛЖЕНИЕ",
          value: bannerLines.slice(i, i + 12).join("\n") + (i + 12 >= bannerLines.length ? "\n\nКаждый баннер меняет атмосферу карточки профиля." : ""),
          inline: false,
        });
      }
    }
    addPagedField({
      name: "🛒 КАК ЗАБРАТЬ ПРЕДМЕТ",
      value: "1. Скопируй ID из каталога.\n2. Используй `/buy item_id:<ID>`.\n3. Активируй через `/equip item_id:<ID>`.\n4. Проверь результат командой `/profile`.\n\n`/inventory` — твоя личная коллекция · `/daily` — ежедневные монеты.",
      inline: false,
    });
    embeds.push(embed);

    // Discord limits the combined embed text in a single message to 6000 characters.
    // Send each catalog page as a separate ephemeral message to avoid MAX_EMBED_SIZE_EXCEEDED.
    await interaction.editReply({ embeds: [embeds[0]] });
    for (const page of embeds.slice(1)) {
      await interaction.followUp({ embeds: [page], flags: MessageFlags.Ephemeral });
    }
  },
};
