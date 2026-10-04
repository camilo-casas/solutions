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

// ---- Players -------------------------------------------------------------
// Progress is kept per player. Anonymous play is tracked under "anon" and
// never posted to the scoreboard.

export const GAMES = ['flashcards', 'turn', 'cardinal', 'responder', 'transporter'];

/** { name } for a named player, { anon: true } for anonymous, or null before the splash screen. */
export function player() {
  return load('player', null);
}

export function setPlayer(p) {
  save('player', p);
  if (p?.name) {
    const names = load('players', []).filter((n) => n.toLowerCase() !== p.name.toLowerCase());
    save('players', [p.name, ...names].slice(0, 12));
  }
}

export const knownPlayers = () => load('players', []);

export const playerKey = (p = player()) => (p?.name ? 'p:' + p.name.toLowerCase() : 'anon');

/** Load/save a value that belongs to the current player. */
export const loadMine = (key, fallback) => load(`${playerKey()}:${key}`, fallback);
export const saveMine = (key, value) => save(`${playerKey()}:${key}`, value);

const blank = () => ({ played: 0, correct: 0, streak: 0, best: 0, points: 0, ms: 0 });

export function stats(game, p = player()) {
  return { ...blank(), ...load(`${playerKey(p)}:stats:${game}`, {}) };
}

/** Totals plus per-game stats for a player. */
export function summary(p = player()) {
  const games = Object.fromEntries(GAMES.map((g) => [g, stats(g, p)]));
  const sum = (k) => GAMES.reduce((n, g) => n + games[g][k], 0);
  return { points: sum('points'), played: sum('played'), correct: sum('correct'), best: Math.max(...GAMES.map((g) => games[g].best)), games };
}

const listeners = new Set();
/** Called after every recorded answer with (player, summary). */
export function onRecord(fn) { listeners.add(fn); }

/** Record one answer. `credit` is 0..1 (partial credit allowed). */
export function record(game, credit, points, ms) {
  const s = stats(game);
  s.played += 1;
  s.correct += credit >= 1 ? 1 : 0;
  s.streak = credit >= 1 ? s.streak + 1 : 0;
  s.best = Math.max(s.best, s.streak);
  s.points += points;
  s.ms += ms || 0;
  save(`${playerKey()}:stats:${game}`, s);
  const p = player();
  for (const fn of listeners) {
    try { fn(p, summary(p)); } catch { /* ignore */ }
  }
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

/** Clear the current player's scores and flash card progress. */
export function resetMine() {
  const pre = `${PREFIX}${playerKey()}:`;
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(pre)) localStorage.removeItem(k);
    }
  } catch { /* ignore */ }
}
