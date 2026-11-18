"use strict";

const { createProfileReader } = require("./spirit-profile-api");
const { createSyncClient } = require("./spirit-sync-http");
const { diagnoseSpiritConnectivity } = require("./spirit-sync-diagnostics");

const INTERVAL_MS = 30000;
const USER_ID = /^\d{17,20}$/;
function networkErrorText(error) {
  const code = error?.cause?.code;
  if (typeof code === "string" && /^[A-Z0-9_]{2,40}$/.test(code)) return code;
  if (error?.name === "TimeoutError" || error?.name === "AbortError") return "HTTPS request timeout";
  return String(error?.name || "network error").slice(0, 60);
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
  const client = createSyncClient({ family: preferredFamily });
  let lastNetworkDiagnosticAt = 0;
  const readProfile = createProfileReader({ db, guildId: config.guildId });
  let active = false;
  let stopped = false;
  const headers = { "x-spirit-sync-secret": secret, "Accept": "application/json" };

  async function poll() {
    if (active || stopped) return;
    active = true;
    try {
      const jobsResponse = await client.requestJson(new URL("/api/sync/jobs", origin), { headers });
      if (!jobsResponse.ok) {
        logger.warn(`Spirit outbound sync jobs request returned HTTP ${jobsResponse.status}.`);
        return;
      }
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
      logger.warn(`Spirit outbound sync polling failed: ${networkErrorText(error)}; target ${url.hostname}:443, IP family ${preferredFamily || "auto"}.`);
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

module.exports = { startSpiritOutboundSync };
