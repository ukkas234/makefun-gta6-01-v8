// Solmara v9 — staged views for screenshots, selected by ?shot=NAME.
// main.js sets up each scene (driving, a chase in progress, blue hour).
// Staged views render at a fixed crisp pixel ratio; live play uses the
// dynamic resolution in render.js instead.
export const SHOTS = ['start', 'drive', 'chase', 'night'];
export const SHOT_INFO = {
  start: 'Kai on foot at the South Quay, the Mariner waiting by the curb.',
  drive: 'Driving the harbor service road, traffic ahead, beach to the east.',
  chase: 'Wanted level 2 — two police cars in pursuit, helicopter overhead.',
  night: 'Blue hour: neon LOW TIDE sign, helicopter spotlight, wanted level 1.',
};
