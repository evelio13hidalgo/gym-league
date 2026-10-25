// Demo season — a believable ~10 weeks of training so portfolio visitors can
// see the climb, a mid-season break that triggers decay, and the comeback.
// Seeded random, so the demo looks the same every time.

function buildDemoSeason(today = todayISO()) {
  let seed = 42;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];

  const end = dayNum(today);
  const start = end - 70;
  const breakFrom = start + 38, breakTo = start + 47;   // 10 days off mid-season
  const workouts = [];

  for (let d = start; d <= end; d++) {
    if (d >= breakFrom && d <= breakTo) continue;
    if (rand() > 0.62) continue;                          // ~4 sessions a week
    workouts.push({
      id: `demo-${d}`,
      created: d,
      date: isoFromDay(d),
      type: pick(['strength', 'strength', 'strength', 'hiit', 'cardio', 'sport', 'mobility']),
      minutes: 30 + Math.round(rand() * 12) * 5,
      rpe: 5 + Math.floor(rand() * 5),
      notes: '',
    });
  }
  return workouts;
}
