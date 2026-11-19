// Solmara v9 — world data: the harbor service road is one straight tile of
// length LOOP that repeats, so driving wraps around and never hits an edge.
// All positions below live in the base tile, z in [-HALF_LOOP, HALF_LOOP).
// Renderers draw three copies (z, z-LOOP, z+LOOP); collision uses the base tile.

export const LOOP = 150;
export const HALF_LOOP = LOOP / 2;
export const ROAD_HALF_WIDTH = 9;
export const LANE_X = 3.2;

/** Wrap a z coordinate into the base tile. */
export function wrapZ(z) {
  let w = (z + HALF_LOOP) % LOOP;
  if (w < 0) w += LOOP;
  return w - HALF_LOOP;
}

/** Shortest signed delta from a to b on the loop (for pursuit / distance). */
export function loopDelta(a, b) {
  let d = wrapZ(b - a);
  return d;
}

// Low stucco homes lining the road: [x, z, w, d, h, color].
// The near face (toward the road) gets windows; see render.js.
export const BUILDINGS = [
  { x: -23, z: 8, w: 16, d: 15, h: 9, color: '#c7a37a' },
  { x: 23, z: 2, w: 17, d: 16, h: 10, color: '#b7835d' },
  { x: -23, z: 42, w: 17, d: 15, h: 9, color: '#c7a37a' },
  { x: 23, z: 43, w: 19, d: 17, h: 11, color: '#b7835d' },
  { x: -24, z: -39, w: 16, d: 14, h: 8, color: '#c7a37a' },
  { x: 24, z: -43, w: 18, d: 16, h: 9, color: '#b7835d' },
];

// Church silhouette at the west end of the tile.
export const CHURCH = { x: -31, z: -7, w: 12, d: 10, h: 12 };

// Pedestrians on the sidewalks: [x, z]. The car can mount the sidewalk, so
// ramming one is possible — and raises the wanted level.
export const PEDS = [
  { x: -11.5, z: 32 }, { x: 11.5, z: 19 }, { x: -11.5, z: 6 },
  { x: 11.5, z: -7 }, { x: -11.5, z: -20 }, { x: 11.5, z: -33 },
];

// Beach strip (east side, past the houses) and the Ferris wheel silhouette.
export const BEACH = { x0: 34, x1: 56, waterX0: 56 };
export const FERRIS = { x: 30, z: -68, radius: 13, height: 30 };

// Mission markers on the road (pickup at the south quay, delivery at the bar).
export const PICKUP = { x: 0, z: -40 };
export const DELIVERY = { x: 0, z: 40 };

// Billboard / sign text. Original names only — no real-world brands.
export const SIGNS = [
  { text: 'SOLMARA', sub: 'SOUTH QUAY', x: -23, z: 8, y: 12.5, w: 15, h: 3.2, bg: '#24383c', fg: '#e9a459', neon: false, face: 1 },
  { text: 'LOW TIDE', sub: 'BAR · QUAY 04', x: 23, z: 43, y: 6.2, w: 11, h: 2.6, bg: '#1c2a2e', fg: '#ff7a6b', neon: true, face: -1 },
  { text: 'QUAY 04', sub: '', x: 9.8, z: -14, y: 2.6, w: 4.4, h: 1.4, bg: '#2e4a44', fg: '#f4e6c2', neon: false, face: -1 },
  { text: 'BEACH →', sub: '', x: 12.5, z: 24, y: 2.4, w: 4.6, h: 1.3, bg: '#7a5a34', fg: '#f4e6c2', neon: false, face: -1 },
];

/** AABB colliders in the base tile: {x0,z0,x1,z1}. Houses, church, brick walls. */
export const COLLIDERS = [
  ...BUILDINGS.map((b) => ({ x0: b.x - b.w / 2, z0: b.z - b.d / 2, x1: b.x + b.w / 2, z1: b.z + b.d / 2 })),
  { x0: CHURCH.x - CHURCH.w / 2, z0: CHURCH.z - CHURCH.d / 2, x1: CHURCH.x + CHURCH.w / 2, z1: CHURCH.z + CHURCH.d / 2 },
  // Brick walls keep the player on the street; the beach is reached on foot
  // through the gap at the south end (z > 62) — walls stop short of the seam.
  { x0: -15.5, z0: -HALF_LOOP, x1: -13.5, z1: 62 },
  { x0: 13.5, z0: -HALF_LOOP, x1: 15.5, z1: 62 },
];

/**
 * Push a circle (x, z, radius r) out of every AABB it overlaps.
 * Returns the corrected position and whether a hit happened.
 */
export function collideCircle(x, z, r) {
  let hit = false;
  for (const c of COLLIDERS) {
    const cx = Math.max(c.x0, Math.min(x, c.x1));
    const cz = Math.max(c.z0, Math.min(z, c.z1));
    const dx = x - cx, dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 > 1e-6) {
      const d = Math.sqrt(d2);
      x = cx + (dx / d) * r;
      z = cz + (dz / d) * r;
    } else {
      // Center inside the box: push out along the smallest penetration axis.
      const pl = x - c.x0, pr = c.x1 - x, pt = z - c.z0, pb = c.z1 - z;
      const m = Math.min(pl, pr, pt, pb);
      if (m === pl) x = c.x0 - r; else if (m === pr) x = c.x1 + r;
      else if (m === pt) z = c.z0 - r; else z = c.z1 + r;
    }
  }
  return { x, z, hit };
}
