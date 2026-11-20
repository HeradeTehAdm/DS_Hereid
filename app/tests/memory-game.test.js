import { test } from "node:test";
import assert from "node:assert/strict";
import { MemoryGame } from "../src/memory-game.js";

test("Колода перемешивается и содержит ровно две карты каждого вида", () => {
  const a = new MemoryGame(() => 0);
  const b = new MemoryGame(() => 0.99);
  assert.notDeepEqual(a.cards,b.cards);
  assert.equal(a.cards.length,12);
  for (const face of new Set(a.cards)) assert.equal(a.cards.filter(id => id === face).length,2);
});

test("Повторный выбор и третье нажатие не меняют открытую пару и счёт", () => {
  const game = new MemoryGame(() => 0.99);
  game.choose(0);
  game.choose(0);
  game.choose(-1);
  assert.equal(game.moves,0);
  game.choose(2);
  game.choose(1);
  assert.equal(game.moves,1);
  assert.deepEqual(game.open,[0,2]);
  game.closeMismatch();
  assert.deepEqual(game.open,[]);
});

test("Полная партия за шесть ходов, затем чистая новая партия", () => {
  const game = new MemoryGame(() => 0.99);
  for (let i=0; i<12; i++) game.choose(i);
  game.choose(0);
  assert.equal(game.moves,6);
  assert.equal(game.matched.size,12);
  const next = new MemoryGame();
  assert.equal(next.moves,0);
  assert.equal(next.matched.size,0);
});

