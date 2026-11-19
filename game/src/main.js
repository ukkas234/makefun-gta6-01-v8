// Solmara v9 — game loop: drive the loop, wanted level + police chase,
// traffic, and one pickup/deliver contract with a saved best result.
// Original work only: no real-world names, maps or assets.
import { makePlayer } from './player.js';
import { makeCar } from './vehicles.js';
import { createScene } from './render.js';
import { wrapZ, loopDelta, collideCircle, PEDS, PICKUP, DELIVERY } from './world.js';
import { CAR, POLICE, TRAFFIC, PLAYER, WANTED, MISSION, BEST_KEY } from './config.js';
import { createRandom } from './random.js';

const root = document.querySelector('#view');
const player = makePlayer(), car = makeCar();
const keys = new Set(), params = new URLSearchParams(location.search);
player.heading = 0; car.x = 2; car.z = -6;
let driving = false, night = false, last = performance.now(), elapsed = 0;
const hud = {
  objective: document.querySelector('#objective'),
  objectiveSub: document.querySelector('.mission span'),
  status: document.querySelector('#status'),
  speed: document.querySelector('#speed'),
  speednum: document.querySelector('#speednum'),
  clock: document.querySelector('#clock'),
};

// --- wanted / police state ---
let wanted = 0, lastOffenseAt = -1e9, decayTimer = 0;
const police = []; // {x,z,heading,speed,mode:'pursue'|'block',hitAt}
const policeCooldown = new Map();

// --- traffic state (deterministic seed so the staged shots repeat) ---
const rng = createRandom(7);
const traffic = [];
for (let i = 0; i < TRAFFIC.count; i++) {
  const dir = i % 2 ? 1 : -1;
  traffic.push({
    x: dir > 0 ? -TRAFFIC.laneX : TRAFFIC.laneX,
    z: -60 + i * 32 + rng() * 8,
    heading: dir > 0 ? Math.PI : 0,
    speed: TRAFFIC.minSpeed + rng() * (TRAFFIC.maxSpeed - TRAFFIC.minSpeed),
    dir, hitAt: -1e9,
  });
}

// --- pedestrians (ramming one knocks them down and raises wanted) ---
const peds = PEDS.map((p) => ({ ...p, downUntil: 0 }));

// --- mission: pickup at the south quay, deliver at the Low Tide bar ---
let best = { deliveries: 0, bestTime: null };
try { const saved = JSON.parse(localStorage.getItem(BEST_KEY) || 'null'); if (saved) best = saved; } catch {}
const mission = { stage: 0, deliveries: best.deliveries, bestTime: best.bestTime, stageStart: 0, completeUntil: 0 };
function saveBest() {
  try { localStorage.setItem(BEST_KEY, JSON.stringify({ deliveries: mission.deliveries, bestTime: mission.bestTime })); } catch {}
}
function missionTarget() {
  if (mission.stage === 0) return PICKUP;
  if (mission.stage === 1) return DELIVERY;
  return null;
}
function setObjective(text, sub) {
  hud.objective.textContent = text;
  if (sub !== undefined) hud.objectiveSub.textContent = sub;
}
function bestLine() {
  return mission.bestTime == null
    ? `Deliveries: ${mission.deliveries} · Best time: —`
    : `Deliveries: ${mission.deliveries} · Best time: ${mission.bestTime.toFixed(1)}s`;
}
function updateStatus() {
  const stars = wanted > 0 ? ' · WANTED ' + '★'.repeat(wanted) + '☆'.repeat(WANTED.max - wanted) : '';
  hud.status.textContent = (driving ? 'DRIVING · MARINER' : 'ON FOOT') + stars;
  hud.status.classList.toggle('hot', wanted > 0);
}
function raiseWanted(n) {
  if (wanted >= WANTED.max) return;
  wanted = Math.min(WANTED.max, wanted + n);
  lastOffenseAt = elapsed; decayTimer = 0;
  updateStatus();
}

