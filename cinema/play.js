import * as THREE from "three";
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

const captainMesh = figure(0x3dff9a, false);
const playerStatue = figure(0xe4c36a, true);
const enemyStatue = figure(0x8b3a4a, true);
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

function syncUnits() {
  const live = new Set();
  for (const unit of match.units) {
    live.add(unit.id);
    let mesh = meshes.get(unit.id);
    if (!mesh) {
      mesh = figure(unit.side === "enemy" ? 0x6e2433 : ROLE_COLOR[unit.role] || 0xd7e7df, false);
      scene.add(mesh);
      meshes.set(unit.id, mesh);
    }
    mesh.position.set(unit.x, 0, unit.z);
    mesh.rotation.y = unit.facing;
    mesh.scale.setScalar(0.9 + unit.rank * 0.08);
  }
  for (const [id, mesh] of meshes) {
    if (live.has(id)) continue;
    scene.remove(mesh);
    mesh.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
    meshes.delete(id);
  }
}

function clearField() {
  for (const mesh of meshes.values()) scene.remove(mesh);
  meshes.clear();
}

function start(captainId) {
  clearField();
  match = createMatch(book, captainId);
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
    syncUnits();
    paintHud();
  }
  frameCamera();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
resize();
frameCamera();
requestAnimationFrame(loop);
