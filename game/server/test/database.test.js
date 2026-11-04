const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { openDatabase } = require("../src/database");

test("creates and updates a player save", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "heradetale-db-"));
  const filename = path.join(dir, "data", "heradetale.sqlite");
  const db = openDatabase(filename);
  try {
    assert.equal(db.getSave("player-1"), null);
    const first = db.save("player-1", {
      floorId: 1,
      roomId: "floor-01-start",
      state: { hp: 20, inventory: [] },
    });
    assert.equal(first.floor_id, 1);
    assert.deepEqual(first.state, { hp: 20, inventory: [] });

    const second = db.save("player-1", {
      floorId: 2,
      roomId: "floor-02-village",
      state: { hp: 17, inventory: ["healing-item"] },
    });
    assert.equal(second.floor_id, 2);
    assert.deepEqual(db.getSave("player-1").state, { hp: 17, inventory: ["healing-item"] });
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("rejects malformed and oversized saves", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "heradetale-db-"));
  const db = openDatabase(path.join(dir, "game.sqlite"));
  try {
    assert.throws(() => db.save("p", { floorId: 0, roomId: "x", state: {} }), /Invalid save/);
    assert.throws(() => db.save("p", { floorId: 1, roomId: "x", state: { data: "x".repeat(300000) } }), /256 KiB/);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
