import * as THREE from "https://unpkg.com/three@0.185.0/build/three.module.js";
import * as SkeletonUtils from "https://unpkg.com/three@0.185.0/examples/jsm/utils/SkeletonUtils.js";
import { createDreamHumanModel } from "./bodies/dream-human.js";
import { ENEMY_Z, PLAYER_Z, cameraOffset, castRite, createMatch, moveCaptain, step, train, upgradeNearest, walkBasis } from "./play-sim.js";

const canvas = document.querySelector("#view");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x07110c);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x07110c, 16, 46);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 80);

scene.add(new THREE.HemisphereLight(0xd5efd4, 0x1c140c, 0.9));
const sun = new THREE.DirectionalLight(0xfff1c9, 1.2);
sun.position.set(7, 16, -8);
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(12, 48),
  new THREE.MeshStandardMaterial({ color: 0x143024, roughness: 1, side: THREE.FrontSide })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
for (const x of [-3.8, 3.8]) {
  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.18, 34),
    new THREE.MeshStandardMaterial({ color: 0xe4c36a, roughness: 0.55 })
  );
  rail.position.set(x, 0.09, 0);
  scene.add(rail);
}

const ROLE_COLOR = { miner: 0xc4a15a, swordwrath: 0xd7e7df, archidon: 0x7dcea0, spearton: 0x8aa0b8 };
const LOOKS = {
  oze: { skin: 0x8d5a3c, hair: 0x1a120e, shirt: 0x6b4a2a, pants: 0x2a2420, shoes: 0x14110e, eye: 0xe4c36a, lips: 0x8a4a42, metal: 0.35 },
  wu: { skin: 0xe0b090, hair: 0x140e0c, shirt: 0x6e1d3a, pants: 0x3a1424, shoes: 0xc6a15a, eye: 0xf2eee4, lips: 0xa85a62, metal: 0.08 },
  "bloom-mind": { skin: 0xf0c8a8, hair: 0x2a3a28, shirt: 0x7d9a62, pants: 0x3d4a38, shoes: 0x6a5a3a, eye: 0xd7efc4, lips: 0xc47a86, metal: 0.04 },
  "memory-core": { skin: 0xc49a74, hair: 0x101014, shirt: 0x1a1c28, pants: 0x12131a, shoes: 0x2a2a30, eye: 0xc5d4e8, lips: 0x8a5a58, metal: 0.28 },
  trea: { skin: 0xc4a07a, hair: 0x1c140e, shirt: 0x1f4a3a, pants: 0x142820, shoes: 0x3a3228, eye: 0xe7f0dc, lips: 0x9a5a52, metal: 0.16 },
  sury: { skin: 0xd0a884, hair: 0x1a120c, shirt: 0x243a5c, pants: 0x1a2438, shoes: 0x3a3228, eye: 0xe4e8c8, lips: 0x9a5a52, metal: 0.12 },
  "paradox-vein": { skin: 0xe0b896, hair: 0x2a1848, shirt: 0xc6a15a, pants: 0x4a2a78, shoes: 0x2a2030, eye: 0xe4c36a, lips: 0x8a5070, metal: 0.4 },
  "abyss-echo": { skin: 0xb98a6a, hair: 0x0c1a22, shirt: 0x0e2a3a, pants: 0x0a1c28, shoes: 0x101418, eye: 0x9fd4e0, lips: 0x6a4050, metal: 0.14 },
  "light-sector": { skin: 0xf0d2b4, hair: 0xe8d7a8, shirt: 0xc6b07a, pants: 0x8a7a58, shoes: 0xe4c36a, eye: 0xfff6d8, lips: 0xc48a80, metal: 0.55 },
  "fear-pool": { skin: 0x6a4038, hair: 0x2a100c, shirt: 0x3a1a14, pants: 0x1a0e0c, shoes: 0x2a1612, eye: 0xff6a3a, lips: 0x6a3030, metal: 0.32 },
  tengu: { skin: 0xc4a484, hair: 0x0c0c0c, shirt: 0x141414, pants: 0x101010, shoes: 0x1a1a1a, eye: 0xe4c36a, lips: 0x5a3030, metal: 0.22 },
  miner: { skin: 0xc4a484, hair: 0x2a2118, shirt: 0x8a6a3a, pants: 0x4a3a28, shoes: 0x2a241c, eye: 0xf2eee4, lips: 0x9a685c, metal: 0.06 },
  swordwrath: { skin: 0xd0b090, hair: 0x241c16, shirt: 0xc5d0c8, pants: 0x8a9390, shoes: 0x3a342c, eye: 0xf4f1e8, lips: 0xa07068, metal: 0.35 },
  archidon: { skin: 0xd0b090, hair: 0x241c16, shirt: 0x5d9a78, pants: 0x2e4a3c, shoes: 0x3a342c, eye: 0xf4f1e8, lips: 0xa07068, metal: 0.08 },
  spearton: { skin: 0xc4a484, hair: 0x1c1814, shirt: 0x7e92a8, pants: 0x3e4a58, shoes: 0x2a3038, eye: 0xf4f1e8, lips: 0x9a685c, metal: 0.45 }
};

