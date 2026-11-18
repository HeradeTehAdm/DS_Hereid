"use strict";

const https = require("node:https");

const RESPONSE_LIMIT_BYTES = 1024 * 1024;
const REQUEST_TIMEOUT_MS = 20000;

// Native HTTPS supports a deterministic IPv4 connection on hosts with broken IPv6.
// TLS verification and SNI stay enabled; never fall back to plaintext HTTP.
function createSyncClient({ family = 4, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  if (![0, 4, 6].includes(family)) throw new Error("Invalid IP family.");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000) {
    throw new Error("Invalid network timeout.");
  }
  const agent = new https.Agent({ keepAlive: true, family: family || undefined, maxSockets: 2 });

  async function requestJson(url, { method = "GET", headers = {}, body } = {}) {
    if (!(url instanceof URL) || url.protocol !== "https:" || url.username || url.password) {
      throw new Error("Only trusted HTTPS destinations are supported.");
    }
    if (!["GET", "POST"].includes(method)) throw new Error("Unsupported sync method.");
    const payload = body === undefined ? null : JSON.stringify(body);
    if (payload && Buffer.byteLength(payload) > RESPONSE_LIMIT_BYTES) {
      throw new Error("Sync payload exceeds size limit.");
    }
    return new Promise((resolve, reject) => {
      const req = https.request(url, {
        agent, method,
        headers: {
          ...headers,
          ...(payload === null ? {} : {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
          }),
        },
        signal: AbortSignal.timeout(timeoutMs),
        maxHeaderSize: 16384,
      }, (res) => {
        const chunks = [];
        let bytes = 0;
        res.on("data", (chunk) => {
          bytes += chunk.length;
          if (bytes > RESPONSE_LIMIT_BYTES) {
            req.destroy(Object.assign(new Error("Sync response too large"), { code: "SYNC_RESPONSE_TOO_LARGE" }));
          } else chunks.push(chunk);
        });
        res.on("end", () => {
          let data;
          try {
            data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          } catch {
            reject(Object.assign(new Error("Invalid JSON from sync endpoint"), { code: "SYNC_INVALID_JSON" }));
            return;
          }
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data });
        });
        res.on("error", reject);
      });
      req.on("error", reject);
      req.end(payload || undefined);
    });
  }
  return { requestJson, close: () => agent.destroy() };
}

module.exports = { createSyncClient, RESPONSE_LIMIT_BYTES, REQUEST_TIMEOUT_MS };