// --- shot setups (staged views for screenshots) ---
if (params.get('shot') === 'drive' || params.get('shot') === 'chase') {
  car.x = 1; car.z = 15; car.speed = 7; player.z = 19; driving = true;
  setObjective('Drive the harbor service road', bestLine());
  hud.status.textContent = 'DRIVING · MARINER'; hud.speed.classList.remove('hide'); hud.speednum.textContent = '48';
  traffic[0].z = -12; traffic[0].x = -TRAFFIC.laneX; traffic[0].dir = 1; traffic[0].heading = Math.PI;
  traffic[1].z = -38; traffic[1].x = TRAFFIC.laneX; traffic[1].dir = -1; traffic[1].heading = 0;
  // Keep the default drive path clear so the staged shot shows driving, not a crash.
  traffic[2].z = 32; traffic[2].x = TRAFFIC.laneX; traffic[2].dir = -1; traffic[2].heading = 0;
  traffic[3].z = -62; traffic[3].x = -TRAFFIC.laneX; traffic[3].dir = 1; traffic[3].heading = Math.PI;
}
if (params.get('shot') === 'chase') {
  car.x = -2; car.z = -18; car.speed = 11; hud.speednum.textContent = '77';
  wanted = 2; lastOffenseAt = elapsed; updateStatus();
  spawnPolice();
}
if (params.get('shot') === 'night') {
  night = true; hud.clock.textContent = '21:16 · BLUE HOUR';
  wanted = 1; lastOffenseAt = elapsed; updateStatus();
  spawnPolice();
}
if (!params.get('shot')) setObjective('Pick up the parcel at Quay 04', bestLine());

function spawnPolice() {
  const actor = driving ? car : player;
  while (police.filter((p) => p.mode === 'pursue').length < POLICE.count) {
    const i = police.filter((p) => p.mode === 'pursue').length;
    const side = i % 2 ? 1 : -1;
    // Behind the actor: forward is (sin h, -cos h), so behind is -forward * 22.
    police.push({
      x: actor.x - Math.sin(actor.heading) * POLICE.spawnBehind + Math.cos(actor.heading) * side * 3,
      z: wrapZ(actor.z + Math.cos(actor.heading) * POLICE.spawnBehind + Math.sin(actor.heading) * side * 3),
      heading: actor.heading, speed: 8, mode: 'pursue', hitAt: -1e9,
    });
  }
}
function spawnRoadblock() {
  const actor = driving ? car : player;
  const aheadZ = wrapZ(actor.z - Math.cos(actor.heading) * 35);
  for (const x of [-2.5, 2.5]) {
    police.push({ x, z: aheadZ, heading: Math.PI / 2, speed: 0, mode: 'block', hitAt: -1e9 });
  }
}
function clearRoadblock() {
  for (let i = police.length - 1; i >= 0; i--) if (police[i].mode === 'block') police.splice(i, 1);
}

const world = createScene(root, player, car);
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyE') enterExit();
  if (e.code === 'KeyN') toggleNight();
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));

function enterExit() {
  if (!driving && Math.hypot(player.x - car.x, loopDelta(car.z, player.z)) < 5) {
    driving = true;
    setObjective(mission.stage === 0 ? 'Pick up the parcel at Quay 04' : 'Deliver the parcel to the Low Tide bar', bestLine());
    hud.status.textContent = 'DRIVING · MARINER'; hud.speed.classList.remove('hide');
  } else if (driving) {
    driving = false; player.x = car.x - 2; player.z = car.z; car.speed = 0;
    const fixed = collideCircle(player.x, player.z, PLAYER.radius);
    player.x = fixed.x; player.z = fixed.z;
    hud.status.textContent = 'ON FOOT'; hud.speed.classList.add('hide');
  }
  updateStatus();
}
function toggleNight() {
  night = !night;
  hud.clock.textContent = night ? '21:16 · BLUE HOUR' : '18:42 · GOLDEN HOUR';
}

