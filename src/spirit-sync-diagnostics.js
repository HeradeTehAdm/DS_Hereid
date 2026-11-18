"use strict";

const dns = require("node:dns").promises;
const tls = require("node:tls");

async function probeTls(host, family, timeoutMs = 6500) {
  return new Promise((resolve) => {
    const socket = tls.connect({ host, port: 443, servername: host, family, rejectUnauthorized: true });
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs, () => finish("TIMEOUT"));
    socket.once("secureConnect", () => finish(socket.authorized ? "OK" : "TLS_UNAUTHORIZED"));
    socket.once("error", (error) => finish(
      /^[A-Z0-9_]{2,48}$/.test(error?.code || "") ? error.code : "TLS_ERROR",
    ));
  });
}

async function diagnoseSpiritConnectivity(targetHost, logger) {
  for (const host of [targetHost, "github.com"]) {
    try {
      const addresses = await dns.lookup(host, { all: true });
      const v4 = addresses.filter((item) => item.family === 4).length;
      const v6 = addresses.filter((item) => item.family === 6).length;
      logger.info(`Spirit network diagnostic ${host}: DNS A=${v4}, AAAA=${v6}.`);
      if (v4) logger.info(`Spirit network diagnostic ${host}: IPv4/TLS ${await probeTls(host, 4)}.`);
      if (v6) logger.info(`Spirit network diagnostic ${host}: IPv6/TLS ${await probeTls(host, 6)}.`);
    } catch (error) {
      const code = error?.code;
      logger.warn(`Spirit network diagnostic ${host}: DNS ${/^[A-Z0-9_]{2,48}$/.test(code || "") ? code : "LOOKUP_FAILED"}.`);
    }
  }
}

module.exports = { diagnoseSpiritConnectivity, probeTls };
