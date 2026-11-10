const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Database = require("better-sqlite3");
const { startMinecraftApi } = require("../src/minecraft-api");

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "herade-minecraft-api-"));
  const db = new Database(path.join(directory, "test.sqlite"));
  const token = "test-secret-value-that-is-at-least-32-bytes";
  const config = {
    minecraftApiToken: token,
    minecraftApiHost: "127.0.0.1",
    minecraftApiPort: 0,
  };
  const logger = { info() {}, warn() {}, error(message, error) { throw error || new Error(message); } };
  const api = startMinecraftApi({ db, config, logger });

  try {
    await api.ready;
    const address = api.address();
    assert.ok(address && typeof address === "object" && address.port > 0);

    const uuid = "123e4567-e89b-42d3-a456-426614174000";
    const discordUserId = "123456789012345678";
    const now = Date.now();
    db.prepare(`
      INSERT INTO minecraft_link_requests
        (uuid, username, discord_user_id, code_hash, status, created_at, expires_at)
      VALUES (?, ?, ?, '', 'awaiting_login', ?, ?)
    `).run(uuid, "HeradeTest", discordUserId, now, now + 600000);

    const body = JSON.stringify({ uuid, username: "HeradeTest" });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = crypto.randomUUID();
    const canonical = [timestamp, nonce, "POST", "/api/v1/minecraft/verify", body].join("\n");
    const signature = crypto.createHmac("sha256", token).update(canonical, "utf8").digest("hex");
    const url = "http://127.0.0.1:" + address.port + "/api/v1/minecraft/verify";
    const headers = {
      "Content-Type": "application/json",
      "X-Herade-Timestamp": timestamp,
      "X-Herade-Nonce": nonce,
      "X-Herade-Signature": signature,
    };

    const challengeResponse = await fetch(url, { method: "POST", headers, body });
    assert.equal(challengeResponse.status, 403);
    const challengePayload = await challengeResponse.json();
    assert.match(challengePayload.challenge, /^\d{8}$/);

    const requestRow = db.prepare("SELECT code_hash, observed_at FROM minecraft_link_requests WHERE uuid=?").get(uuid);
    assert.match(requestRow.code_hash, /^[0-9a-f]{64}$/);
    assert.ok(requestRow.observed_at > 0);
    assert.notEqual(requestRow.code_hash, challengePayload.challenge);

    const replayResponse = await fetch(url, { method: "POST", headers, body });
    assert.equal(replayResponse.status, 409);

    db.prepare("UPDATE minecraft_link_requests SET status='pending_approval' WHERE uuid=?").run(uuid);
    const pendingNonce = crypto.randomUUID();
    const pendingTimestamp = String(Math.floor(Date.now() / 1000));
    const pendingCanonical = [pendingTimestamp, pendingNonce, "POST", "/api/v1/minecraft/verify", body].join("\n");
    const pendingSignature = crypto.createHmac("sha256", token).update(pendingCanonical, "utf8").digest("hex");
    const pendingResponse = await fetch(url, {
      method: "POST",
      headers: {
        ...headers,
        "X-Herade-Timestamp": pendingTimestamp,
        "X-Herade-Nonce": pendingNonce,
        "X-Herade-Signature": pendingSignature,
      },
      body,
    });
    assert.equal(pendingResponse.status, 403);
    assert.equal(await pendingResponse.text(), "", "pending approval must not expose another challenge");

    db.prepare(`
      INSERT INTO minecraft_accounts
        (uuid, username, discord_user_id, approved_at, approved_by, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuid, "HeradeTest", discordUserId, Date.now(), discordUserId, null);

    const approvedNonce = crypto.randomUUID();
    const approvedTimestamp = String(Math.floor(Date.now() / 1000));
    const approvedCanonical = [approvedTimestamp, approvedNonce, "POST", "/api/v1/minecraft/verify", body].join("\n");
    const approvedSignature = crypto.createHmac("sha256", token).update(approvedCanonical, "utf8").digest("hex");
    const approvedResponse = await fetch(url, {
      method: "POST",
      headers: {
        ...headers,
        "X-Herade-Timestamp": approvedTimestamp,
        "X-Herade-Nonce": approvedNonce,
        "X-Herade-Signature": approvedSignature,
      },
      body,
    });
    assert.equal(approvedResponse.status, 204);

    const badNonce = crypto.randomUUID();
    const badTimestamp = String(Math.floor(Date.now() / 1000));
    const deniedResponse = await fetch(url, {
      method: "POST",
      headers: {
        ...headers,
        "X-Herade-Timestamp": badTimestamp,
        "X-Herade-Nonce": badNonce,
        "X-Herade-Signature": "0".repeat(64),
      },
      body,
    });
    assert.equal(deniedResponse.status, 401);

    console.log("[test-minecraft-api] challenge, replay protection, approval and signature checks passed.");
  } finally {
    await api.close();
    db.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error("[test-minecraft-api] failed.", error);
  process.exitCode = 1;
});
