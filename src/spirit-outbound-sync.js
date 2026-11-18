"use strict";

const { createProfileReader } = require("./spirit-profile-api");
const { createSyncClient } = require("./spirit-sync-http");
const { diagnoseSpiritConnectivity } = require("./spirit-sync-diagnostics");

const INTERVAL_MS = 30000;
const USER_ID = /^\d{17,20}$/;
const MAX_RETRY_DELAY_MS = 15 * 60 * 1000;

function networkErrorText(error) {
  const chain = [];
  let current = error;
  for (let i = 0; current && i < 4; i++) {
    chain.push(current);
    current = current.cause;
  }
  const code = chain.map(item => item?.code).find(value =>
    typeof value === "string" && /^[A-Z0-9_]{2,40}$/.test(value));
  if (code) return code;
  if (chain.some(item => item?.name === "TimeoutError" || item?.name === "AbortError")) {
    return "HTTPS request timeout";
  }
  // Node's fetch/network APIs can wrap connection failures in a generic TypeError.
  // Keep logs deterministic and avoid leaking headers, secrets or request bodies.
  const message = chain.map(item => String(item?.message || "")).find(value =>
    /timeout|timed out/i.test(value));
  if (message) return "HTTPS request timeout";
  return String(error?.name || "network error").slice(0, 60);
}

function retryDelayMs(failures) {
  return Math.min(MAX_RETRY_DELAY_MS, INTERVAL_MS * 2 ** Math.min(10, Math.max(0, failures - 1)));
}


function startSpiritOutboundSync({ db, config, logger }) {
  const secret = process.env.SPIRIT_SYNC_SECRET || "";
  if (!secret) {
    logger.info("Spirit outbound sync disabled (SPIRIT_SYNC_SECRET not set).");
    return { close: async () => {} };
  }
  if (Buffer.byteLength(secret, "utf8") < 32) throw new Error("SPIRIT_SYNC_SECRET must be at least 32 UTF-8 bytes.");
  const raw = process.env.SPIRIT_SYNC_URL || "https://duh-svobody-app.vercel.app";
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" ||
      url.search || url.hash) throw new Error("SPIRIT_SYNC_URL must be an HTTPS origin without path.");
  const origin = url.origin;
  const preferredFamily = Number(process.env.SPIRIT_SYNC_IP_FAMILY || "4");
  if (![0, 4, 6].includes(preferredFamily)) throw new Error("SPIRIT_SYNC_IP_FAMILY must be 0, 4 or 6.");
  // These two Vercel routes were verified from this Pterodactyl network on
  // 2026-11-18. They are fallback preferences, not permanent infrastructure.
  // Keep the original HTTPS hostname for certificate validation and SNI.
  const defaultPreferredIpv4 = url.hostname === "duh-svobody-app.vercel.app"
    ? ["64.29.17.195", "216.198.79.195"] : [];
  const override = process.env.SPIRIT_SYNC_PREFERRED_IPV4;
  const preferredIpv4 = override === undefined ? defaultPreferredIpv4 :
    override.split(",").map(value => value.trim()).filter(Boolean);
  const client = createSyncClient({ family: preferredFamily, preferredIpv4 });
  let lastNetworkDiagnosticAt = 0;
  const readProfile = createProfileReader({ db, guildId: config.guildId });
  let active = false;
  let stopped = false;
  let failures = 0;
  let nextAttemptAt = 0;
  const headers = { "x-spirit-sync-secret": secret, "Accept": "application/json" };

  async function poll() {
    if (active || stopped || Date.now() < nextAttemptAt) return;
    active = true;
    try {
      const jobsResponse = await client.requestJson(new URL("/api/sync/jobs", origin), { headers });
      if (!jobsResponse.ok) {
        failures++;
        nextAttemptAt = Date.now() + retryDelayMs(failures);
        logger.warn(`Spirit outbound sync jobs request returned HTTP ${jobsResponse.status}; next attempt in ${Math.ceil(retryDelayMs(failures) / 1000)}s.`);
        return;
      }
      failures = 0;
      nextAttemptAt = 0;
      const jobs = jobsResponse.data;
      if (!Array.isArray(jobs?.userIds)) throw new Error("Unexpected sync jobs response.");
      for (const userId of jobs.userIds.slice(0, 10)) {
        if (stopped) break;
        if (typeof userId !== "string" || !USER_ID.test(userId)) continue;
        try {
          const profile = readProfile(userId);
          const result = await client.requestJson(new URL("/api/sync/result", origin), {
            method: "POST", headers, body: { userId, profile },
          });
          if (!result.ok) logger.warn(`Spirit outbound sync update failed (HTTP ${result.status}).`);
        } catch (error) {
          logger.warn(`Spirit outbound sync member update failed: ${networkErrorText(error)}`);
        }
      }
    } catch (error) {
      failures++;
      const delay = retryDelayMs(failures);
      nextAttemptAt = Date.now() + delay;
      logger.warn(`Spirit outbound sync polling failed: ${networkErrorText(error)}; target ${url.hostname}:443, IP family ${preferredFamily || "auto"}; retry in ${Math.ceil(delay / 1000)}s.`);
      if (Date.now() - lastNetworkDiagnosticAt > 60 * 60 * 1000) {
        lastNetworkDiagnosticAt = Date.now();
        void diagnoseSpiritConnectivity(url.hostname, logger).catch(() => {});
      }
    } finally {
      active = false;
    }
  }

  const timer = setInterval(() => { void poll(); }, INTERVAL_MS);
  timer.unref?.();
  void poll();
  logger.info("Spirit outbound sync enabled (outgoing HTTPS; no inbound port).");
  return {
    close: async () => {
      stopped = true;
      clearInterval(timer);
      client.close();
    },
  };
}

module.exports = { startSpiritOutboundSync, networkErrorText, retryDelayMs };
