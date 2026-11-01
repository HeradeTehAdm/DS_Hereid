const VALID_LOG_LEVELS = new Set(["error", "warn", "info", "debug"]);

function readConfig(env = process.env) {
  const host = (env.HOST || "0.0.0.0").trim();
  const port = Number(env.PORT || 3100);
  const nodeEnv = (env.NODE_ENV || "development").trim();
  const logLevel = (env.LOG_LEVEL || "info").trim().toLowerCase();

  if (!host) throw new Error("HOST must not be empty.");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  if (!VALID_LOG_LEVELS.has(logLevel)) {
    throw new Error(`Invalid LOG_LEVEL. Use: ${[...VALID_LOG_LEVELS].join(", ")}.`);
  }

  return Object.freeze({ host, port, nodeEnv, logLevel });
}

module.exports = { readConfig };
