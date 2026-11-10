const http = require("node:http");
const crypto = require("node:crypto");

const ROUTE = "/api/v1/minecraft/verify";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/;

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS minecraft_link_requests (
      uuid TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      discord_user_id TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'awaiting_login'
        CHECK (status IN ('awaiting_login','pending_approval','approved','rejected','expired')),
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      observed_at INTEGER,
      challenge_expires_at INTEGER,
      handled_by TEXT,
      handled_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_minecraft_link_requests_discord
      ON minecraft_link_requests(discord_user_id, status, expires_at);
    CREATE TABLE IF NOT EXISTS minecraft_accounts (
      uuid TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      discord_user_id TEXT NOT NULL,
      approved_at INTEGER NOT NULL,
      approved_by TEXT NOT NULL,
      last_seen_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_minecraft_accounts_discord
      ON minecraft_accounts(discord_user_id);
    CREATE TABLE IF NOT EXISTS minecraft_api_nonces (
      nonce TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_minecraft_api_nonces_expiry
      ON minecraft_api_nonces(expires_at);
  `);

  const requestColumns = db.prepare("PRAGMA table_info(minecraft_link_requests)").all();
  if (!requestColumns.some((column) => column.name === "challenge_expires_at")) {
    db.exec("ALTER TABLE minecraft_link_requests ADD COLUMN challenge_expires_at INTEGER");
  }
}

function send(res, status, payload = null) {
  const body = payload == null ? Buffer.alloc(0) : Buffer.from(JSON.stringify(payload), "utf8");
  res.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Length": String(body.length),
    "X-Content-Type-Options": "nosniff",
    ...(payload == null ? {} : { "Content-Type": "application/json; charset=utf-8" }),
  });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 4096) {
      const error = new Error("Request body too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function expectedSignature(secret, timestamp, nonce, method, path, body) {
  const canonical = [timestamp, nonce, method, path, body].join("\n");
  return crypto.createHmac("sha256", secret).update(canonical, "utf8").digest();
}

function constantTimeHexEqual(received, expected) {
  if (typeof received !== "string" || !/^[0-9a-f]{64}$/i.test(received)) return false;
  const actual = Buffer.from(received, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function startMinecraftApi({ db, config, logger }) {
  ensureSchema(db);

  if (!config.minecraftApiToken) {
    logger.info("Herade Security API listener is disabled; HERADE_CORE_API_TOKEN is not configured.");
    return { close: async () => {} };
  }

  const consumeNonce = db.prepare(
    "INSERT INTO minecraft_api_nonces (nonce, expires_at) VALUES (?, ?)",
  );
  const pruneNonces = db.prepare("DELETE FROM minecraft_api_nonces WHERE expires_at < ?");
  const findAccount = db.prepare("SELECT uuid FROM minecraft_accounts WHERE uuid = ?");
  const touchAccount = db.prepare(
    "UPDATE minecraft_accounts SET username = ?, last_seen_at = ? WHERE uuid = ?",
  );
  const findAwaitingRequest = db.prepare(`
    SELECT discord_user_id FROM minecraft_link_requests
     WHERE uuid=? AND status='awaiting_login' AND expires_at>?
  `);
  const findPendingRequest = db.prepare(`
    SELECT uuid FROM minecraft_link_requests
     WHERE uuid=? AND status='pending_approval' AND expires_at>?
  `);
  const saveChallenge = db.prepare(`
    UPDATE minecraft_link_requests
       SET code_hash=?, observed_at=?, challenge_expires_at=?
     WHERE uuid=? AND status='awaiting_login' AND expires_at>?
  `);
  const markPendingObserved = db.prepare(`
    UPDATE minecraft_link_requests SET observed_at=?
     WHERE uuid=? AND status='pending_approval' AND expires_at>?
  `);

  const verifyTransaction = db.transaction(({ nonce, nonceExpiry, uuid, username, now }) => {
    pruneNonces.run(now);
    consumeNonce.run(nonce, nonceExpiry);

    const account = findAccount.get(uuid);
    if (account) {
      touchAccount.run(username, now, uuid);
      return { approved: true, challenge: null };
    }

    const awaiting = findAwaitingRequest.get(uuid, now);
    if (awaiting) {
      const challenge = String(crypto.randomInt(10000000, 100000000));
      const codeHash = crypto.createHmac("sha256", config.minecraftApiToken)
        .update(awaiting.discord_user_id + ":" + challenge, "utf8").digest("hex");
      const updated = saveChallenge.run(codeHash, now, now + 10 * 60_000, uuid, now);
      return { approved: false, challenge: updated.changes ? challenge : null };
    }

    if (findPendingRequest.get(uuid, now)) {
      markPendingObserved.run(now, uuid, now);
    }
    return { approved: false, challenge: null };
  });

  const server = http.createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== ROUTE) {
      send(res, 404);
      return;
    }

    let body;
    try {
      body = await readBody(req);
    } catch (error) {
      send(res, error.statusCode || 400);
      return;
    }

    const timestamp = req.headers["x-herade-timestamp"];
    const nonce = req.headers["x-herade-nonce"];
    const signature = req.headers["x-herade-signature"];
    if (typeof timestamp !== "string" || !/^\d{10}$/.test(timestamp)
        || typeof nonce !== "string"
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(nonce)) {
      send(res, 401);
      return;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - Number(timestamp)) > 60) {
      send(res, 401);
      return;
    }

    const expected = expectedSignature(
      config.minecraftApiToken, timestamp, nonce, req.method, req.url, body,
    );
    if (!constantTimeHexEqual(signature, expected)) {
      send(res, 401);
      return;
    }

    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      send(res, 400);
      return;
    }

    const uuid = typeof payload.uuid === "string" ? payload.uuid.toLowerCase() : "";
    const username = typeof payload.username === "string" ? payload.username : "";
    if (!UUID_PATTERN.test(uuid) || !USERNAME_PATTERN.test(username)) {
      send(res, 400);
      return;
    }

    try {
      const now = Date.now();
      const result = verifyTransaction({
        nonce,
        nonceExpiry: now + 5 * 60_000,
        uuid,
        username,
        now,
      });
      if (result.approved) {
        send(res, 204);
      } else if (result.challenge) {
        send(res, 403, { challenge: result.challenge });
      } else {
        send(res, 403);
      }
    } catch (error) {
      if (error.code === "SQLITE_CONSTRAINT_PRIMARYKEY" ||
          error.code === "SQLITE_CONSTRAINT_UNIQUE") {
        send(res, 409);
        return;
      }
      logger.error("Herade Security API verification failed.", error);
      send(res, 503);
    }
  });

  server.on("error", (error) => logger.error("Herade Security API listener error.", error));
  const ready = new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  server.listen(config.minecraftApiPort, config.minecraftApiHost, () => {
    logger.info(`Herade Security API listening on ${config.minecraftApiHost}:${config.minecraftApiPort}.`);
    if (config.minecraftApiHost !== "127.0.0.1" && config.minecraftApiHost !== "::1" &&
        config.minecraftApiHost !== "localhost") {
      logger.warn("Herade Security API is bound to a non-loopback interface; expose it only behind a trusted TLS reverse proxy.");
    }
  });

  return {
    ready,
    address: () => server.address(),
    close: () => new Promise((resolve, reject) => {
      if (!server.listening) return resolve();
      server.close((error) => error ? reject(error) : resolve());
    }),
  };
}

module.exports = { startMinecraftApi, ensureSchema };
