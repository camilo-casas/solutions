// Per-device progress, kept in localStorage. Every access is guarded so the
// app still works in private windows or when storage is blocked.

const PREFIX = 'wfdnav:';

export function load(key, fallback) {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

export function remove(key) {
  try { localStorage.removeItem(PREFIX + key); } catch { /* ignore */ }
}

const blank = () => ({ played: 0, correct: 0, streak: 0, best: 0, points: 0, ms: 0 });

export function stats(game) {
  return { ...blank(), ...load(`stats:${game}`, {}) };
}

/** Record one answer. `credit` is 0..1 (partial credit allowed). */
export function record(game, credit, points, ms) {
  const s = stats(game);
  s.played += 1;
  s.correct += credit >= 1 ? 1 : 0;
  s.streak = credit >= 1 ? s.streak + 1 : 0;
  s.best = Math.max(s.best, s.streak);
  s.points += points;
  s.ms += ms || 0;
  save(`stats:${game}`, s);
  return s;
}

export function resetAll() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) localStorage.removeItem(k);
    }
  } catch { /* ignore */ }
}
