import assert from "node:assert/strict";
import { test } from "node:test";
import { authorizedSyncWorker } from "../lib/sync-auth.js";

test("sync worker auth denies missing and incorrect secrets", () => {
  const previous = process.env.SPIRIT_SYNC_SECRET;
  try {
    process.env.SPIRIT_SYNC_SECRET = "s".repeat(48);
    assert.equal(authorizedSyncWorker({ headers: {} }), false);
    assert.equal(authorizedSyncWorker({ headers: { "x-spirit-sync-secret": "bad" } }), false);
    assert.equal(authorizedSyncWorker({ headers: { "x-spirit-sync-secret": "s".repeat(48) } }), true);
    process.env.SPIRIT_SYNC_SECRET = "tiny";
    assert.equal(authorizedSyncWorker({ headers: { "x-spirit-sync-secret": "tiny" } }), false);
  } finally {
    if (previous === undefined) delete process.env.SPIRIT_SYNC_SECRET;
    else process.env.SPIRIT_SYNC_SECRET = previous;
  }
});
