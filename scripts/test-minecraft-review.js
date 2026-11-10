const assert = require("node:assert/strict");
const Database = require("better-sqlite3");
const { ensureSchema } = require("../src/minecraft-api");

function main() {
  const db = new Database(":memory:");
  try {
    ensureSchema(db);
    const now = Date.now();
    const uuid = "123e4567-e89b-42d3-a456-426614174001";
    const discordId = "123456789012345678";
    db.prepare(`
      INSERT INTO minecraft_link_requests
        (uuid, username, discord_user_id, code_hash, status, created_at, expires_at, observed_at)
      VALUES (?, ?, ?, '', 'pending_approval', ?, ?, ?)
    `).run(uuid, "ReviewTester", discordId, now, now + 600000, now);

    const approve = db.transaction(() => {
      const changed = db.prepare(
        "UPDATE minecraft_link_requests SET status='approved', handled_by=?, handled_at=? WHERE uuid=? AND status='pending_approval' AND observed_at IS NOT NULL AND expires_at>?",
      ).run("111111111111111111", now, uuid, now);
      if (changed.changes !== 1) return false;
      db.prepare(`
        INSERT INTO minecraft_accounts (uuid, username, discord_user_id, approved_at, approved_by, last_seen_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(uuid, "ReviewTester", discordId, now, "111111111111111111", now);
      return true;
    });
    assert.equal(approve(), true, "first review action should approve the pending request");

    const rejectApproved = db.prepare(
      "UPDATE minecraft_link_requests SET status='rejected', handled_by=?, handled_at=? WHERE uuid=? AND status='pending_approval' AND observed_at IS NOT NULL AND expires_at>?",
    ).run("222222222222222222", now, uuid, now);
    assert.equal(rejectApproved.changes, 0, "a second reviewer must not overwrite an approval");
    assert.equal(db.prepare("SELECT status FROM minecraft_link_requests WHERE uuid=?").get(uuid).status, "approved");
    assert.equal(db.prepare("SELECT discord_user_id FROM minecraft_accounts WHERE uuid=?").get(uuid).discord_user_id, discordId);

    db.prepare("UPDATE minecraft_accounts SET last_seen_at=? WHERE uuid=?").run(now, uuid);
    const unlink = db.transaction(() => {
      const deleted = db.prepare("DELETE FROM minecraft_accounts WHERE discord_user_id=?").run(discordId);
      db.prepare("UPDATE minecraft_link_requests SET status='rejected', handled_by=?, handled_at=? WHERE discord_user_id=? AND status IN ('awaiting_login','pending_approval','approved')")
        .run(discordId, now, discordId);
      return deleted.changes;
    });
    assert.equal(unlink(), 1, "unlink should remove the approved account");
    assert.equal(db.prepare("SELECT status FROM minecraft_link_requests WHERE uuid=?").get(uuid).status, "rejected");
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM minecraft_accounts WHERE uuid=?").get(uuid).count, 0);
    console.log("[test-minecraft-review] atomic approval and unlink transitions passed.");
  } finally {
    db.close();
  }
}

main();
