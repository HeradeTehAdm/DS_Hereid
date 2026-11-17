import test from 'node:test';
import assert from 'node:assert/strict';
import { ENDINGS, FLOORS, getFloor } from '../src/content/world.js';

test('world outline contains twenty ordered floors', () => {
  assert.equal(FLOORS.length, 20);
  assert.deepEqual(FLOORS.map((floor) => floor.id), Array.from({ length: 20 }, (_, i) => i + 1));
  assert.ok(FLOORS.every((floor) => floor.title && floor.objective && floor.memory));
});

test('ending catalogue contains the secret route', () => {
  assert.equal(ENDINGS.length, 5);
  assert.equal(ENDINGS.find((ending) => ending.id === 'beyond-abyss').title, 'За пределами Бездны');
});

test('unknown floor ids safely fall back to the opening floor', () => {
  assert.equal(getFloor(999).id, 1);
});
