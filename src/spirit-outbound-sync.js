"use strict";

const { createProfileReader } = require("./spirit-profile-api");

const INTERVAL_MS = 15000;
const USER_ID = /^\d{17,20}$/;

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
  const readProfile = createProfileReader({ db, guildId: config.guildId });
  let active = false;
  let stopped = false;
  const headers = { "x-spirit-sync-secret": secret, "Accept": "application/json" };

  async function poll() {
    if (active || stopped) return;
    active = true;
    try {
      const jobsResponse = await fetch(origin + "/api/sync/jobs", {
        headers, signal: AbortSignal.timeout(8000), redirect: "error", cache: "no-store",
      });
      if (!jobsResponse.ok) {
        logger.warn(`Spirit outbound sync jobs request returned HTTP ${jobsResponse.status}.`);
        return;
      }
      const jobs = await jobsResponse.json();
      if (!Array.isArray(jobs?.userIds)) throw new Error("Unexpected sync jobs response.");
      for (const userId of jobs.userIds.slice(0, 10)) {
        if (stopped) break;
        if (typeof userId !== "string" || !USER_ID.test(userId)) continue;
        try {
          const profile = readProfile(userId);
          const result = await fetch(origin + "/api/sync/result", {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ userId, profile }),
            signal: AbortSignal.timeout(8000),
            redirect: "error",
            cache: "no-store",
          });
          if (!result.ok) logger.warn(`Spirit outbound sync update failed (HTTP ${result.status}).`);
        } catch (error) {
          logger.warn(`Spirit outbound sync member update failed: ${error.message}`);
        }
      }
    } catch (error) {
      logger.warn(`Spirit outbound sync polling failed: ${error.message}`);
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
    },
  };
}

module.exports = { startSpiritOutboundSync };
