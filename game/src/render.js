// Solmara v9 — renderer. PS2-era coastal street: the road tile repeats every
// LOOP units (three copies drawn, collision uses the base tile), houses get
// windows on both street faces, signs/beach/Ferris wheel fill the skyline,
// and police cars, traffic, a helicopter and mission markers are drawn from
// the state main.js hands in each frame. No shadow maps; instancing keeps the
// draw-call count low enough for SwiftShader to hold ~30 FPS.
import * as THREE from '../vendor/three.module.js';
import { BUILDINGS, CHURCH, PEDS, SIGNS, BEACH, FERRIS, LOOP, HALF_LOOP } from './world.js';
import { buildCarBody, TRAFFIC_COLORS, mergedMesh, boxPart, sphPart } from './vehicles.js';

const mat = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const box = new THREE.BoxGeometry(1, 1, 1);
function cube(parent, material, x, y, z, sx, sy, sz) {
  const o = new THREE.Mesh(box, material);
  o.position.set(x, y, z); o.scale.set(sx, sy, sz); parent.add(o); return o;
}
function asphaltTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512;
  const x = c.getContext('2d'); x.fillStyle = '#62615b'; x.fillRect(0, 0, 256, 512);
  let seed = 29;
  for (let i = 0; i < 4200; i++) {
    seed = (seed * 16807) % 2147483647; const px = seed % 256;
    seed = (seed * 16807) % 2147483647; const py = seed % 512;
    x.fillStyle = i % 3 ? 'rgba(27,27,24,.18)' : 'rgba(220,204,167,.16)';
    x.fillRect(px, py, 1 + (i % 5), 1 + (i % 2));
  }
  x.strokeStyle = 'rgba(34,33,30,.65)'; x.lineWidth = 2;
  for (const [sx, sy] of [[23, 35], [188, 96], [72, 189], [215, 272], [34, 391], [167, 459]]) {
    x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + 5, sy + 12); x.lineTo(sx - 2, sy + 20); x.lineTo(sx + 8, sy + 34); x.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 22);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; return t;
}
function signTexture(text, sub, bg, fg, neon) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 512, 128);
  x.strokeStyle = fg; x.lineWidth = 6; x.strokeRect(8, 8, 496, 112);
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = 'bold 64px Arial';
  if (neon) { x.shadowColor = fg; x.shadowBlur = 24; }
  x.fillText(text, 256, sub ? 52 : 64);
  if (sub) { x.shadowBlur = 0; x.font = 'bold 28px Arial'; x.fillText(sub, 256, 100); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createScene(root, player, car) {
  const shotMode = new URLSearchParams(location.search).has('shot');
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'low-power' });
  // Staged screenshots render crisp; gameplay uses a dynamic internal
  // resolution (PS2 ran ~640x448) that steps down to hold 30 FPS on SwiftShader.
  let pixelRatio = shotMode ? .8 : .45;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, pixelRatio));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.18;
  root.appendChild(renderer.domElement); renderer.domElement.id = 'world';
  const scene = new THREE.Scene();
  window.__scene = scene; // exposed for debugging/inspection
  scene.background = new THREE.Color('#68b8ed'); scene.fog = new THREE.Fog('#dda366', 38, 103);
  const camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, .1, 260);
  scene.add(new THREE.HemisphereLight('#c4e5ff', '#8d6040', 1.5));
  const sun = new THREE.DirectionalLight('#ffad55', 2.25); sun.position.set(-24, 38, 15); scene.add(sun);
  const dummy = new THREE.Object3D();
  const copies = [-LOOP, 0, LOOP];

  const sand = mat('#bc986b'), road = new THREE.MeshLambertMaterial({ map: asphaltTexture() });
  const sidewalk = mat('#bba88c'), yellow = mat('#b89236'), brick = mat('#8b6548');
  const roof = mat('#59483d'), dark = mat('#292b29'), glass = mat('#5c8587');
  const green = mat('#466446'), trunk = mat('#70503a');
  cube(scene, sand, 0, -.36, 0, 250, .5, LOOP * 3 + 10);
  const roadway = new THREE.Mesh(new THREE.PlaneGeometry(18, LOOP * 3), road);
  roadway.rotation.x = -Math.PI / 2; roadway.position.set(0, -.045, 0); scene.add(roadway);
  // Narrow walkways, curb edges, and time-worn double center lines.
  // One InstancedMesh per strip type (not a mesh per strip): 4 calls, not 12.
  function strip(material, count) { const m = new THREE.InstancedMesh(box, material, count); scene.add(m); return m; }
  const walks = strip(sidewalk, 2), curbs = strip(mat('#8d806e'), 2), walls = strip(brick, 6), lines = strip(yellow, 2);
  for (const side of [-1, 1]) {
    const si = side < 0 ? 0 : 1;
    dummy.position.set(side * 10, .02, 0); dummy.rotation.set(0, 0, 0);
    dummy.scale.set(2.6, .16, LOOP * 3); dummy.updateMatrix(); walks.setMatrixAt(si, dummy.matrix);
    dummy.position.set(side * 8.65, .075, 0); dummy.scale.set(.16, .13, LOOP * 3);
    dummy.updateMatrix(); curbs.setMatrixAt(si, dummy.matrix);
    // Brick walls stop short of the tile seam: the gap at z > 62 is the
    // on-foot way through to the beach. One segment per tile copy.
    for (let k = 0; k < 3; k++) {
      dummy.position.set(side * 13, .48, -6.5 + copies[k]); dummy.scale.set(.45, .8, 137);
      dummy.updateMatrix(); walls.setMatrixAt(k * 2 + si, dummy.matrix);
    }
  }
  for (let i = 0; i < 2; i++) {
    dummy.position.set(i ? .13 : -.13, .025, 0); dummy.rotation.set(0, 0, 0);
    dummy.scale.set(.11, .025, LOOP * 3); dummy.updateMatrix(); lines.setMatrixAt(i, dummy.matrix);
  }
  walks.instanceMatrix.needsUpdate = true; curbs.instanceMatrix.needsUpdate = true;
  walls.instanceMatrix.needsUpdate = true; lines.instanceMatrix.needsUpdate = true;

  // Houses, instanced: bodies (per-instance color), roofs, doors, and windows.
  // Each window is ONE textured plane (frame + glass painted in the texture),
  // not a separate glass box plus frame box — half the instances, one call.
  const nH = BUILDINGS.length * 3;
  const bodies = new THREE.InstancedMesh(box, mat('#ffffff'), nH);
  const roofs = new THREE.InstancedMesh(box, roof, nH);
  const doors = new THREE.InstancedMesh(box, dark, nH);
  const winCanvas = document.createElement('canvas'); winCanvas.width = winCanvas.height = 64;
  const wx = winCanvas.getContext('2d');
  wx.fillStyle = '#292b29'; wx.fillRect(0, 0, 64, 64);
  wx.fillStyle = '#5c8587'; wx.fillRect(6, 6, 52, 52);
  wx.fillStyle = '#7fa3a5'; wx.fillRect(6, 6, 52, 14);
  wx.fillStyle = '#292b29'; wx.fillRect(30, 6, 4, 52);
  const winTex = new THREE.CanvasTexture(winCanvas); winTex.colorSpace = THREE.SRGBColorSpace;
  const winMesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1.65, 1.75),
    new THREE.MeshLambertMaterial({ map: winTex }), nH * 4);
  const col = new THREE.Color();
  let hi = 0, wi = 0;
  for (const off of copies) for (const b of BUILDINGS) {
    const z = b.z + off;
    dummy.position.set(b.x, b.h / 2, z); dummy.rotation.set(0, 0, 0);
    dummy.scale.set(b.w, b.h, b.d); dummy.updateMatrix(); bodies.setMatrixAt(hi, dummy.matrix);
    bodies.setColorAt(hi, col.set(b.color));
    dummy.position.set(b.x, b.h + .14, z); dummy.scale.set(b.w + 1, .32, b.d + 1);
    dummy.updateMatrix(); roofs.setMatrixAt(hi, dummy.matrix);
    dummy.position.set(b.x, b.h * .34, z + b.d / 2 + .04); dummy.scale.set(1.7, b.h * .68, .12);
    dummy.updateMatrix(); doors.setMatrixAt(hi, dummy.matrix);
    hi++;
    // Two front windows + two street-facing side windows. Planes face outward.
    const faceDir = b.x < 0 ? 1 : -1; // side of the house toward the road
    const wins = [
      { x: b.x - b.w * .27, y: 3.5, z: z - b.d / 2 - .05, ry: Math.PI },
      { x: b.x + b.w * .27, y: 3.5, z: z - b.d / 2 - .05, ry: Math.PI },
      { x: b.x + faceDir * (b.w / 2 + .05), y: 3.5, z: z - b.d * .27, ry: faceDir > 0 ? Math.PI / 2 : -Math.PI / 2 },
      { x: b.x + faceDir * (b.w / 2 + .05), y: 3.5, z: z + b.d * .27, ry: faceDir > 0 ? Math.PI / 2 : -Math.PI / 2 },
    ];
    for (const wn of wins) {
      dummy.position.set(wn.x, wn.y, wn.z); dummy.rotation.set(0, wn.ry, 0);
      dummy.scale.set(1, 1, 1); dummy.updateMatrix(); winMesh.setMatrixAt(wi++, dummy.matrix);
    }
  }
  bodies.instanceMatrix.needsUpdate = true; roofs.instanceMatrix.needsUpdate = true;
  doors.instanceMatrix.needsUpdate = true; winMesh.instanceMatrix.needsUpdate = true;
  if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
  scene.add(bodies, roofs, doors, winMesh);

  // Church silhouette, instanced across the three tile copies.
  const churchMat = mat('#bd9d77');
  const churchBody = new THREE.InstancedMesh(box, churchMat, 3);
  const churchTower = new THREE.InstancedMesh(box, churchMat, 6);
  const churchCone = new THREE.InstancedMesh(new THREE.ConeGeometry(1.1, 4, 5), churchMat, 6);
  for (let k = 0; k < 3; k++) {
    const z = CHURCH.z + copies[k];
    dummy.position.set(CHURCH.x, 6, z); dummy.rotation.set(0, 0, 0);
    dummy.scale.set(12, 12, 10); dummy.updateMatrix(); churchBody.setMatrixAt(k, dummy.matrix);
    for (let t = 0; t < 2; t++) {
      const x = t ? -27 : -35;
      dummy.position.set(x, 13, z); dummy.scale.set(1.2, 9, 1.2);
      dummy.updateMatrix(); churchTower.setMatrixAt(k * 2 + t, dummy.matrix);
      dummy.position.set(x, 19, z); dummy.scale.set(1, 1, 1);
      dummy.updateMatrix(); churchCone.setMatrixAt(k * 2 + t, dummy.matrix);
    }
  }
  churchBody.instanceMatrix.needsUpdate = true; churchTower.instanceMatrix.needsUpdate = true;
  churchCone.instanceMatrix.needsUpdate = true;
  scene.add(churchBody, churchTower, churchCone);

  // Haze-soft distant downtown + overpass, instanced across the tile copies.
  const distant = mat('#9b806f');
  const skyBoxes = new THREE.InstancedMesh(box, distant, 13 * 3);
  const overBeam = new THREE.InstancedMesh(box, distant, 3);
  const overPillar = new THREE.InstancedMesh(box, distant, 4 * 3);
  let si = 0, pi = 0;
  for (let k = 0; k < 3; k++) {
    const off = copies[k];
    for (let i = 0; i < 13; i++) {
      const x = -58 + i * 9, h = 12 + (i % 4) * 7;
      dummy.position.set(x, h / 2, -87 + off); dummy.rotation.set(0, 0, 0);
      dummy.scale.set(7, h, 7); dummy.updateMatrix(); skyBoxes.setMatrixAt(si++, dummy.matrix);
    }
    dummy.position.set(0, 13, -69 + off); dummy.scale.set(52, 1.3, 3);
    dummy.updateMatrix(); overBeam.setMatrixAt(k, dummy.matrix);
    for (let p = 0; p < 4; p++) {
      dummy.position.set([-23, -9, 9, 23][p], 6.5, -69 + off); dummy.scale.set(1.2, 13, 2);
      dummy.updateMatrix(); overPillar.setMatrixAt(pi++, dummy.matrix);
    }
  }
  skyBoxes.instanceMatrix.needsUpdate = true; overBeam.instanceMatrix.needsUpdate = true;
  overPillar.instanceMatrix.needsUpdate = true;
  scene.add(skyBoxes, overBeam, overPillar);

  // Palm rows, instanced across the three tile copies. Three leaves per palm —
  // the vertex cost of 252 leaf instances was a real FPS drag.
  const palmT = new THREE.InstancedMesh(box, trunk, 10 * 3);
  const palmF = new THREE.InstancedMesh(box, green, 30 * 3);
  let leafIndex = 0, trunkIndex = 0;
  for (const off of copies) for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
    const x = side * (15.5 + (i % 2) * .8), z = 60 - i * 28 + off;
    dummy.position.set(x, 4.3, z); dummy.rotation.set(0, 0, side * .06);
    dummy.scale.set(.5, 8.6, .5); dummy.updateMatrix(); palmT.setMatrixAt(trunkIndex++, dummy.matrix);
    for (let a = 0; a < 3; a++) {
      dummy.position.set(x + Math.sin(a * Math.PI / 1.5) * 2, 8.55, z + Math.cos(a * Math.PI / 1.5) * 2);
      dummy.rotation.set(0, a * Math.PI / 1.5, -.2); dummy.scale.set(1.05, .17, 4.5);
      dummy.updateMatrix(); palmF.setMatrixAt(leafIndex++, dummy.matrix);
    }
  }
  palmT.instanceMatrix.needsUpdate = true; palmF.instanceMatrix.needsUpdate = true;
  scene.add(palmT, palmF);

  // Signs with canvas textures (original names only). One copy each: all four
  // sit far from the loop seam, so no copy is needed.
  for (const s of SIGNS) {
    const tex = signTexture(s.text, s.sub, s.bg, s.fg, s.neon);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    m.position.set(s.x + (s.face > 0 ? .15 : -.15), s.y, s.z);
    m.rotation.y = s.face > 0 ? Math.PI / 2 : -Math.PI / 2;
    scene.add(m);
  }

  // Beach strip + water to the east, with umbrellas.
  const water = new THREE.Mesh(new THREE.PlaneGeometry(69, LOOP * 3 + 10), mat('#4a7d8a'));
  water.rotation.x = -Math.PI / 2; water.position.set(BEACH.waterX0 + 34.5, -.05, 0); scene.add(water);
  const wetSand = new THREE.Mesh(new THREE.PlaneGeometry(BEACH.x1 - BEACH.x0, LOOP * 3 + 10), mat('#a8875e'));
  wetSand.rotation.x = -Math.PI / 2; wetSand.position.set((BEACH.x0 + BEACH.x1) / 2, -.02, 0); scene.add(wetSand);
  const umbPole = new THREE.InstancedMesh(new THREE.CylinderGeometry(.09, .09, 2.4, 6), mat('#d8cdb2'), 9);
  const umbTop = new THREE.InstancedMesh(new THREE.ConeGeometry(1.9, 1.1, 8), mat('#c25b4a'), 9);
  let ui = 0;
  for (const off of copies) for (const z of [-40, 5, 45]) {
    dummy.position.set(40, 1.2, z + off); dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1); dummy.updateMatrix(); umbPole.setMatrixAt(ui, dummy.matrix);
    dummy.position.set(40, 2.9, z + off); dummy.updateMatrix(); umbTop.setMatrixAt(ui, dummy.matrix);
    ui++;
  }
  umbPole.instanceMatrix.needsUpdate = true; umbTop.instanceMatrix.needsUpdate = true;
  scene.add(umbPole, umbTop);

  // Ferris wheel silhouette on the beach at the far end of the road.
  // Rim, hub and legs are instanced across the three tile copies.
  const wheelRim = new THREE.InstancedMesh(new THREE.TorusGeometry(FERRIS.radius, .5, 4, 16), mat('#7a4a52'), 3);
  const wheelHub = new THREE.InstancedMesh(new THREE.CylinderGeometry(.8, .8, 1.2, 6), mat('#3c3230'), 3);
  const wheelLeg = new THREE.InstancedMesh(box, mat('#3c3230'), 6);
  for (let k = 0; k < 3; k++) {
    const z = FERRIS.z + copies[k];
    dummy.position.set(FERRIS.x, FERRIS.height, z); dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1); dummy.updateMatrix(); wheelRim.setMatrixAt(k, dummy.matrix);
    dummy.rotation.set(Math.PI / 2, 0, 0); dummy.updateMatrix(); wheelHub.setMatrixAt(k, dummy.matrix);
    for (let s = 0; s < 2; s++) {
      dummy.position.set(FERRIS.x + (s ? 6 : -6), FERRIS.height - 14, z);
      dummy.rotation.set(0, 0, (s ? 1 : -1) * .42); dummy.scale.set(.9, 28, .9);
      dummy.updateMatrix(); wheelLeg.setMatrixAt(k * 2 + s, dummy.matrix);
    }
  }
  wheelRim.instanceMatrix.needsUpdate = true;
  wheelHub.instanceMatrix.needsUpdate = true;
  wheelLeg.instanceMatrix.needsUpdate = true;
  scene.add(wheelRim, wheelHub, wheelLeg);
  const gondolas = new THREE.InstancedMesh(box, mat('#d8b25a'), 24);
  scene.add(gondolas);

  // Pedestrians, instanced; three copies per tile so the street stays populated.
  const skin = mat('#a96545');
  const shirtMats = [mat('#456a79'), mat('#ba5d3c'), mat('#d0ad61')];
  const pants = mat('#39434a');
  const blobMat = new THREE.MeshBasicMaterial({ color: '#30251e', transparent: true, opacity: .3, depthWrite: false });
  const peopleByColor = [0, 1, 2].map(() => new THREE.InstancedMesh(box, shirtMats[0], 2 * 3));
  peopleByColor.forEach((m, i) => { m.material = shirtMats[i]; scene.add(m); });
  const peopleHeads = new THREE.InstancedMesh(box, skin, 6 * 3);
  const peoplePants = new THREE.InstancedMesh(box, pants, 6 * 3);
  const pedBlobs = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 10), blobMat, 6 * 3);
  scene.add(peopleHeads, peoplePants, pedBlobs);
  const pedDummy = new THREE.Object3D();
  let pedSig = '';
  function updatePeds(pedStates, time) {
    // Ped matrices only change when one is knocked down or gets up again,
    // so skip the buffer uploads on frames where nothing changed.
    const sig = pedStates.map((s) => (s.downUntil && time < s.downUntil) ? 1 : 0).join('');
    if (sig === pedSig) return;
    pedSig = sig;
    // peopleByColor[c] holds 6 instances: copy k (0..2) x slot floor(i/3) (0..1).
    // heads/pants/blobs hold 18: copy k x ped i (0..5).
    for (let k = 0; k < 3; k++) {
      const off = copies[k];
      for (let i = 0; i < PEDS.length; i++) {
        const p = PEDS[i], st = pedStates[i] || {};
        const down = st.downUntil && time < st.downUntil;
        const x = p.x, z = p.z + off;
        pedDummy.rotation.set(0, 0, 0);
        pedDummy.position.set(x, down ? .3 : 1.15, z);
        pedDummy.scale.set(.55, .85, .36);
        if (down) { pedDummy.rotation.set(0, 0, Math.PI / 2); pedDummy.position.y = .3; }
        pedDummy.updateMatrix();
        peopleByColor[i % 3].setMatrixAt(k * 2 + Math.floor(i / 3), pedDummy.matrix);
        const idx = k * 6 + i;
        pedDummy.rotation.set(0, 0, 0);
        pedDummy.position.set(x, down ? .3 : 1.83, z); pedDummy.scale.set(.32, .38, .32);
        pedDummy.updateMatrix(); peopleHeads.setMatrixAt(idx, pedDummy.matrix);
        pedDummy.position.set(x, down ? .3 : .48, z); pedDummy.scale.set(.53, .48, .35);
        pedDummy.updateMatrix(); peoplePants.setMatrixAt(idx, pedDummy.matrix);
        pedDummy.position.set(x, .018, z); pedDummy.rotation.set(-Math.PI / 2, 0, 0);
        pedDummy.scale.set(.48, .32, 1); pedDummy.updateMatrix(); pedBlobs.setMatrixAt(idx, pedDummy.matrix);
      }
    }
    peopleByColor.forEach((m) => { m.instanceMatrix.needsUpdate = true; });
    peopleHeads.instanceMatrix.needsUpdate = true;
    peoplePants.instanceMatrix.needsUpdate = true;
    pedBlobs.instanceMatrix.needsUpdate = true;
  }

  // Kai (the player on foot) + his blob shadow, as in v8.
  function blob(parent, x, z, sx = 1, sz = 1) {
    const b = new THREE.Mesh(new THREE.CircleGeometry(1, 10), blobMat);
    b.rotation.x = -Math.PI / 2; b.position.set(x, .018, z); b.scale.set(sx, sz, 1); parent.add(b); return b;
  }
  const kai = new THREE.Group(); scene.add(kai);
  // One blob shadow, repositioned each frame: under Kai on foot, under the
  // car while driving. (Two blobs were two draw calls for one shadow.)
  const actorBlob = blob(scene, 0, 0, .65, .42);
  const tank = mat('#ece5d6'), jeans = mat('#344f72'), belt = mat('#302b27'), shoe = mat('#423830');
  // Kai's static parts are merged per material (6 meshes, not 9); only the
  // arms and legs stay separate because they swing while he walks.
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.46, .38, 2, 6), tank);
  torso.scale.set(1, .92, .64); torso.position.set(0, 2.13, 0); kai.add(torso);
  kai.add(mergedMesh([boxPart(0, 1.07, 0, .84, 1.02, .51)], jeans));
  kai.add(mergedMesh([boxPart(0, 1.58, 0, .9, .13, .55)], belt));
  kai.add(mergedMesh([sphPart(.34, 7, 5, 0, 2.94, 0), boxPart(0, 2.78, -.27, .2, .11, .08)], skin));
  const hair = mat('#27231f');
  kai.add(mergedMesh([boxPart(0, 3.19, 0, .62, .2, .58, -.08)], hair));
  kai.add(mergedMesh([boxPart(-.25, .08, -.1, .4, .18, .58), boxPart(.25, .08, -.1, .4, .18, .58)], shoe));
  const arms = [], legs = [];
  for (const x of [-.62, .62]) { const a = new THREE.Mesh(new THREE.CapsuleGeometry(.14, .53, 2, 6), skin); a.position.set(x, 2.02, 0); kai.add(a); arms.push(a); }
  for (const x of [-.25, .25]) { const l = new THREE.Mesh(new THREE.CapsuleGeometry(.19, .56, 2, 6), jeans); l.scale.set(1, .96, 1); l.position.set(x, .55, 0); kai.add(l); legs.push(l); }

  // Player car (the Mariner), built by the shared body builder.
  const mariner = buildCarBody({ body: '#e9e4d8' });
  const vehicle = mariner.group; scene.add(vehicle);

  // Parked cars at the curb (static, collidable — main.js knows their spots).
  // One copy each: both sit far from the loop seam, so no copy is needed.
  const parked = [
    { x: -7.6, z: -20, heading: 0, color: TRAFFIC_COLORS[1] },
    { x: 7.6, z: 28, heading: Math.PI, color: TRAFFIC_COLORS[3] },
  ];
  for (const pk of parked) {
    const b = buildCarBody({ body: pk.color, detail: 'simple', spinWheels: false });
    b.group.position.set(pk.x, 0, pk.z); b.group.rotation.y = pk.heading; scene.add(b.group);
  }

  // Police cars + traffic cars: built lazily, positioned from state each frame.
  const policeMeshes = [], trafficMeshes = [];
  function ensurePolice(n) {
    while (policeMeshes.length < n) {
      const b = buildCarBody({ body: '#e9e4d8', police: true, spinWheels: false });
      scene.add(b.group); policeMeshes.push(b);
    }
    for (let i = 0; i < policeMeshes.length; i++) policeMeshes[i].group.visible = i < n;
  }
  function ensureTraffic(n) {
    while (trafficMeshes.length < n) {
      const b = buildCarBody({ body: TRAFFIC_COLORS[trafficMeshes.length % TRAFFIC_COLORS.length], detail: 'simple', spinWheels: false });
      scene.add(b.group); trafficMeshes.push(b);
    }
    for (let i = 0; i < trafficMeshes.length; i++) trafficMeshes[i].group.visible = i < n;
  }

  // Helicopter: box body + tail + spinning rotor, spotlight cone at night.
  const heli = new THREE.Group();
  const heliBody = mat('#d8d3c4');
  cube(heli, heliBody, 0, 0, 0, 2.2, 1.1, 3.4);
  cube(heli, heliBody, 0, .2, 2.6, .7, .7, 2.4);
  cube(heli, mat('#2a2d2a'), 0, .55, -1.2, 1.6, .5, .9);
  const rotor = new THREE.Mesh(box, dark); rotor.scale.set(7, .08, .5); rotor.position.y = .85; heli.add(rotor);
  const rotor2 = new THREE.Mesh(box, dark); rotor2.scale.set(.5, .08, 7); rotor2.position.y = .85; heli.add(rotor2);
  const spot = new THREE.Mesh(new THREE.ConeGeometry(6, 26, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: .16, side: THREE.DoubleSide, depthWrite: false }));
  spot.position.y = -13; heli.add(spot);
  heli.visible = false; scene.add(heli);

  // Mission marker: gold ring + bobbing diamond + light beam.
  const marker = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, .18, 8, 24),
    new THREE.MeshBasicMaterial({ color: '#e9a459' }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = .12; marker.add(ring);
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(.7), new THREE.MeshBasicMaterial({ color: '#ffd76a' }));
  diamond.position.y = 2.6; marker.add(diamond);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, 14, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: '#e9a459', transparent: true, opacity: .14, side: THREE.DoubleSide, depthWrite: false }));
  beam.position.y = 7; marker.add(beam);
  marker.visible = false; scene.add(marker);

  // Sun disc and corona, as in v8.
  const coronaCanvas = document.createElement('canvas'); coronaCanvas.width = coronaCanvas.height = 128;
  const coronaCtx = coronaCanvas.getContext('2d');
  const glow = coronaCtx.createRadialGradient(64, 64, 3, 64, 64, 64);
  glow.addColorStop(0, 'rgba(255,255,238,1)'); glow.addColorStop(.18, 'rgba(255,237,183,.86)');
  glow.addColorStop(.55, 'rgba(255,190,105,.25)'); glow.addColorStop(1, 'rgba(255,160,70,0)');
  coronaCtx.fillStyle = glow; coronaCtx.fillRect(0, 0, 128, 128);
  const coronaTex = new THREE.CanvasTexture(coronaCanvas);
  const sunGroup = new THREE.Group(); scene.add(sunGroup);
  const coronaMat = new THREE.SpriteMaterial({ map: coronaTex, transparent: true, opacity: .95, depthTest: false, depthWrite: false });
  const corona = new THREE.Sprite(coronaMat); corona.scale.set(17, 17, 1); sunGroup.add(corona);
  sunGroup.renderOrder = 999;

  const target = new THREE.Vector3(), desired = new THREE.Vector3();
  let started = false, fpsFrames = 0, fpsAt = performance.now(), wheelAngle = 0;
  function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
  addEventListener('resize', resize);

  function render(dt, s) {
    const { driving, night, time, chase, wanted = 0, police = [], traffic = [], peds = [], mission = null } = s;
    const actor = driving ? car : player;
    const yaw = driving ? car.heading : player.heading;
    const p = new THREE.Vector3(actor.x, driving ? 1 : 0, actor.z);
    const dist = chase ? 12 : (driving ? 8.6 : 7.3);
    const height = chase ? 8.5 : (driving ? 4.5 : 4.1);
    camera.fov = chase ? 70 : 64; camera.updateProjectionMatrix();
    desired.set(p.x - Math.sin(yaw) * dist, p.y + height, p.z + Math.cos(yaw) * dist);
    if (!started) { camera.position.copy(desired); started = true; }
    camera.position.lerp(desired, 1 - Math.exp(-dt * 3.4));
    target.set(p.x, p.y + 1.1, p.z); camera.lookAt(target);

    // Kai: on foot, or seated in the car while driving.
    const stride = player.walking || 0;
    for (let i = 0; i < 2; i++) {
      legs[i].rotation.x = Math.sin(time * 9 + i * Math.PI) * stride * .42;
      arms[i].rotation.x = -Math.sin(time * 9 + i * Math.PI) * stride * .28;
    }
    vehicle.position.set(car.x, 0, car.z); vehicle.rotation.y = car.heading;
    for (const w of mariner.wheels) w.rotation.x += car.speed * dt * 1.8;
    if (driving) {
      kai.scale.setScalar(.72);
      kai.position.set(car.x - Math.sin(car.heading) * .46, -.5, car.z - Math.cos(car.heading) * .46);
      kai.rotation.y = car.heading;
    } else {
      kai.scale.setScalar(1); kai.position.set(player.x, 0, player.z);
    }
    kai.rotation.y = driving ? car.heading : player.heading;
    if (driving) { actorBlob.position.set(car.x, .02, car.z); actorBlob.scale.set(1.25, .8, 1); }
    else { actorBlob.position.set(kai.position.x, .019, kai.position.z); actorBlob.scale.set(.65, .42, 1); }

    // Pedestrians (rammed ones lie down until they get up).
    updatePeds(peds, time);

    // Police: pursue positions from main.js; light bars flash alternately.
    // Dynamic actors render at the loop copy nearest the player, so a chase
    // never pops out of view when the road wraps.
    const nearestZ = (z) => z + LOOP * Math.round((actor.z - z) / LOOP);
    ensurePolice(police.length);
    police.forEach((pc, i) => {
      const m = policeMeshes[i];
      m.group.position.set(pc.x, 0, nearestZ(pc.z)); m.group.rotation.y = pc.heading;
      for (const w of m.wheels) w.rotation.x += (pc.speed || 0) * dt * 1.8;
      const phase = Math.floor(time * 6 + i) % 2 === 0;
      if (m.lightL) m.lightL.visible = phase;
      if (m.lightR) m.lightR.visible = !phase;
    });
    // Traffic: moving cars on the loop.
    ensureTraffic(traffic.length);
    traffic.forEach((tc, i) => {
      const m = trafficMeshes[i];
      m.group.position.set(tc.x, 0, nearestZ(tc.z)); m.group.rotation.y = tc.heading;
      for (const w of m.wheels) w.rotation.x += (tc.speed || 0) * dt * 1.8;
    });
    // Helicopter hovers above the player while wanted; spotlight at night.
    heli.visible = wanted >= 1;
    if (heli.visible) {
      heli.position.set(
        actor.x + 8 + Math.sin(time * .4) * 4, 24 + Math.sin(time * .7) * 1.5,
        actor.z + 10 + Math.cos(time * .33) * 4);
      heli.rotation.y = Math.atan2(actor.x - heli.position.x, -(actor.z - heli.position.z));
      rotor.rotation.y = time * 22; rotor2.rotation.y = time * 22;
      spot.visible = night;
    }
    // Mission marker (nearest loop copy, like the traffic).
    marker.visible = !!mission;
    if (mission) {
      marker.position.set(mission.x, 0, mission.z + LOOP * Math.round((actor.z - mission.z) / LOOP));
      diamond.position.y = 2.6 + Math.sin(time * 2.4) * .35;
      diamond.rotation.y = time * 1.5;
    }
    // Ferris wheel turns slowly; gondolas ride the rim.
    wheelAngle += dt * .22;
    for (let k = 0; k < 3; k++) {
      dummy.position.set(FERRIS.x, FERRIS.height, FERRIS.z + copies[k]);
      dummy.rotation.set(0, 0, wheelAngle); dummy.scale.set(1, 1, 1);
      dummy.updateMatrix(); wheelRim.setMatrixAt(k, dummy.matrix);
    }
    wheelRim.instanceMatrix.needsUpdate = true;
    for (let k = 0; k < 3; k++) for (let g = 0; g < 8; g++) {
      const a = wheelAngle + g * Math.PI / 4;
      dummy.position.set(FERRIS.x + Math.sin(a) * FERRIS.radius, FERRIS.height + Math.cos(a) * FERRIS.radius, FERRIS.z + copies[k]);
      dummy.rotation.set(0, 0, 0); dummy.scale.set(1.1, 1.1, 1.1);
      dummy.updateMatrix(); gondolas.setMatrixAt(k * 8 + g, dummy.matrix);
    }
    gondolas.instanceMatrix.needsUpdate = true;

    sunGroup.position.copy(camera.position).add(new THREE.Vector3(-13, 24, -55).applyQuaternion(camera.quaternion));
    sunGroup.quaternion.copy(camera.quaternion);
    const sky = night ? '#3c4d61' : '#68b8ed', fog = night ? '#50505a' : '#dda366';
    scene.background.set(sky); scene.fog.color.set(fog);
    sun.intensity = night ? .42 : 2.25;
    renderer.render(scene, camera);
    fpsFrames++;
    const stamp = performance.now();
    if (stamp - fpsAt >= 1000) {
      const fps = fpsFrames * 1000 / (stamp - fpsAt);
      window.__fps = fps;
      // Dynamic resolution: step down to hold 30 FPS on software rendering,
      // step back up when there is headroom. Staged screenshots stay crisp.
      if (!shotMode) {
        if (fps < 26 && pixelRatio > .2) pixelRatio = Math.max(.2, pixelRatio - .06);
        else if (fps > 45 && pixelRatio < .6) pixelRatio = Math.min(.6, pixelRatio + .06);
        renderer.setPixelRatio(Math.min(devicePixelRatio || 1, pixelRatio));
        renderer.setSize(innerWidth, innerHeight);
      }
      window.__pixelRatio = pixelRatio;
      window.__drawCalls = renderer.info.render.calls;
      fpsFrames = 0; fpsAt = stamp;
    }
    window.__webgl = true;
  }
  return { render, renderer, scene, camera, parked };
}
