"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");

process.env.DISCORD_TOKEN = "test-token";
process.env.CLIENT_ID = "12345678901234567";
process.env.GUILD_ID = "12345678901234568";
process.env.SPIRIT_SYNC_SECRET = "s".repeat(40);

const profileModule = require.resolve("../src/spirit-profile-api");
const clientModule = require.resolve("../src/spirit-sync-http");
const diagnosticModule = require.resolve("../src/spirit-sync-diagnostics");
const original = new Map();
for (const key of [profileModule, clientModule, diagnosticModule]) {
  original.set(key, require.cache[key]);
}

let pending = ["1162369809661571132"];
let posted = 0;
const events = [];
const logger = {
  info: (message) => events.push(["info", message]),
  warn: (message) => events.push(["warn", message]),
};
function inject(key, exports) {
  require.cache[key] = { id: key, filename: key, loaded: true, exports };
}
inject(profileModule, {
  createProfileReader: () => () => ({ level: 3, xp: 420 }),
});
inject(clientModule, {
  createSyncClient: () => ({
    async requestJson(url, opts = {}) {
      if (url.pathname.endsWith("/jobs")) return {
        ok: true, status: 200, data: { userIds: pending },
      };
      assert.equal(opts.method, "POST");
      assert.equal(opts.body.userId, pending[0]);
      posted++;
      return { ok: true, status: 200, data: { ok: true } };
    },
    close() {},
  }),
});
inject(diagnosticModule, { diagnoseSpiritConnectivity: async () => {} });

async function main() {
  const { startSpiritOutboundSync } = require("../src/spirit-outbound-sync");
  const service = startSpiritOutboundSync({
    db: {}, config: { guildId: process.env.GUILD_ID }, logger,
  });
  try {
    // The service polls once immediately on startup.
    for (let i = 0; i < 20 && posted === 0; i++) {
      await new Promise(resolve => setImmediate(resolve));
    }
    assert.equal(posted, 1);
    assert.ok(events.some(([level, msg]) =>
      level === "info" && msg.includes("jobs endpoint HTTP 200, pending=1")));
    assert.ok(events.some(([level, msg]) =>
      level === "info" && msg.includes("completed 1 profile update(s)")));
    assert.ok(!events.some(([level]) => level === "warn"));
    console.log("Spirit sync observability checks passed");
  } finally {
    await service.close();
    for (const [key, value] of original) {
      if (value === undefined) delete require.cache[key];
      else require.cache[key] = value;
    }
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