function figure(color, tall) {
  const group = new THREE.Group();
  const height = tall ? 2.5 : 1.2;
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(tall ? 0.55 : 0.22, tall ? 0.72 : 0.28, height, 8),
    new THREE.MeshStandardMaterial({ color, roughness: 0.74 })
  );
  body.position.y = height / 2;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(tall ? 0.36 : 0.18, 12, 8),
    new THREE.MeshStandardMaterial({ color: tall ? 0xe4c36a : 0xf4f1e8, roughness: 0.45 })
  );
  head.position.y = height + (tall ? 0.28 : 0.2);
  const nose = new THREE.Mesh(
    new THREE.BoxGeometry(tall ? 0.14 : 0.07, tall ? 0.1 : 0.07, tall ? 0.22 : 0.12),
    new THREE.MeshStandardMaterial({ color: 0xe4c36a, roughness: 0.4 })
  );
  nose.position.set(0, height * 0.62, (tall ? 0.72 : 0.28) + (tall ? 0.12 : 0.08));
  group.add(body, head, nose);
  return group;
}

let bodyProto = null;
let bodyHeight = 0;
let bodyMinY = 0;
const bodyCache = new Map();

function prepareBodies() {
  if (bodyProto) return true;
  try {
    const proto = createDreamHumanModel({
      castShadow: false,
      receiveShadow: false,
      flatMaterials: true,
      qualityPriority: "lane-readability"
    });
    proto.traverse((obj) => {
      if (!obj.isMesh) return;
      const slot = obj.userData.sculptComponent && obj.userData.sculptComponent.material;
      if (slot === "hidden" && obj.material) {
        obj.material.depthWrite = false;
        obj.material.colorWrite = false;
      }
    });
    proto.updateMatrixWorld(true);
    const box = new THREE.Box3();
    proto.traverse((obj) => {
      if (!obj.isMesh) return;
      const slot = obj.userData.sculptComponent && obj.userData.sculptComponent.material;
      if (slot === "hidden") return;
      box.expandByObject(obj);
    });
    const height = box.max.y - box.min.y;
    if (!(height > 0.4 && height < 8)) return false;
    bodyProto = proto;
    bodyHeight = height;
    bodyMinY = box.min.y;
    return true;
  } catch (error) {
    console.warn(error);
    return false;
  }
}

function tintModel(model, look, darken) {
  const swaps = new Map();
  model.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    let next = swaps.get(obj.material);
    if (!next) {
      next = obj.material.clone();
      const slot = obj.userData.sculptComponent && obj.userData.sculptComponent.material;
      if (typeof look[slot] === "number") next.color.setHex(look[slot]);
      if (slot === "shirt" || slot === "shoes") next.metalness = look.metal || 0;
      if (darken) next.color.multiplyScalar(0.62);
      next.depthWrite = slot !== "hidden";
      swaps.set(obj.material, next);
    }
    obj.material = next;
  });
}

