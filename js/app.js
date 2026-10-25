// App wiring — event listeners only. Loads last, after rank / store / demo / ui.

let workouts = Store.load();

function refresh() {
  renderAll(workouts);
  $('#demo-btn').hidden = workouts.length > 0;
}

// Log a workout
$('#log-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target.elements;
  const before = rankOf(replay(workouts).rating).label;

  workouts = Store.add(workouts, {
    date: f.date.value,
    type: f.type.value,
    minutes: Number(f.minutes.value),
    rpe: Number(f.rpe.value),
    notes: f.notes.value.trim(),
  });

  const after = rankOf(replay(workouts).rating).label;
  if (after !== before) toast(`Promoted to ${after}!`);
  f.notes.value = '';
  refresh();
});

// Live label for the intensity slider
$('#rpe').addEventListener('input', (e) => { $('#rpe-val').textContent = e.target.value; });

// Delete from match history (event delegation — rows are re-rendered)
$('#history').addEventListener('click', (e) => {
  const btn = e.target.closest('.del');
  if (!btn) return;
  workouts = Store.remove(workouts, btn.dataset.id);
  refresh();
});

$('#demo-btn').addEventListener('click', () => {
  workouts = buildDemoSeason();
  Store.save(workouts);
  refresh();
});

$('#reset-btn').addEventListener('click', () => {
  if (!confirm('Delete every logged workout and start from Bronze IV?')) return;
  workouts = [];
  Store.save(workouts);
  refresh();
});

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

$('#log-form').elements.date.value = todayISO();
refresh();
