import test from 'node:test';
import assert from 'node:assert/strict';
import { clearSave, loadSave, writeSave } from '../src/save.js';

const values = new Map();
globalThis.localStorage = {
  getItem(key) { return values.has(key) ? values.get(key) : null; },
  setItem(key, value) { values.set(key, String(value)); },
  removeItem(key) { values.delete(key); }
};

test('save round-trips a valid room state', () => {
  clearSave();
  assert.equal(writeSave({ floor: 1, room: 'first-room', x: 120, y: 200, encounterResolved: false }), true);
  const save = loadSave();
  assert.equal(save.floor, 1);
  assert.equal(save.room, 'first-room');
  assert.equal(save.x, 120);
  assert.equal(save.y, 200);
  assert.equal(save.encounterResolved, false);
  assert.equal(save.version, 1);
  assert.equal(typeof save.updatedAt, 'number');
});

test('loadSave rejects malformed and unsupported saves', () => {
  values.set('heradetale.save.v1', '{broken');
  assert.equal(loadSave(), null);
  values.set('heradetale.save.v1', JSON.stringify({ version: 2, x: 1, y: 1 }));
  assert.equal(loadSave(), null);
  values.set('heradetale.save.v1', JSON.stringify({ version: 1, x: 'bad', y: 1 }));
  assert.equal(loadSave(), null);
});

test('clearSave removes the stored game state', () => {
  writeSave({ floor: 1, room: 'first-room', x: 10, y: 20 });
  clearSave();
  assert.equal(loadSave(), null);
});
