const test = require("node:test");
const assert = require("node:assert/strict");
const { readConfig } = require("../src/config");

test("uses safe defaults", () => {
  assert.deepEqual(readConfig({}), {
    host: "0.0.0.0",
    port: 3100,
    nodeEnv: "development",
    logLevel: "info",
  });
});

test("rejects invalid port", () => {
  assert.throws(() => readConfig({ PORT: "70000" }), /PORT/);
});

test("rejects invalid log level", () => {
  assert.throws(() => readConfig({ LOG_LEVEL: "verbose" }), /LOG_LEVEL/);
});