function pushOutOfCar(cx, cz) {
  // A car is 1.7 wide x 3.6 long, so its corners reach ~2.0 from its center:
  // a 1.3 circle lets the bumper visually swallow Kai. Use 2.0.
  const hit = circleHit(player.x, player.z, PLAYER.radius, cx, cz, 2.0);
  if (hit) {
    player.x -= (hit.dx / hit.d) * (hit.r - hit.d);
    player.z -= (hit.dz / hit.d) * (hit.r - hit.d);
  }
}

function wrapActor(obj) {
  const oz = obj.z;
  obj.z = wrapZ(obj.z);
  if (obj.z !== oz) world.camera.position.z += obj.z - oz; // keep the camera continuous
}
function circleHit(ax, az, ar, bx, bz, br) {
  const dx = bx - ax, dz = loopDelta(az, bz);
  const d2 = dx * dx + dz * dz, r = ar + br;
  return d2 < r * r ? { dx, dz, d: Math.sqrt(d2) || .001, r } : null;
}

function updatePolice(dt) {
  const actor = driving ? car : player;
  if (wanted >= 1) spawnPolice();
  if (wanted >= WANTED.roadblockAt && !police.some((p) => p.mode === 'block')) spawnRoadblock();
  if (wanted < WANTED.roadblockAt) clearRoadblock();
  if (wanted === 0) for (let i = police.length - 1; i >= 0; i--) if (police[i].mode === 'pursue') police.splice(i, 1);
  for (const pc of police) {
    if (pc.mode === 'block') continue;
    const dx = actor.x - pc.x, dz = loopDelta(pc.z, actor.z);
    const desired = Math.atan2(dx, -dz);
    let dh = desired - pc.heading;
    while (dh > Math.PI) dh -= 2 * Math.PI;
    while (dh < -Math.PI) dh += 2 * Math.PI;
    pc.heading += Math.max(-POLICE.turn * dt, Math.min(POLICE.turn * dt, dh));
    pc.speed = Math.min(POLICE.maxSpeed, pc.speed + POLICE.accel * dt);
    if (Math.abs(dh) > .6) pc.speed = Math.min(pc.speed, 8);
    pc.x += Math.sin(pc.heading) * pc.speed * dt;
    pc.z -= Math.cos(pc.heading) * pc.speed * dt;
    pc.x = Math.max(-12, Math.min(12, pc.x));
    wrapActor(pc);
    const c = collideCircle(pc.x, pc.z, CAR.radius);
    if (c.hit) { pc.x = c.x; pc.z = c.z; pc.speed *= .5; }
  }
  // Keep the two pursuers from stacking on each other. If they are exactly
  // coincident the separation axis is undefined, so push them apart in x.
  for (let i = 0; i < police.length; i++) for (let j = i + 1; j < police.length; j++) {
    const a = police[i], b = police[j];
    const hit = circleHit(a.x, a.z, 1.3, b.x, b.z, 1.3);
    if (hit) {
      const push = (hit.r - hit.d) / 2;
      const px = hit.d < .05 ? 1 : hit.dx / hit.d;
      const pz = hit.d < .05 ? 0 : hit.dz / hit.d;
      a.x -= px * push; a.z -= pz * push;
      b.x += px * push; b.z += pz * push;
    }
  }
}

function updateTraffic(dt) {
  for (const tc of traffic) {
    tc.z += tc.dir * tc.speed * dt;
    tc.z = wrapZ(tc.z);
  }
}

