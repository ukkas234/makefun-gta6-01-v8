// Solmara v9 — every tuning number in one place. The playfield is the harbor
// service road loop (see world.js): one straight tile of LOOP units that
// wraps, so driving never hits an edge.

export const LOOP = 150;
export const HALF_LOOP = LOOP / 2;

/** Player car: top speed 18 u/s, police are deliberately a touch slower. */
export const CAR = { maxSpeed: 18, minSpeed: -7, accel: 12, brake: 18, turn: .85, radius: 1.3 };
export const POLICE = { maxSpeed: 15, accel: 10, turn: 1.6, spawnBehind: 22, count: 2 };
export const TRAFFIC = { count: 4, minSpeed: 5, maxSpeed: 9, laneX: 3.2 };
export const PLAYER = { walk: 5, run: 8, radius: .6 };

/** Wanted 0-3. Ramming a pedestrian, a traffic car or a police car raises it;
 * it decays one star per 5 s of clean time once no police are within 30 units
 * and 10 s have passed since the last offense. */
export const WANTED = { max: 3, decayAfter: 10, decayEvery: 5, policeNear: 30, roadblockAt: 3 };

/** Mission: pick up at the south quay, deliver at the Low Tide bar. */
export const MISSION = {
  pickup: { x: 0, z: -40 },
  delivery: { x: 0, z: 40 },
  radius: 3.5,
};

/** Where the best result is kept between visits (this browser only). */
export const BEST_KEY = 'solmara.lowtide.best';

export const PALETTE = {
  backdrop: '#11141b', sky: '#68b8ed', fog: '#dda366',
  road: '#62615b', sand: '#bc986b', gold: '#e9a459',
  text: '#f7edcf', muted: '#d2ded2',
};

export const FONT = 'Arial, Helvetica, sans-serif';
