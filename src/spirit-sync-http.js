"use strict";

const https = require("node:https");
const dns = require("node:dns").promises;

const RESPONSE_LIMIT_BYTES = 1024 * 1024;
const REQUEST_TIMEOUT_MS = 10000;

// Native HTTPS supports a deterministic IPv4 connection on hosts with broken IPv6.
// TLS verification and SNI stay enabled; never fall back to plaintext HTTP.
function createSyncClient({ family = 4, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  if (![0, 4, 6].includes(family)) throw new Error("Invalid IP family.");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000) {
    throw new Error("Invalid network timeout.");
  }
  const agent = new https.Agent({ keepAlive: true, family: family || undefined, maxSockets: 2 });
  // Keep TLS verification tied to the original hostname while retrying a second
  // independently resolved IPv4 address if the first Anycast route times out.
  async function candidateAddresses(hostname) {
    if (family !== 4) return [null];
    try {
      const found = await dns.lookup(hostname, { all: true, family: 4 });
      const list = [...new Set(found.map(x => x.address))].filter(x => /^\\d{1,3}(?:\\.\\d{1,3}){3}$/.test(x));
      return list.length > 0 ? list.slice(0, 3) : [null];
    } catch { return [null]; }
  }

  async function requestJson(url, { method = "GET", headers = {}, body } = {}) {
    if (!(url instanceof URL) || url.protocol !== "https:" || url.username || url.password) {
      throw new Error("Only trusted HTTPS destinations are supported.");
    }
    if (!["GET", "POST"].includes(method)) throw new Error("Unsupported sync method.");
    const payload = body === undefined ? null : JSON.stringify(body);
    if (payload && Buffer.byteLength(payload) > RESPONSE_LIMIT_BYTES) {
      throw new Error("Sync payload exceeds size limit.");
    }
    async function sendOnce(address) {
      return new Promise((resolve, reject) => {
      const req = https.request(url, {
        // Per-address attempt uses a dedicated socket. The URL hostname is
        // unchanged, so both SNI and certificate hostname validation remain on.
        agent: address ? false : agent,
        ...(address ? { lookup: (_host, _opts, cb) => cb(null, address, 4) } : {}),
        method,
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
    const addresses = await candidateAddresses(url.hostname);
    let last;
    for (const address of addresses) {
      try { return await sendOnce(address); }
      catch (error) {
        last = error;
        // Retry only network establishment errors, never HTTP responses,
        // failed certificate verification, invalid JSON or oversized bodies.
        const code = error?.code || error?.cause?.code;
        const retryable = ["ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "EHOSTUNREACH", "ENETUNREACH", "ECONNREFUSED"].includes(code) ||
          error?.name === "TimeoutError" || error?.name === "AbortError";
        if (!retryable || address === null) throw error;
      }
    }
    throw last;
  }
  return { requestJson, close: () => agent.destroy() };
}

module.exports = { createSyncClient, RESPONSE_LIMIT_BYTES, REQUEST_TIMEOUT_MS };
