# Gym League

A ranked ladder for your workouts. Every session earns LP and climbs you from
**Bronze IV** to **Diamond I**. Skip the gym too long and you start losing LP,
and you can be demoted.

Vanilla HTML/CSS/JS with no build step and no backend. Your log lives in `localStorage`.

## How ranking works

| Rule | Detail |
|---|---|
| Ladder | Bronze → Silver → Gold → Platinum → Emerald → Diamond, 4 divisions each (IV → I), 100 LP per division |
| LP gain | `minutes ÷ 4 × (0.5 + RPE/10) × type multiplier` (capped at 120 min) |
| Type multipliers | HIIT 1.1 · Strength 1.0 · Cardio 1.0 · Sport 0.9 · Mobility 0.6 |
| Hot streak | +5 LP when you've trained 3+ days in the last 7 |
| Tier scaling | Gains shrink 8% per tier: Diamond earns 60% of what Bronze does |
| Anti-farming | Only 2 sessions per day count, and the 2nd is worth half |
| Decay | After 2 rest days: −5, −8, −11 … LP per idle day (max 30), +10% per tier |

For example, training 4×/week (60 min, RPE 7) for 3 months reaches about **Gold II**.
A month off from there drops you back to **Bronze III**.

## Code layout

```
index.html        page structure + script load order
css/style.css     all styling; --tier is set at runtime to the current rank colour
js/
  rank.js         ranking engine: pure functions, no DOM (tiers, LP formula, decay, replay)
  store.js        localStorage load/save of the workout log
  demo.js         seeded fake season for the "Load demo season" button
  ui.js           one render function per page section
  app.js          event listeners; loads last
```

**Key design choice:** the rating is never saved. `store.js` keeps only the raw
workout list, and `rank.js → replay()` rebuilds the rating by walking every
day from your first workout to today, applying gains and decay. So decay is
always correct even if the app hasn't been opened in weeks, and deleting or
backdating a workout re-scores everything automatically.

`rank.js` also exports itself for Node, so you can test the engine directly:

```js
const R = require('./js/rank.js');
R.replay([{ date: '2026-01-01', type: 'strength', minutes: 60, rpe: 7, created: 0 }], '2026-01-05').rating; // 5
```

## Run locally

Open `index.html` in a browser, or `python3 -m http.server` in this folder.
