// Solmara v9 — vehicles. The player's Mariner is a 1950s-inspired coupe;
// the same body builder makes police cars (light bar, black doors), traffic
// and parked cars (muted colors, cheap detail) so the street feels alive.
// Parts sharing a material are merged into ONE mesh each: a full car is 9
// draw calls instead of 22, which is what keeps SwiftShader near 30 FPS.
import * as THREE from '../vendor/three.module.js';

export function makeCar() { return { x: 1, z: 2, heading: 0, speed: 0, radius: 1.3 }; }

const mat = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const unitBox = new THREE.BoxGeometry(1, 1, 1);

/** A part: a geometry plus the matrix that places it in the car. */
function part(geom, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Matrix4();
  m.compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz));
  return { geom, matrix: m };
}
export const boxPart = (x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => part(unitBox, x, y, z, rx, ry, rz, sx, sy, sz);
export const cylPart = (rt, rb, h, seg, x, y, z, rx = 0, ry = 0, rz = 0) =>
  part(new THREE.CylinderGeometry(rt, rb, h, seg), x, y, z, rx, ry, rz);
export const sphPart = (r, w, h, x, y, z) => part(new THREE.SphereGeometry(r, w, h), x, y, z);

/** Concatenate indexed geometries (position/normal/uv/index) into one. */
function mergeParts(list) {
  let vCount = 0, iCount = 0;
  for (const { geom } of list) { vCount += geom.attributes.position.count; iCount += geom.index.count; }
  const pos = new Float32Array(vCount * 3), nor = new Float32Array(vCount * 3), uv = new Float32Array(vCount * 2);
  const idx = new Uint32Array(iCount);
  const nm = new THREE.Matrix3(), v = new THREE.Vector3();
  let vo = 0, io = 0;
  for (const { geom, matrix } of list) {
    const p = geom.attributes.position, n = geom.attributes.normal, u = geom.attributes.uv;
    nm.getNormalMatrix(matrix);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(matrix);
      pos[(vo + i) * 3] = v.x; pos[(vo + i) * 3 + 1] = v.y; pos[(vo + i) * 3 + 2] = v.z;
      v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
      nor[(vo + i) * 3] = v.x; nor[(vo + i) * 3 + 1] = v.y; nor[(vo + i) * 3 + 2] = v.z;
      uv[(vo + i) * 2] = u.getX(i); uv[(vo + i) * 2 + 1] = u.getY(i);
    }
    const ix = geom.index;
    for (let i = 0; i < ix.count; i++) idx[io + i] = ix.getX(i) + vo;
    vo += p.count; io += ix.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}
function mergedMesh(list, material) {
  if (!list.length) return null;
  const m = new THREE.Mesh(mergeParts(list), material);
  return m;
}
export { mergedMesh };

/**
 * Build a low-poly coupe. detail 'full' (player + police) keeps chrome, lamps,
 * bumpers and glass; 'simple' (traffic / parked) is body + cabin + wheels only.
 * opts: { body, glass, police, detail, spinWheels }.
 * Returns { group, wheels, lightL, lightR } (lights null unless police).
 */
export function buildCarBody(opts = {}) {
  const bodyColor = opts.body || '#e9e4d8';
  const glassColor = opts.glass || '#5c8587';
  const full = opts.detail !== 'simple';
  const group = new THREE.Group();
  const add = (mesh) => { if (mesh) group.add(mesh); };

  // Shell: lower slab, cabin, trunk, trim — one mesh.
  const shell = [
    boxPart(0, .575, 0, 1.7, .55, 3.6),
    boxPart(0, 1.125, .15, 1.5, .55, 1.7),
  ];
  if (full) {
    shell.push(boxPart(0, 1.32, 1.62, 1.5, .08, .28));
    for (const x of [-.6, .6]) shell.push(boxPart(x, 1.12, 1.62, .12, .18, .1));
  }
  add(mergedMesh(shell, mat(bodyColor)));

  // Glass: windshield, rear glass, side glass — one mesh.
  const glass = [boxPart(0, 1.13, -.72, 1.3, .45, .06, -.12)];
  if (full) {
    glass.push(boxPart(0, 1.13, 1.02, 1.3, .45, .06, .12));
    for (const x of [-.76, .76]) glass.push(boxPart(x, 1.13, .15, .05, .42, 1.5));
  }
  add(mergedMesh(glass, mat(glassColor)));

  // Chrome: bumpers + hubs — one mesh (full detail only).
  if (full) {
    const chrome = [
      boxPart(0, .42, 1.85, 1.8, .13, .17),
      boxPart(0, .42, -1.85, 1.8, .13, .17),
    ];
    for (const x of [-.92, .92]) for (const z of [-1.1, 1.1])
      chrome.push(cylPart(.19, .19, .24, 8, x, .43, z, 0, 0, Math.PI / 2));
    add(mergedMesh(chrome, mat('#bbc0b8')));
  }

  // Lamps + tail lights — one mesh each (basic material, they glow).
  // Simple cars skip lamps: one less draw call per car on a busy street.
  if (full) {
    const lamps = [];
    for (const x of [-.72, .72]) lamps.push(sphPart(.22, 8, 6, x, .62, -1.82));
    add(mergedMesh(lamps, new THREE.MeshBasicMaterial({ color: '#ffe2a0' })));
    const tails = [];
    for (const x of [-.72, .72]) tails.push(sphPart(.16, 7, 5, x, .62, 1.82));
    add(mergedMesh(tails, mat('#a33e2a')));
  }

  // Wheels: spinning (player car) or merged static (everyone else).
  const wheels = [];
  if (opts.spinWheels !== false) {
    for (const x of [-.92, .92]) for (const z of [-1.1, 1.1]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(.4, .4, .23, 8), mat('#252523'));
      w.rotation.z = Math.PI / 2; w.position.set(x, .43, z); group.add(w);
      wheels.push(w);
    }
  } else {
    const dark = [];
    for (const x of [-.92, .92]) for (const z of [-1.1, 1.1])
      dark.push(cylPart(.4, .4, .23, 8, x, .43, z, 0, 0, Math.PI / 2));
    add(mergedMesh(dark, mat('#252523')));
  }

  // Police: black doors + light bar base (one dark mesh) + flashing lights.
  let lightL = null, lightR = null;
  if (opts.police) {
    const trim = [];
    for (const x of [-.86, .86]) trim.push(boxPart(x, .72, .15, .04, .5, 1.5));
    trim.push(boxPart(0, 1.48, .15, 1.1, .12, .5));
    add(mergedMesh(trim, mat('#1d1d1f')));
    lightL = new THREE.Mesh(new THREE.BoxGeometry(.42, .22, .3), new THREE.MeshBasicMaterial({ color: '#ff2e2e' }));
    lightL.position.set(-.28, 1.62, .15); group.add(lightL);
    lightR = new THREE.Mesh(new THREE.BoxGeometry(.42, .22, .3), new THREE.MeshBasicMaterial({ color: '#2e6bff' }));
    lightR.position.set(.28, 1.62, .15); group.add(lightR);
  }
  return { group, wheels, lightL, lightR };
}

/** Muted traffic / parked colors — no bright toys on the street. */
export const TRAFFIC_COLORS = ['#5d6e7a', '#6e6250', '#6b4a3f', '#4d5a4a', '#715f6e'];
