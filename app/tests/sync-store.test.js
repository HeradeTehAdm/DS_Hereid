import assert from "node:assert/strict";
import { test } from "node:test";
import { getCachedOrRequest, syncDatabase } from "../lib/sync-store.js";

test("sync queue stays disabled without a database", async () => {
  const old = process.env.SPIRIT_SYNC_DATABASE_URL;
  try {
    delete process.env.SPIRIT_SYNC_DATABASE_URL;
    assert.equal(syncDatabase(), null);
    assert.deepEqual(await getCachedOrRequest("123456789012345678"), {
      profile: null, sync: "not_configured",
    });
  } finally {
    if (old === undefined) delete process.env.SPIRIT_SYNC_DATABASE_URL;
    else process.env.SPIRIT_SYNC_DATABASE_URL = old;
  }
});

test("sync queue rejects user IDs that are not Discord snowflakes", async () => {
  await assert.rejects(() => getCachedOrRequest("other"), /Invalid member ID/);
  await assert.rejects(() => getCachedOrRequest("1 OR 1=1"), /Invalid member ID/);
});