function addProps(model, lookId, role) {
  const bones = model.userData.rig && model.userData.rig.bones;
  if (!bones) return;
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.8 });
  const iron = new THREE.MeshStandardMaterial({ color: 0xc5ccd4, roughness: 0.35, metalness: 0.6 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xe4c36a, roughness: 0.4, metalness: 0.5 });
  const ink = new THREE.MeshStandardMaterial({ color: 0x120e0c, roughness: 0.55 });
  if (role === "miner" && bones["hand-r"]) {
    const pick = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.72, 6), wood);
    pick.rotation.z = 0.8;
    pick.position.set(0.04, -0.22, 0.04);
    bones["hand-r"].add(pick);
  } else if (role === "swordwrath" && bones["hand-r"]) {
    const sword = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.95, 0.015), iron);
    sword.position.set(0, -0.42, 0.03);
    bones["hand-r"].add(sword);
  } else if (role === "archidon" && bones["chest"]) {
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.012, 6, 12, Math.PI), wood);
    bow.position.set(0.05, 0.05, -0.12);
    bow.rotation.y = Math.PI / 2;
    bones["chest"].add(bow);
  } else if (role === "spearton") {
    if (bones["hand-r"]) {
      const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.35, 6), wood);
      spear.position.set(0.04, -0.15, 0.05);
      bones["hand-r"].add(spear);
    }
    if (bones["hand-l"]) {
      const shield = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.04), iron);
      shield.position.set(0, -0.05, 0.1);
      bones["hand-l"].add(shield);
    }
  } else if (lookId === "wu" && bones.head) {
    const circlet = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 6, 16), gold);
    circlet.rotation.x = Math.PI / 2;
    circlet.position.set(0, 0.22, 0.03);
    bones.head.add(circlet);
  } else if (lookId === "tengu" && bones.head) {
    const mask = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.04), ink);
    mask.position.set(0, 0.02, 0.14);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.16, 5), gold);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, -0.02, 0.1);
    mask.add(beak);
    bones.head.add(mask);
  }
}

function rebindRig(model) {
  const rig = model.userData && model.userData.rig;
  if (!rig) return;
  let skeleton = null;
  model.traverse((obj) => {
    if (!skeleton && obj.isSkinnedMesh && obj.skeleton) skeleton = obj.skeleton;
  });
  if (!skeleton) return;
  const bones = {};
  for (const bone of skeleton.bones) {
    if (bone && bone.name) bones[bone.name] = bone;
  }
  rig.bones = bones;
  rig.skeleton = skeleton;
}

function makeBody(lookId, role, height, darken) {
  const key = lookId + "|" + (role || "") + "|" + (darken ? "d" : "n");
  let cached = bodyCache.get(key);
  if (!cached) {
    cached = SkeletonUtils.clone(bodyProto);
    rebindRig(cached);
    tintModel(cached, LOOKS[lookId] || LOOKS.oze, darken);
    addProps(cached, role ? null : lookId, role);
    bodyCache.set(key, cached);
  }
  const model = SkeletonUtils.clone(cached);
  rebindRig(model);
  const wrap = new THREE.Group();
  const scale = height / bodyHeight;
  model.scale.setScalar(scale);
  model.position.y = -bodyMinY * scale;
  wrap.add(model);
  wrap.userData.model = model;
  wrap.userData.shared = true;
  wrap.userData.phase = 0;
  return wrap;
}

function stepGait(wrap, dt, moving) {
  const model = wrap && wrap.userData.model;
  const bones = model && model.userData.rig && model.userData.rig.bones;
  if (!bones) return;
  wrap.userData.phase = (wrap.userData.phase || 0) + dt * (moving ? 7.5 : 0);
  const swing = moving ? Math.sin(wrap.userData.phase) : 0;
  const set = (id, angle) => {
    const bone = bones[id];
    if (bone) bone.rotation.x = angle;
  };
  set("thigh-l", swing * 0.7);
  set("thigh-r", -swing * 0.7);
  set("shin-l", Math.max(0, -swing) * 1.05);
  set("shin-r", Math.max(0, swing) * 1.05);
  set("upper-arm-l", -swing * 0.5);
  set("upper-arm-r", swing * 0.5);
}

let captainMesh = figure(0x3dff9a, false);
let playerStatue = figure(0xe4c36a, true);
let enemyStatue = figure(0x8b3a4a, true);
playerStatue.position.set(0, 0, PLAYER_Z);
enemyStatue.position.set(0, 0, ENEMY_Z);
enemyStatue.rotation.y = Math.PI;
scene.add(captainMesh, playerStatue, enemyStatue);

const meshes = new Map();
const keys = new Set();
const look = { yaw: 0, pitch: 0.42, dist: 6.5 };
let match = null;
let book = null;