function collideCar(dt) {
  // Buildings / walls.
  const c = collideCircle(car.x, car.z, CAR.radius);
  if (c.hit) { car.x = c.x; car.z = c.z; car.speed *= -.25; }
  // Parked cars (static circles).
  for (const pk of world.parked) {
    const hit = circleHit(car.x, car.z, CAR.radius, pk.x, pk.z, 1.3);
    if (hit) {
      car.x -= (hit.dx / hit.d) * (hit.r - hit.d); car.z -= (hit.dz / hit.d) * (hit.r - hit.d);
      car.speed *= .4;
    }
  }
  // Traffic cars.
  for (const tc of traffic) {
    const hit = circleHit(car.x, car.z, CAR.radius, tc.x, tc.z, 1.3);
    if (hit) {
      const impact = Math.abs(car.speed);
      car.x -= (hit.dx / hit.d) * (hit.r - hit.d) * .7; car.z -= (hit.dz / hit.d) * (hit.r - hit.d) * .7;
      car.speed *= .5;
      if (impact > 6 && elapsed - tc.hitAt > 3) { tc.hitAt = elapsed; raiseWanted(1); }
    }
  }
  // Police cars.
  for (const pc of police) {
    const hit = circleHit(car.x, car.z, CAR.radius, pc.x, pc.z, 1.3);
    if (hit) {
      car.x -= (hit.dx / hit.d) * (hit.r - hit.d) * .7; car.z -= (hit.dz / hit.d) * (hit.r - hit.d) * .7;
      car.speed *= .6;
      if (Math.abs(car.speed) > 5 && elapsed - pc.hitAt > 3) { pc.hitAt = elapsed; raiseWanted(1); }
    }
  }
  // Pedestrians on the sidewalk.
  for (const pd of peds) {
    if (elapsed < pd.downUntil) continue;
    const hit = circleHit(car.x, car.z, CAR.radius, pd.x, pd.z, .6);
    if (hit) { pd.downUntil = elapsed + 20; raiseWanted(1); car.speed *= .7; }
  }
}

function updateMission(dt) {
  const actor = driving ? car : player;
  if (mission.stage === 2) {
    if (elapsed > mission.completeUntil) {
      mission.stage = 0;
      setObjective('Pick up the parcel at Quay 04', bestLine());
    }
    return;
  }
  const t = missionTarget();
  if (!t) return;
  const dx = actor.x - t.x, dz = loopDelta(actor.z, t.z);
  if (dx * dx + dz * dz < MISSION.radius * MISSION.radius) {
    if (mission.stage === 0) {
      mission.stage = 1; mission.stageStart = elapsed;
      setObjective('Deliver the parcel to the Low Tide bar', bestLine());
    } else {
      const t2 = elapsed - mission.stageStart;
      mission.deliveries++;
      if (mission.bestTime == null || t2 < mission.bestTime) mission.bestTime = t2;
      saveBest();
      mission.stage = 2; mission.completeUntil = elapsed + 4;
      setObjective(`Contract complete — ${t2.toFixed(1)}s`, bestLine());
    }
  }
}

function updateWanted(dt) {
  if (wanted === 0) return;
  if (elapsed - lastOffenseAt < WANTED.decayAfter) { decayTimer = 0; return; }
  const actor = driving ? car : player;
  const near = police.some((pc) => {
    const dx = pc.x - actor.x, dz = loopDelta(actor.z, pc.z);
    return dx * dx + dz * dz < WANTED.policeNear * WANTED.policeNear;
  });
  if (near) { decayTimer = 0; return; }
  decayTimer += dt;
  if (decayTimer >= WANTED.decayEvery) {
    wanted--; decayTimer = 0;
    if (wanted < WANTED.roadblockAt) clearRoadblock();
    updateStatus();
  }
}

