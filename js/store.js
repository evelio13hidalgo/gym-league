// Persistence — the workout log is the only thing saved. Everything else
// (rank, LP, history) is derived from it by rank.js on every render.

const STORE_KEY = 'gymleague.v1';

const Store = {
  load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORE_KEY));
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  save(workouts) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(workouts));
    } catch {
      // Private mode / storage full: the session still works, it just won't persist.
    }
  },

  add(workouts, w) {
    const next = [...workouts, { ...w, id: crypto.randomUUID(), created: Date.now() }];
    this.save(next);
    return next;
  },

  remove(workouts, id) {
    const next = workouts.filter((w) => w.id !== id);
    this.save(next);
    return next;
  },
};