window.__controlsTest = {
  getYaw: () => look.yaw,
  getCaptain: () => (match ? { x: match.captain.x, z: match.captain.z, facing: match.captain.facing } : null),
  getDream: () => (match ? match.dream : null),
  unitCount: () => (match ? match.units.filter((unit) => unit.side === "player").length : 0),
  units: () => (match ? match.units.map((unit) => ({ side: unit.side, role: unit.role, x: unit.x, z: unit.z })) : []),
  setLook: (yaw) => { look.yaw = yaw; },
  setKeys: (codes) => {
    keys.clear();
    for (const code of codes) keys.add(code);
  },
  clearKeys: () => keys.clear()
};

function resize() {
  const width = canvas.clientWidth || window.innerWidth;
  const height = canvas.clientHeight || window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(height, 1);
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);

function basis() {
  const raw = walkBasis(look.yaw);
  return {
    fwd: new THREE.Vector3(raw.fwd.x, 0, raw.fwd.z),
    right: new THREE.Vector3(raw.right.x, 0, raw.right.z)
  };
}

function frameCamera() {
  const target = captainMesh.position.clone();
  target.y += 1.45;
  const raw = cameraOffset(look.yaw, look.pitch, look.dist);
  const offset = new THREE.Vector3(raw.x, raw.y, raw.z);
  const desired = target.clone().add(offset);
  desired.y = Math.max(desired.y, 0.55);
  camera.position.copy(desired);
  camera.lookAt(target);
}

canvas.addEventListener("pointerdown", () => {
  if (match) canvas.requestPointerLock();
});
document.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement !== canvas) return;
  const sens = 0.0022;
  look.yaw -= event.movementX * sens;
  look.pitch = THREE.MathUtils.clamp(look.pitch + event.movementY * sens, 0.06, 1.3);
});
canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  look.dist = THREE.MathUtils.clamp(look.dist + Math.sign(event.deltaY) * 0.45, 2.5, 10);
}, { passive: false });

function paintHud() {
  const you = match.statues.player;
  const foe = match.statues.enemy;
  document.querySelector("#you-name").textContent = match.player.name;
  document.querySelector("#foe-name").textContent = match.enemy.name;
  document.querySelector("#you-hp i").style.width = Math.max(0, you.hp / you.max * 100) + "%";
  document.querySelector("#foe-hp i").style.width = Math.max(0, foe.hp / foe.max * 100) + "%";
  const item = match.player.tree[0].upgrade.loreItem;
  document.querySelector("#purse").textContent = Math.floor(match.dream) + " $DREAM · " + Math.floor(match.essence) + " essence · " + match.lore + " " + item;
  document.querySelector("#log").textContent = match.log;
  if (match.result) {
    document.querySelector("#end").hidden = false;
    document.querySelector("#end-title").textContent = match.result === "win" ? "Lane taken" : "Lane lost";
    document.querySelector("#end-copy").textContent = match.log;
  }
}

function releaseFigure(mesh) {
  scene.remove(mesh);
  if (!mesh.userData.shared) {
    mesh.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
    return;
  }
  let skeleton = null;
  mesh.traverse((child) => {
    if (!skeleton && child.isSkinnedMesh && child.skeleton) skeleton = child.skeleton;
  });
  if (skeleton) skeleton.dispose();
}

function syncUnits(dt) {
  const live = new Set();
  for (const unit of match.units) {
    live.add(unit.id);
    let mesh = meshes.get(unit.id);
    if (!mesh) {
      const enemy = unit.side === "enemy";
      mesh = bodyProto
        ? makeBody(unit.role, unit.role, 1.8, enemy)
        : figure(enemy ? 0x6e2433 : ROLE_COLOR[unit.role] || 0xd7e7df, false);
      scene.add(mesh);
      meshes.set(unit.id, mesh);
    }
    const moved = Math.abs(unit.z - (mesh.userData.lastZ ?? unit.z)) > 0.002
      || Math.abs(unit.x - (mesh.userData.lastX ?? unit.x)) > 0.002;
    mesh.userData.lastZ = unit.z;
    mesh.userData.lastX = unit.x;
    mesh.position.set(unit.x, 0, unit.z);
    mesh.rotation.y = unit.facing;
    mesh.scale.setScalar(0.9 + unit.rank * 0.08);
    stepGait(mesh, dt || 0, moved);
  }
  for (const [id, mesh] of meshes) {
    if (live.has(id)) continue;
    releaseFigure(mesh);
    meshes.delete(id);
  }
}

