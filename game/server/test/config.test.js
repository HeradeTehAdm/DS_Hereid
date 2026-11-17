const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { readConfig } = require("../src/config");

test("uses safe defaults and a separate game database", () => {
  const config = readConfig({});
  assert.equal(config.host, "0.0.0.0");
  assert.equal(config.port, 3100);
  assert.equal(config.nodeEnv, "development");
  assert.equal(config.logLevel, "info");
  assert.equal(config.databasePath, path.resolve(__dirname, "../data/heradetale.sqlite"));
});

test("accepts a configured database path", () => {
  assert.equal(readConfig({ DATABASE_PATH: "/data/game.sqlite" }).databasePath, path.resolve("/data/game.sqlite"));
});

test("rejects invalid port", () => {
  assert.throws(() => readConfig({ PORT: "70000" }), /PORT/);
});

test("rejects invalid log level", () => {
  assert.throws(() => readConfig({ LOG_LEVEL: "verbose" }), /LOG_LEVEL/);
});
