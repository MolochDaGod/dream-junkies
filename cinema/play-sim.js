/** Stick Wars lane. Rules only. Three.js draws this; it does not own it. */

export const ROLES = {
  miner: { hp: 42, speed: 1.15, damage: 4, range: 1.35, cooldown: 0.9, purse: 1.6 },
  swordwrath: { hp: 74, speed: 2.15, damage: 14, range: 1.5, cooldown: 0.7, purse: 0 },
  archidon: { hp: 48, speed: 1.75, damage: 11, range: 7.5, cooldown: 0.85, purse: 0 },
  spearton: { hp: 128, speed: 1.35, damage: 9, range: 1.75, cooldown: 0.95, purse: 0 }
};

export const STATUE_HP = 420;
export const PLAYER_Z = -16;
export const ENEMY_Z = 16;
const LANE_HALF_X = 3.6;

/**
 * Grudge third-person walk. yaw 0 looks down world +z, toward the enemy statue.
 * Screen-right is (-fwd.z, 0, fwd.x). At yaw 0 that is world -x, because the
 * camera sits on -z. Check: fwd (0,0,-1) would give right (1,0,0); here fwd is +z.
 */
export function walkBasis(yaw) {
  const fwd = { x: Math.sin(yaw), z: Math.cos(yaw) };
  const right = { x: -fwd.z, z: fwd.x };
  return { fwd, right };
}