function mapDraw() {
  const c = document.querySelector('#mapcanvas'), x = c.getContext('2d');
  const actor = driving ? car : player;
  const mz = wrapZ(actor.z);
  x.fillStyle = '#52716d'; x.fillRect(0, 0, 140, 140);
  x.fillStyle = '#315f68'; x.fillRect(0, 0, 140, 23); // the bay, north
  x.fillStyle = '#364644'; x.fillRect(55, 0, 32, 140); // the road
  x.fillStyle = '#d3c5a2'; x.fillRect(66, 20, 3, 120);
  x.fillStyle = '#f4c477';
  const t = missionTarget();
  if (t) { // mission marker
    x.beginPath(); x.arc(70 + t.x * 2, 70 - wrapZ(t.z) * .45, 5, 0, 7); x.fill();
    x.strokeStyle = '#f4c477'; x.stroke();
  }
  for (const pc of police) { // police dots
    x.fillStyle = '#e5534b';
    x.beginPath(); x.arc(70 + pc.x * 2, 70 - wrapZ(pc.z) * .45, 3, 0, 7); x.fill();
  }
  x.fillStyle = '#f4c477';
  x.beginPath(); x.arc(70 + actor.x * 2, 70 - mz * .45, 4, 0, 7); x.fill();
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, .04);
  last = now; elapsed += dt;
  if (driving) {
    car.speed += (keys.has('KeyW') ? CAR.accel : 0) - (keys.has('KeyS') ? CAR.brake : 0);
    car.speed *= Math.pow(.98, dt * 60);
    car.speed = Math.max(CAR.minSpeed, Math.min(CAR.maxSpeed, car.speed));
    if (Math.abs(car.speed) > .2) car.heading += (keys.has('KeyA') ? 1 : keys.has('KeyD') ? -1 : 0) * dt * CAR.turn * Math.sign(car.speed);
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z -= Math.cos(car.heading) * car.speed * dt;
    car.x = Math.max(-12.5, Math.min(12.5, car.x));
    wrapActor(car);
    collideCar(dt);
    hud.speednum.textContent = String(Math.round(Math.abs(car.speed) * 7)).padStart(2, '0');
  } else {
    const dx = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    const dz = (keys.has('KeyS') ? 1 : 0) - (keys.has('KeyW') ? 1 : 0);
    const s = keys.has('ShiftLeft') ? PLAYER.run : PLAYER.walk;
    player.x = Math.max(-50, Math.min(55, player.x + dx * s * dt));
    player.z += dz * s * dt;
    wrapActor(player);
    const fixed = collideCircle(player.x, player.z, PLAYER.radius);
    player.x = fixed.x; player.z = fixed.z;
    // Traffic, police and parked cars must not drive through Kai on foot:
    // shove him aside instead of letting the car pass through him.
    for (const tc of traffic) pushOutOfCar(tc.x, tc.z);
    for (const pc of police) pushOutOfCar(pc.x, pc.z);
    for (const pk of world.parked) pushOutOfCar(pk.x, pk.z);
    if (dx || dz) { player.heading = Math.atan2(dx, -dz); player.walking = keys.has('ShiftLeft') ? 1.5 : 1; }
    else player.walking = 0;
  }
  updateTraffic(dt);
  updatePolice(dt);
  // Cars move after the player does: push Kai out of any car that drove into
  // him this frame, so a traffic car never renders on top of him.
  if (!driving) {
    for (const tc of traffic) pushOutOfCar(tc.x, tc.z);
    for (const pc of police) pushOutOfCar(pc.x, pc.z);
    for (const pk of world.parked) pushOutOfCar(pk.x, pk.z);
  }
  updateMission(dt);
  updateWanted(dt);
  world.render(dt, {
    driving, night, time: elapsed,
    chase: params.get('shot') === 'chase',
    wanted, police, traffic, peds,
    mission: missionTarget(),
  });
  mapDraw();
  window.__wanted = wanted;
  window.__police = police.map((p) => ({ x: +p.x.toFixed(1), z: +p.z.toFixed(1), mode: p.mode }));
  window.__traffic = traffic.map((t) => ({ x: +t.x.toFixed(1), z: +t.z.toFixed(1) }));
  window.__mission = { stage: mission.stage, deliveries: mission.deliveries, bestTime: mission.bestTime };
}
requestAnimationFrame(frame);
window.__shotReady = true;
window.__renderer = world.renderer;
window.__webglContext = world.renderer.getContext();
window.__game = {
  player, car, enterExit, toggleNight, isDriving: () => driving,
  wanted: () => wanted, police, traffic, mission, peds,
};
