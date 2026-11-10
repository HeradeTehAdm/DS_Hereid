require("dotenv").config();

const VALID_LOG_LEVELS = new Set(["error", "warn", "info", "debug"]);
const SNOWFLAKE_PATTERN = /^\d{17,20}$/;

function required(name) {
  const value = process.env[name]?.trim();
  if (!value || value.startsWith("PUT_")) {
    throw new Error(`Missing configuration: ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

function requiredSnowflake(name) {
  const value = required(name);
  if (!SNOWFLAKE_PATTERN.test(value)) {
    throw new Error(`Invalid configuration: ${name} must be a Discord ID containing 17–20 digits.`);
  }
  return value;
}

const minecraftApiToken = process.env.HERADE_CORE_API_TOKEN?.trim() || "";
const minecraftApiHost = process.env.HERADE_CORE_API_HOST?.trim() || "127.0.0.1";
const minecraftApiPort = Number(process.env.HERADE_CORE_API_PORT || 3068);
if (!Number.isInteger(minecraftApiPort) || minecraftApiPort < 1 || minecraftApiPort > 65535) {
  throw new Error("Invalid HERADE_CORE_API_PORT: use an integer from 1 to 65535.");
}
if (minecraftApiToken && Buffer.byteLength(minecraftApiToken, "utf8") < 32) {
  throw new Error("HERADE_CORE_API_TOKEN must contain at least 32 UTF-8 bytes.");
}

const logLevel = (process.env.LOG_LEVEL || "info").trim().toLowerCase();
if (!VALID_LOG_LEVELS.has(logLevel)) {
  throw new Error(`Invalid LOG_LEVEL: use one of ${[...VALID_LOG_LEVELS].join(", ")}.`);
}

const ownerIds = (process.env.BOT_OWNER_IDS || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

for (const id of ownerIds) {
  if (!SNOWFLAKE_PATTERN.test(id)) {
    throw new Error("Invalid BOT_OWNER_IDS: provide comma-separated Discord IDs containing 17–20 digits.");
  }
}

module.exports = {
  token: required("DISCORD_TOKEN"),
  clientId: requiredSnowflake("CLIENT_ID"),
  guildId: requiredSnowflake("GUILD_ID"),
  ownerIds,
  databasePath: process.env.DATABASE_PATH?.trim() || "./data/bot.sqlite",
  logLevel,
  minecraftApiToken,
  minecraftApiHost,
  minecraftApiPort,
};