/** Camera sits behind the same forward the captain walks. */
export function cameraOffset(yaw, pitch, dist) {
  const { fwd } = walkBasis(yaw);
  const flat = Math.cos(pitch) * dist;
  return { x: -fwd.x * flat, y: Math.sin(pitch) * dist, z: -fwd.z * flat };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createMatch(book, captainId) {
  const captains = book.captains || [];
  const player = captains.find((captain) => captain.id === captainId) || captains[0];
  const enemy = player.id === "tengu"
    ? captains.find((captain) => captain.id === "oze")
    : captains.find((captain) => captain.id === "tengu");
  return {
    player,
    enemy,
    dream: 200,
    essence: 48,
    lore: 8,
    unlocked: 0,
    statues: {
      player: { hp: STATUE_HP, max: STATUE_HP, z: PLAYER_Z },
      enemy: { hp: STATUE_HP, max: STATUE_HP, z: ENEMY_Z }
    },
    units: [],
    nextId: 1,
    enemyClock: 5,
    enemyTier: 1,
    result: null,
    rite: 0,
    log: "Train the miner. The line pays for itself.",
    captain: { x: 0, z: -11, facing: 0 }
  };
}

function spawn(match, side, node) {
  const role = ROLES[node.stickRole];
  const z = side === "player"
    ? Math.max(PLAYER_Z + 2.4, match.captain.z + 1.8)
    : ENEMY_Z - 2.4;
  const spread = ((match.nextId * 5) % 7) - 3;
  match.units.push({
    id: match.nextId++,
    side,
    role: node.stickRole,
    name: node.name,
    skill: node.skill,
    tier: node.tier,
    rank: 1,
    x: clamp(spread, -LANE_HALF_X, LANE_HALF_X),
    z,
    hp: role.hp,
    max: role.hp,
    cooldown: 0.4,
    facing: side === "player" ? 0 : Math.PI
  });
}

export function train(match, tier) {
  if (match.result) return;
  const node = match.player.tree.find((item) => item.tier === tier);
  if (!node || !node.train) {
    match.log = "The rite does not summon a body.";
    return;
  }
  if (node.unlocksPrevious && match.unlocked < node.unlocksPrevious) {
    match.log = "Train the earlier troop first.";
    return;
  }
  if (match.dream < node.train.dream) {
    match.log = "Not enough $DREAM.";
    return;
  }
  match.dream -= node.train.dream;
  match.unlocked = Math.max(match.unlocked, tier);
  spawn(match, "player", node);
  match.log = node.name + " takes the lane. " + node.skill + ".";
}

export function upgradeNearest(match) {
  if (match.result) return;
  const troop = match.units
    .filter((unit) => unit.side === "player" && unit.hp > 0)
    .sort((a, b) => Math.hypot(a.x - match.captain.x, a.z - match.captain.z) - Math.hypot(b.x - match.captain.x, b.z - match.captain.z))[0];
  if (!troop) {
    match.log = "No troop of yours is on the field.";
    return;
  }
  if (troop.rank >= 3) {
    match.log = troop.name + " is already fully upgraded.";
    return;
  }
  const node = match.player.tree.find((item) => item.tier === troop.tier);
  const cost = node.upgrade;
  if (match.essence < cost.essence || match.dream < cost.dream || match.lore < 1) {
    match.log = "Upgrade needs " + cost.essence + " essence, " + cost.dream + " $DREAM, and one " + cost.loreItem + ".";
    return;
  }
  match.essence -= cost.essence;
  match.dream -= cost.dream;
  match.lore -= 1;
  troop.rank += 1;
  troop.max = Math.round(troop.max * 1.28);
  troop.hp = troop.max;
  match.log = troop.name + " rises to rank " + troop.rank + " with " + cost.loreItem + ".";
}

export function castRite(match) {
  if (match.result) return;
  const node = match.player.tree.find((item) => item.tier === 5);
  if (!node) return;
  if (match.unlocked < 4) {
    match.log = "Train the wall before the rite.";
    return;
  }
  if (match.essence < node.upgrade.essence || match.lore < 1) {
    match.log = "The rite needs " + node.upgrade.essence + " essence and one " + node.upgrade.loreItem + ".";
    return;
  }
  match.essence -= node.upgrade.essence;
  match.lore -= 1;
  match.rite = 5;
  match.log = node.skill + ". Your troops hit harder for a few seconds.";
}

/** Camera-relative step. dx/dz are already in world metres per second, from the Grudge third-person basis. */
export function moveCaptain(match, dx, dz, dt) {
  const speed = 4.6;
  match.captain.x = clamp(match.captain.x + dx * speed * dt, -LANE_HALF_X, LANE_HALF_X);
  match.captain.z = clamp(match.captain.z + dz * speed * dt, PLAYER_Z + 1.2, ENEMY_Z - 1.2);
  if (dx * dx + dz * dz > 1e-4) match.captain.facing = Math.atan2(dx, dz);
}

function nearestFoe(unit, units) {
  let best = null;
  let bestDist = Infinity;
  for (const other of units) {
    if (other.side === unit.side || other.hp <= 0) continue;
    const dist = Math.hypot(other.x - unit.x, other.z - unit.z);
    if (dist < bestDist) {
      best = other;
      bestDist = dist;
    }
  }
  return { foe: best, dist: bestDist };
}

export function step(match, dt) {
  if (match.result) return;
  const tick = Math.min(Math.max(dt, 0), 0.05);
  if (match.rite > 0) match.rite = Math.max(0, match.rite - tick);
  match.enemyClock -= tick;
  if (match.enemyClock <= 0) {
    match.enemyClock = 8;
    const node = match.enemy.tree.find((item) => item.tier === match.enemyTier);
    match.enemyTier = match.enemyTier === 4 ? 1 : match.enemyTier + 1;
    if (node) spawn(match, "enemy", node);
  }
  for (const unit of match.units) {
    if (unit.hp <= 0) continue;
    const role = ROLES[unit.role];
    const dir = unit.side === "player" ? 1 : -1;
    const { foe, dist } = nearestFoe(unit, match.units);
    const statueZ = unit.side === "player" ? ENEMY_Z : PLAYER_Z;
    const statueDist = Math.abs(statueZ - unit.z);
    const hitFoe = foe && dist <= statueDist;
    if ((hitFoe ? dist : statueDist) > role.range) {
      let mx = 0;
      let mz = dir;
      if (hitFoe) {
        const len = dist || 1;
        mx = (foe.x - unit.x) / len;
        mz = (foe.z - unit.z) / len;
      }
      unit.x += mx * role.speed * tick;
      unit.z += mz * role.speed * tick;
      unit.facing = Math.atan2(mx, mz);
      unit.x = clamp(unit.x, -LANE_HALF_X, LANE_HALF_X);
      unit.z = clamp(unit.z, PLAYER_Z + 1.5, ENEMY_Z - 1.5);
      continue;
    }
    unit.cooldown -= tick;
    if (unit.cooldown > 0) continue;
    unit.cooldown = role.cooldown;
    const buff = unit.side === "player" && match.rite > 0 ? 1.4 : 1;
    const damage = Math.round(role.damage * unit.rank * buff);
    if (hitFoe) foe.hp -= damage;
    else match.statues[unit.side === "player" ? "enemy" : "player"].hp -= damage;
  }
  for (const unit of match.units) {
    if (unit.role === "miner" && unit.side === "player" && unit.hp > 0) match.dream += ROLES.miner.purse * tick;
  }
  match.units = match.units.filter((unit) => unit.hp > 0);
  if (match.statues.enemy.hp <= 0) {
    match.statues.enemy.hp = 0;
    match.result = "win";
    match.log = match.enemy.name + " falls. The lane is yours.";
  } else if (match.statues.player.hp <= 0) {
    match.statues.player.hp = 0;
    match.result = "lose";
    match.log = match.player.name + " falls. The lane is lost.";
  }
}
