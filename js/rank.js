// Ranking engine — pure functions, no DOM. The rating is never stored: it is
// rebuilt by replaying the workout log day by day up to today, so decay is
// always applied correctly no matter how long the app was closed.

const TIERS = [
  { name: 'Bronze',   color: '#cd7f32' },
  { name: 'Silver',   color: '#b9c3cf' },
  { name: 'Gold',     color: '#f5c542' },
  { name: 'Platinum', color: '#3fd1c4' },
  { name: 'Emerald',  color: '#2ecc71' },
  { name: 'Diamond',  color: '#8ab4ff' },
];
const DIVISIONS = ['IV', 'III', 'II', 'I'];
const LP_PER_DIV = 100;
const LP_PER_TIER = LP_PER_DIV * DIVISIONS.length;
const MAX_RATING = TIERS.length * LP_PER_TIER - 1;   // Diamond I, 99 LP

const TYPES = {
  strength: { label: 'Strength', mult: 1.0 },
  hiit:     { label: 'HIIT',     mult: 1.1 },
  cardio:   { label: 'Cardio',   mult: 1.0 },
  sport:    { label: 'Sport',    mult: 0.9 },
  mobility: { label: 'Mobility', mult: 0.6 },
};

const GRACE_DAYS = 2;      // rest days allowed before decay kicks in
const HOT_STREAK = 3;      // workouts in the last 7 days for the bonus
const HOT_BONUS = 5;

// ── Dates: 'YYYY-MM-DD' <-> integer day numbers (UTC, so no DST drift) ──
function dayNum(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}
function isoFromDay(n) {
  return new Date(n * 86400000).toISOString().slice(0, 10);
}
function todayISO() {
  const d = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function clampRating(r) {
  return Math.max(0, Math.min(MAX_RATING, r));
}

function rankOf(rating) {
  const r = clampRating(rating);
  const step = Math.floor(r / LP_PER_DIV);
  const tier = Math.floor(step / DIVISIONS.length);
  const div = step % DIVISIONS.length;
  return {
    tier,
    div,
    lp: r % LP_PER_DIV,
    name: TIERS[tier].name,
    divName: DIVISIONS[div],
    color: TIERS[tier].color,
    label: `${TIERS[tier].name} ${DIVISIONS[div]}`,
  };
}

// LP for a single workout. `nthToday` is 0 for the first session of the day;
// a second session is worth half and anything after that is worth nothing,
// so the ladder can't be farmed by logging ten short sessions.
function workoutLP(w, rating, nthToday, recentCount) {
  if (nthToday >= 2) return { delta: 0, hot: false };
  const minutes = Math.min(Math.max(w.minutes, 0), 120);
  const intensity = 0.5 + w.rpe / 10;                 // RPE 5 = 1.0x, RPE 10 = 1.5x
  const typeMult = (TYPES[w.type] || TYPES.strength).mult;
  const tierScale = 1 - rankOf(rating).tier * 0.08;   // Diamond gains 60% of Bronze
  let lp = (minutes / 4) * intensity * typeMult * tierScale;
  const hot = recentCount >= HOT_STREAK;
  if (hot) lp += HOT_BONUS;
  if (nthToday === 1) lp /= 2;
  return { delta: Math.max(1, Math.round(lp)), hot };
}

// LP lost on a day with no workout, given how many days it has been idle.
function decayLP(idleDays, rating) {
  if (idleDays <= GRACE_DAYS) return 0;
  const base = Math.min(5 + 3 * (idleDays - GRACE_DAYS - 1), 30);
  return Math.round(base * (1 + rankOf(rating).tier * 0.1));
}

// Replay the whole log. Returns the current rating, a per-day timeline for
// the chart, and an event list (workouts + decay) for match history.
function replay(workouts, today = todayISO()) {
  const sorted = [...workouts].sort((a, b) =>
    a.date === b.date ? a.created - b.created : a.date < b.date ? -1 : 1);
  const result = { rating: 0, peak: 0, timeline: [], events: [], lastDay: null };
  if (!sorted.length) return result;

  const byDay = new Map();
  for (const w of sorted) {
    const n = dayNum(w.date);
    if (!byDay.has(n)) byDay.set(n, []);
    byDay.get(n).push(w);
  }

  const start = dayNum(sorted[0].date);
  const end = Math.max(dayNum(today), dayNum(sorted[sorted.length - 1].date));
  const workoutDays = [];
  let rating = 0, peak = 0, last = null;

  for (let d = start; d <= end; d++) {
    const todays = byDay.get(d);
    if (todays) {
      const recent = workoutDays.filter((x) => x > d - 7).length;
      todays.forEach((w, i) => {
        const before = rating;
        const { delta, hot } = workoutLP(w, rating, i, recent + i);
        rating = clampRating(rating + delta);
        result.events.push({ kind: 'workout', date: w.date, workout: w,
          delta: rating - before, hot, before, after: rating });
      });
      workoutDays.push(d);
      last = d;
    } else {
      const loss = decayLP(d - last, rating);
      if (loss) {
        const before = rating;
        rating = clampRating(rating - loss);
        if (rating !== before) {
          result.events.push({ kind: 'decay', date: isoFromDay(d), idle: d - last,
            delta: rating - before, before, after: rating });
        }
      }
    }
    peak = Math.max(peak, rating);
    result.timeline.push({ date: isoFromDay(d), rating });
  }

  result.rating = rating;
  result.peak = peak;
  result.lastDay = last;
  return result;
}

// What happens if you skip tomorrow: days until decay starts, and the hit.
function forecast(state, today = todayISO()) {
  if (state.lastDay == null) return null;
  const idleTomorrow = dayNum(today) + 1 - state.lastDay;
  return {
    idleToday: idleTomorrow - 1,
    graceLeft: Math.max(0, GRACE_DAYS - (idleTomorrow - 1)),
    tomorrowLoss: decayLP(idleTomorrow, state.rating),
  };
}

if (typeof module !== 'undefined') {
  module.exports = { TIERS, DIVISIONS, TYPES, LP_PER_DIV, LP_PER_TIER, MAX_RATING,
    GRACE_DAYS, HOT_STREAK, HOT_BONUS, dayNum, isoFromDay, todayISO, rankOf,
    workoutLP, decayLP, replay, forecast };
}
