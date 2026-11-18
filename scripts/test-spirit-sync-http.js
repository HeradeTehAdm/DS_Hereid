"use strict";
const assert = require("node:assert/strict");
const { createSyncClient, RESPONSE_LIMIT_BYTES } = require("../src/spirit-sync-http");

async function main() {
  assert.throws(() => createSyncClient({ family: 3 }), /Invalid IP family/);
  assert.throws(() => createSyncClient({ timeoutMs: 100 }), /Invalid network timeout/);
  const client = createSyncClient({ family: 4 });
  try {
    await assert.rejects(() => client.requestJson(new URL("http://example.com/api")), /Only trusted HTTPS/);
    await assert.rejects(() => client.requestJson(new URL("https://user:password@example.com/")), /Only trusted HTTPS/);
    await assert.rejects(() => client.requestJson(new URL("https://example.com/"), { method: "DELETE" }), /Unsupported sync method/);
    await assert.rejects(() => client.requestJson(new URL("https://example.com/"), {
      method: "POST", body: { padding: "x".repeat(RESPONSE_LIMIT_BYTES + 1) },
    }), /Sync payload exceeds size limit/);
  } finally {
    client.close();
  }
  console.log("Spirit outbound HTTPS safety checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
