// Rendering — turns a replay() result into DOM. Each section of the page has
// one render function; app.js calls them all after any change.

const $ = (sel) => document.querySelector(sel);

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatDate(iso) {
  return new Date(dayNum(iso) * 86400000).toLocaleDateString(undefined,
    { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// ── Emblem: a hexagon badge in the tier colour with the division numeral ──
function emblemSVG(rank, size = 120) {
  const id = `g${rank.tier}-${size}`;
  return `
    <svg class="emblem" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${rank.color}" stop-opacity="1"/>
          <stop offset="1" stop-color="${rank.color}" stop-opacity="0.35"/>
        </linearGradient>
      </defs>
      <polygon points="50,4 92,27 92,73 50,96 8,73 8,27"
               fill="url(#${id})" stroke="${rank.color}" stroke-width="3"/>
      <polygon points="50,18 79,34 79,66 50,82 21,66 21,34"
               fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>
      <text x="50" y="59" text-anchor="middle" class="emblem-div">${rank.divName}</text>
    </svg>`;
}

// ── Rank card: current tier, LP bar, decay warning ──
function renderRank(state, fc) {
  const rank = rankOf(state.rating);
  document.documentElement.style.setProperty('--tier', rank.color);
  $('#emblem').innerHTML = emblemSVG(rank, 140);
  $('#rank-name').textContent = rank.label;
  $('#rank-lp').textContent = `${rank.lp} LP`;
  $('#lp-fill').style.width = `${rank.lp}%`;

  const atTop = state.rating >= MAX_RATING;
  $('#rank-next').textContent = atTop
    ? 'Top of the ladder.'
    : `${LP_PER_DIV - rank.lp} LP to ${rankOf(state.rating + LP_PER_DIV - rank.lp).label}`;

  const status = $('#rank-status');
  status.className = 'status';
  if (!fc) {
    status.textContent = 'Log your first workout to get placed.';
  } else if (fc.idleToday === 0) {
    status.textContent = 'Trained today — rank is safe.';
    status.classList.add('ok');
  } else if (fc.tomorrowLoss === 0) {
    status.textContent = `Rest day. Decay starts in ${fc.graceLeft + 1} day${fc.graceLeft ? 's' : ''}.`;
  } else {
    status.textContent = `Decaying: −${fc.tomorrowLoss} LP tomorrow unless you train.`;
    status.classList.add('warn');
  }
}

// ── Stat tiles ──
function renderStats(workouts, state) {
  const today = dayNum(todayISO());
  const days = new Set(workouts.map((w) => dayNum(w.date)));
  const thisWeek = [...days].filter((d) => d > today - 7).length;

  let streak = 0;
  for (let d = days.has(today) ? today : today - 1; days.has(d); d--) streak++;

  $('#stat-week').textContent = thisWeek;
  $('#stat-streak').textContent = `${streak}d`;
  $('#stat-total').textContent = workouts.length;
  $('#stat-peak').textContent = workouts.length ? rankOf(state.peak).label : '—';
}

// ── Rating chart: SVG line over coloured tier bands ──
function renderChart(state) {
  const el = $('#chart');
  const pts = state.timeline;
  if (pts.length < 2) {
    el.innerHTML = '<p class="empty">Your rating graph appears after a couple of days.</p>';
    return;
  }

  const W = 640, H = 220, pad = 4;
  const ratings = pts.map((p) => p.rating);
  const lo = Math.floor(Math.min(...ratings) / LP_PER_TIER) * LP_PER_TIER;
  const hi = Math.min(Math.ceil((Math.max(...ratings) + 1) / LP_PER_TIER), TIERS.length) * LP_PER_TIER;
  const x = (i) => pad + (i / (pts.length - 1)) * (W - pad * 2);
  const y = (r) => H - pad - ((r - lo) / (hi - lo)) * (H - pad * 2);

  let bands = '';
  for (let t = lo / LP_PER_TIER; t < hi / LP_PER_TIER; t++) {
    const top = y((t + 1) * LP_PER_TIER), bottom = y(t * LP_PER_TIER);
    bands += `<rect x="0" y="${top}" width="${W}" height="${bottom - top}"
                fill="${TIERS[t].color}" opacity="0.08"/>
              <line x1="0" x2="${W}" y1="${bottom}" y2="${bottom}" stroke="${TIERS[t].color}" opacity="0.3"/>
              <text x="${W - 6}" y="${top + 14}" text-anchor="end" class="band-label"
                fill="${TIERS[t].color}">${TIERS[t].name}</text>`;
  }

  const line = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.rating).toFixed(1)}`).join(' ');
  el.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
         aria-label="Rating over time">
      ${bands}
      <polyline points="${line}" fill="none" stroke="var(--tier)" stroke-width="2.5"
                stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    </svg>
    <div class="chart-axis"><span>${formatDate(pts[0].date)}</span><span>today</span></div>`;
}

// ── Match history: newest first, workouts and decay hits ──
function renderHistory(state) {
  const list = $('#history');
  const events = [...state.events].reverse().slice(0, 40);
  if (!events.length) {
    list.innerHTML = '<li class="empty">No matches yet.</li>';
    return;
  }

  list.innerHTML = events.map((e) => {
    const promo = rankOf(e.after).label !== rankOf(e.before).label
      ? `<span class="badge ${e.delta > 0 ? 'up' : 'down'}">${e.delta > 0 ? '▲' : '▼'} ${rankOf(e.after).label}</span>`
      : '';
    const sign = e.delta > 0 ? '+' : '';
    const cls = e.delta > 0 ? 'gain' : e.delta < 0 ? 'loss' : '';

    if (e.kind === 'decay') {
      return `<li class="match decay">
        <div class="match-main"><strong>Inactivity</strong>
          <span class="muted">${e.idle} days since last workout</span>${promo}</div>
        <span class="match-date">${formatDate(e.date)}</span>
        <span class="lp ${cls}">${sign}${e.delta}</span>
      </li>`;
    }

    const w = e.workout;
    return `<li class="match">
      <div class="match-main"><strong>${TYPES[w.type]?.label || w.type}</strong>
        <span class="muted">${w.minutes} min · RPE ${w.rpe}${e.hot ? ' · 🔥 hot streak' : ''}</span>
        ${w.notes ? `<span class="notes">${escapeHTML(w.notes)}</span>` : ''}${promo}</div>
      <span class="match-date">${formatDate(e.date)}</span>
      <span class="lp ${cls}">${sign}${e.delta}</span>
      <button class="del" data-id="${w.id}" title="Delete workout" aria-label="Delete workout">×</button>
    </li>`;
  }).join('');
}

// ── Ladder: every tier, current one highlighted ──
function renderLadder(state) {
  const current = rankOf(state.rating).tier;
  $('#ladder').innerHTML = [...TIERS].map((t, i) => ({ ...t, i })).reverse().map((t) => `
    <li class="${t.i === current ? 'current' : ''} ${t.i < current ? 'cleared' : ''}">
      ${emblemSVG({ tier: t.i, color: t.color, divName: '' }, 34)}
      <span style="color:${t.color}">${t.name}</span>
      <span class="muted">${t.i * LP_PER_TIER}+</span>
    </li>`).join('');
}

function renderAll(workouts) {
  const state = replay(workouts);
  const fc = forecast(state);
  renderRank(state, fc);
  renderStats(workouts, state);
  renderChart(state);
  renderHistory(state);
  renderLadder(state);
}
