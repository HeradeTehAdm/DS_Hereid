"use strict";
const assert = require("node:assert/strict");
const { createSyncClient, RESPONSE_LIMIT_BYTES } = require("../src/spirit-sync-http");
const https = require("node:https");
const dns = require("node:dns").promises;
const { EventEmitter } = require("node:events");

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
  const lookup = dns.lookup;
  const request = https.request;
  const selected = [];
  const fallbackClient = createSyncClient({ family: 4, timeoutMs: 1200 });
  try {
    dns.lookup = async () => [
      { address: "192.0.2.10", family: 4 },
      { address: "192.0.2.11", family: 4 },
    ];
    https.request = (url, options, responseHandler) => {
      assert.equal(url.hostname, "duh-svobody-app.vercel.app", "TLS hostname must not change during address fallback");
      const stream = new EventEmitter();
      stream.end = () => {
        options.lookup(url.hostname, {}, (err, address) => {
          assert.equal(err, null);
          selected.push(address);
          queueMicrotask(() => {
            if (address === "192.0.2.10") {
              stream.emit("error", Object.assign(new Error("connect timed out"), { code: "ETIMEDOUT" }));
            } else {
              const response = new EventEmitter();
              response.statusCode = 200;
              responseHandler(response);
              response.emit("data", Buffer.from('{"ok":true}'));
              response.emit("end");
            }
          });
        });
      };
      return stream;
    };
    const result = await fallbackClient.requestJson(new URL("https://duh-svobody-app.vercel.app/api/sync/jobs"));
    assert.deepEqual(result.data, { ok: true });
    assert.deepEqual(selected, ["192.0.2.10", "192.0.2.11"]);
  } finally {
    dns.lookup = lookup;
    https.request = request;
    fallbackClient.close();
  }
  console.log("Spirit outbound HTTPS safety checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
