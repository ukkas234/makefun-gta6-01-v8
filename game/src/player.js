// Solmara v9 — Kai Venn on foot. The player is a circle of radius .6 for
// collision (see world.js collideCircle); heading follows the movement keys.
export function makePlayer() {
  return { x: -3, z: 7, heading: Math.PI, walking: 0, radius: .6 };
}
