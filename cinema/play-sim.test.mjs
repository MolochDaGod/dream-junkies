import assert from "node:assert/strict";
import test from "node:test";
import { cameraOffset, createMatch, moveCaptain, step, train, upgradeNearest, walkBasis } from "./play-sim.js";

const book = {
  captains: [
    {
      id: "oze",
      name: "Oze",
      tree: [
        { tier: 1, stickRole: "miner", name: "Oze Miner", skill: "Anvil Pace", unlocksPrevious: null, train: { dream: 40 }, upgrade: { essence: 12, dream: 10, loreItem: "Rem Forge Ingot" } },
        { tier: 2, stickRole: "swordwrath", name: "Oze Line", skill: "Forge Cut", unlocksPrevious: 1, train: { dream: 55 }, upgrade: { essence: 18, dream: 18, loreItem: "Rem Forge Ingot" } },
        { tier: 4, stickRole: "spearton", name: "Oze Wall", skill: "Anvil Wall", unlocksPrevious: 3, train: { dream: 85 }, upgrade: { essence: 30, dream: 34, loreItem: "Rem Forge Ingot" } },
        { tier: 5, stickRole: "captain-rite", name: "Oze Rite", skill: "King's Judgment", unlocksPrevious: 4, train: null, upgrade: { essence: 36, dream: 42, loreItem: "Rem Forge Ingot" } }
      ]
    },
    {
      id: "tengu",
      name: "Tengu Legends",
      tree: [
        { tier: 1, stickRole: "miner", name: "Tengu Miner", skill: "Stolen Dreams", unlocksPrevious: null, train: { dream: 80 }, upgrade: { essence: 20, dream: 10, loreItem: "Tengu Mask" } }
      ]
    }
  ]
};

test("the sword stays locked until the miner is trained", () => {
  const match = createMatch(book, "oze");
  train(match, 2);
  assert.equal(match.units.length, 0);
  assert.match(match.log, /earlier troop/);
  train(match, 1);
  assert.equal(match.units.length, 1);
  assert.equal(match.units[0].name, "Oze Miner");
  assert.equal(match.dream, 160);
  assert.equal(match.enemy.id, "tengu");
});

test("a miner pays the purse and an upgrade spends the lore item", () => {
  const match = createMatch(book, "oze");
  train(match, 1);
  const before = match.dream;
  step(match, 1);
  assert.ok(match.dream > before);
  match.captain.x = match.units[0].x;
  match.captain.z = match.units[0].z;
  upgradeNearest(match);
  assert.equal(match.units[0].rank, 2);
  assert.equal(match.lore, 7);
});

test("W walks toward the enemy and D is screen-right", () => {
  const { fwd, right } = walkBasis(0);
  assert.ok(fwd.z > 0.99);
  assert.ok(Math.abs(fwd.x) < 1e-9);
  assert.ok(right.x < -0.99);
  const behind = cameraOffset(0, 0, 6);
  assert.ok(behind.z < 0);
  assert.ok(Math.abs(-behind.z / 6 - fwd.z) < 1e-9);

  const match = createMatch(book, "oze");
  const z0 = match.captain.z;
  moveCaptain(match, fwd.x, fwd.z, 0.5);
  assert.ok(match.captain.z > z0 + 1);
  assert.ok(Math.abs(match.captain.facing) < 0.05);

  const xAfterW = match.captain.x;
  moveCaptain(match, right.x, right.z, 0.5);
  assert.ok(match.captain.x < xAfterW - 1);
  const xAfterD = match.captain.x;
  moveCaptain(match, -right.x, -right.z, 0.5);
  assert.ok(match.captain.x > xAfterD + 1);
});

test("a miner marches up the lane toward the enemy statue", () => {
  const match = createMatch(book, "oze");
  train(match, 1);
  const z0 = match.units[0].z;
  match.enemyClock = 100;
  step(match, 0.05);
  assert.ok(match.units[0].z > z0);
  assert.ok(Math.abs(match.units[0].facing) < 0.05);
});

test("a troop in range damages the enemy statue", () => {
  const match = createMatch(book, "oze");
  train(match, 1);
  match.units[0].z = 15.2;
  match.units[0].cooldown = 0;
  match.enemyClock = 100;
  step(match, 0.05);
  assert.ok(match.statues.enemy.hp < match.statues.enemy.max);
});
