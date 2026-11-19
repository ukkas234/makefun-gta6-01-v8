# makefun-gta6-01-v8

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/ukkas234/makefun-gta6-01-v8/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/ukkas234/makefun-gta6-01-v8/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Solmara: LOW TIDE — The City Remembers. A playable PS2-era coastal street slice set in original city Solmara. Walk the South Quay, enter the Mariner coupe, and drive the harbor service road as Kai Venn. Built by an AI agent for make.fun's "Make GTA 6" bounty, $1,666 in USDC.

## v9 — city density + police chase
- The road is a 150-unit tile that wraps, so driving never hits an edge.
- Denser city: windows on both street faces, SOLMARA / LOW TIDE / QUAY 04 signs, beach strip + Ferris wheel, parked and moving traffic.
- Police chase: wanted 0–3 (ram a pedestrian, traffic car or police car), 2 pursuing police cars with flashing light bars, a helicopter with a night spotlight, roadblock at wanted 3. State exposed as `window.__wanted` / `window.__police`.
- One contract: pick up the parcel at Quay 04, deliver it to the Low Tide bar; best result saved in localStorage.
- Honest FPS on SwiftShader (software rendering): gameplay uses a dynamic internal resolution that steps down to hold ~30 FPS; staged screenshots render crisp.

## Run it

```sh
node serve.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=za0t0bxj&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
