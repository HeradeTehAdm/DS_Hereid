const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");

function openDatabase(filename) {
  if (!filename || typeof filename !== "string") {
    throw new TypeError("A database filename is required.");
  }
  const resolved = path.resolve(filename);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });

  const db = new Database(resolved);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(`
    CREATE TABLE IF NOT EXISTS game_saves (
      player_id TEXT PRIMARY KEY,
      save_version INTEGER NOT NULL DEFAULT 1,
      floor_id INTEGER NOT NULL DEFAULT 1,
      room_id TEXT NOT NULL DEFAULT 'floor-01-start',
      state_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS game_sessions (
      session_id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      controller_id TEXT,
      status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'paused', 'closed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_game_sessions_player
      ON game_sessions(player_id, status);
  `);

  const getSave = db.prepare(
    "SELECT player_id, save_version, floor_id, room_id, state_json, created_at, updated_at FROM game_saves WHERE player_id = ?"
  );
  const upsertSave = db.prepare(`
    INSERT INTO game_saves (player_id, save_version, floor_id, room_id, state_json)
    VALUES (@player_id, @save_version, @floor_id, @room_id, @state_json)
    ON CONFLICT(player_id) DO UPDATE SET
      save_version = excluded.save_version,
      floor_id = excluded.floor_id,
      room_id = excluded.room_id,
      state_json = excluded.state_json,
      updated_at = datetime('now')
  `);

  return {
    getSave(playerId) {
      if (typeof playerId !== "string" || !playerId.trim()) throw new TypeError("playerId is required.");
      const row = getSave.get(playerId);
      if (!row) return null;
      return { ...row, state: JSON.parse(row.state_json) };
    },
    save(playerId, save) {
      if (typeof playerId !== "string" || !playerId.trim()) throw new TypeError("playerId is required.");
      if (!save || !Number.isInteger(save.floorId) || save.floorId < 1 ||
          typeof save.roomId !== "string" || !save.roomId.trim() ||
          save.state === null || typeof save.state !== "object" || Array.isArray(save.state)) {
        throw new TypeError("Invalid save payload.");
      }
      const stateJson = JSON.stringify(save.state);
      if (Buffer.byteLength(stateJson, "utf8") > 256 * 1024) {
        throw new RangeError("Save state exceeds 256 KiB.");
      }
      upsertSave.run({
        player_id: playerId,
        save_version: Number.isInteger(save.saveVersion) ? save.saveVersion : 1,
        floor_id: save.floorId,
        room_id: save.roomId,
        state_json: stateJson,
      });
      return this.getSave(playerId);
    },
    close() {
      db.close();
    },
  };
}

module.exports = { openDatabase };