function clearField() {
  for (const mesh of meshes.values()) releaseFigure(mesh);
  meshes.clear();
}

function mountAnchors() {
  if (!prepareBodies()) return;
  releaseFigure(captainMesh);
  releaseFigure(playerStatue);
  releaseFigure(enemyStatue);
  captainMesh = makeBody(match.player.id, null, 1.8, false);
  playerStatue = makeBody(match.player.id, null, 2.5, false);
  enemyStatue = makeBody(match.enemy.id, null, 2.5, false);
  scene.add(captainMesh, playerStatue, enemyStatue);
  playerStatue.position.set(0, 0, PLAYER_Z);
  enemyStatue.position.set(0, 0, ENEMY_Z);
  enemyStatue.rotation.y = Math.PI;
}

function start(captainId) {
  clearField();
  match = createMatch(book, captainId);
  mountAnchors();
  document.querySelector("#gate").hidden = true;
  document.querySelector("#hud").hidden = false;
  document.querySelector("#end").hidden = true;
  const tree = document.querySelector("#tree");
  tree.replaceChildren();
  for (const node of match.player.tree) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = node.train
      ? node.tier + " " + node.name + " · " + node.train.dream
      : "Rite · " + node.skill;
    button.addEventListener("click", () => {
      if (node.train) train(match, node.tier);
      else castRite(match);
      paintHud();
    });
    tree.appendChild(button);
  }
  const upgrade = document.createElement("button");
  upgrade.type = "button";
  upgrade.textContent = "Upgrade nearest";
  upgrade.addEventListener("click", () => { upgradeNearest(match); paintHud(); });
  tree.appendChild(upgrade);
  captainMesh.position.set(match.captain.x, 0, match.captain.z);
  paintHud();
}

window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (!match || match.result) return;
  if (event.code === "Digit1") train(match, 1);
  if (event.code === "Digit2") train(match, 2);
  if (event.code === "Digit3") train(match, 3);
  if (event.code === "Digit4") train(match, 4);
  if (event.code === "KeyR") castRite(match);
  if (event.code === "KeyU") upgradeNearest(match);
  if (event.repeat) return;
  paintHud();
});
window.addEventListener("keyup", (event) => keys.delete(event.code));
window.addEventListener("blur", () => keys.clear());
document.querySelector("#again").addEventListener("click", () => {
  match = null;
  clearField();
  document.querySelector("#gate").hidden = false;
  document.querySelector("#hud").hidden = true;
  document.querySelector("#end").hidden = true;
  document.exitPointerLock?.();
});

async function loadBook() {
  for (const url of ["/v1/captains", "/data/captains.json"]) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch {
      /* the other path is for local preview */
    }
  }
  throw new Error("Captain book missing");
}

const roster = document.querySelector("#roster");
book = await loadBook();
for (const captain of book.captains) {
  const button = document.createElement("button");
  button.type = "button";
  const img = document.createElement("img");
  img.alt = "";
  img.src = captain.portrait || "";
  const name = document.createElement("strong");
  name.textContent = "GEN" + captain.gen + " " + captain.name;
  const role = document.createElement("span");
  role.textContent = captain.role;
  button.append(img, name, role);
  button.addEventListener("click", () => start(captain.id));
  roster.appendChild(button);
}
requestAnimationFrame(() => prepareBodies());

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (match && !match.result) {
    const { fwd, right } = basis();
    let x = 0;
    let z = 0;
    if (keys.has("KeyW") || keys.has("ArrowUp")) { x += fwd.x; z += fwd.z; }
    if (keys.has("KeyS") || keys.has("ArrowDown")) { x -= fwd.x; z -= fwd.z; }
    if (keys.has("KeyD") || keys.has("ArrowRight")) { x += right.x; z += right.z; }
    if (keys.has("KeyA") || keys.has("ArrowLeft")) { x -= right.x; z -= right.z; }
    const len = Math.hypot(x, z);
    if (len > 0) { x /= len; z /= len; }
    moveCaptain(match, x, z, dt);
    step(match, dt);
    captainMesh.position.set(match.captain.x, 0, match.captain.z);
    captainMesh.rotation.y = match.captain.facing;
    stepGait(captainMesh, dt, len > 0);
    syncUnits(dt);
    paintHud();
  }
  frameCamera();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
resize();
frameCamera();
requestAnimationFrame(loop);
