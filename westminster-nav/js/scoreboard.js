// Scoreboard. When the page runs as a Claude artifact with the shared
// database available, every named player's totals are shared with everyone
// who opens the page. Otherwise (e.g. GitHub Pages) it falls back to the
// named players on this device.
//
// Shared layout: one document per signed-in account, scores/<account id>,
// holding { players: { <name key>: entry } } so several people can play
// under different names on one shared station tablet.

import * as store from './store.js';

const entryFor = (p, sum) => ({
  name: p.name,
  points: sum.points,
  played: sum.played,
  correct: sum.correct,
  best: sum.best,
  games: Object.fromEntries(Object.entries(sum.games).map(([g, s]) => [g, { points: s.points, played: s.played, correct: s.correct, best: s.best }])),
  updated: new Date().toISOString(),
});

let shared = null; // { db, uid, rows, listeners }
let mode = 'local';
const subscribers = new Set();
let lastRows = [];

function localRows() {
  return store.knownPlayers().map((name) => ({ ...entryFor({ name }, store.summary({ name })), mine: true, key: 'local:' + name.toLowerCase() }));
}

function emit() {
  lastRows = mode === 'shared' ? shared.rows : localRows();
  for (const fn of subscribers) fn(lastRows, mode);
}

/** Subscribe to scoreboard rows; returns an unsubscribe function. */
export function watch(fn) {
  subscribers.add(fn);
  fn(mode === 'shared' ? shared.rows : localRows(), mode);
  return () => subscribers.delete(fn);
}

export const currentMode = () => mode;

// Queue so only one write to our document is in flight at a time.
let pending = null;
let writing = false;
async function flush() {
  if (writing || !pending || !shared) return;
  writing = true;
  const { key, entry } = pending;
  pending = null;
  try {
    const ref = shared.db.doc(`scores/${shared.uid}`);
    const snap = await ref.get();
    const players = { ...(snap.exists ? snap.data().players : {}) };
    players[key] = entry;
    await ref.set({ players });
  } catch (err) {
    if (err?.code === 'invalid_argument') {
      shared.readOnly = true;
      emit();
    }
  } finally {
    writing = false;
    if (pending) setTimeout(flush, 500);
  }
}

let timer = 0;
store.onRecord((p, sum) => {
  if (!p?.name) return;
  if (mode !== 'shared') { emit(); return; }
  pending = { key: p.name.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').slice(0, 60) || 'player', entry: entryFor(p, sum) };
  clearTimeout(timer);
  timer = setTimeout(flush, 1500);
});

/** Publish the current player's totals right away (after choosing a name). */
export function announce() {
  const p = store.player();
  if (!p?.name || mode !== 'shared') { emit(); return; }
  pending = { key: p.name.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').slice(0, 60) || 'player', entry: entryFor(p, store.summary(p)) };
  flush();
}

export const isReadOnly = () => !!shared?.readOnly;

/** Try to connect to the shared database. Safe to call when not in an artifact. */
export async function connect() {
  if (!window.claude?.use) return;
  try {
    const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
    const uid = db && user ? await user.id() : null;
    if (!db || !uid) return;
    shared = { db, uid, rows: [] };
    mode = 'shared';
    db.collection('scores').onSnapshot((snap) => {
      const rows = [];
      for (const d of snap.docs) {
        const players = d.data()?.players || {};
        for (const [k, e] of Object.entries(players)) {
          if (!e || typeof e.name !== 'string') continue;
          rows.push({ ...e, key: `${d.id}:${k}`, mine: d.id === uid });
        }
      }
      shared.rows = rows;
      emit();
    }, () => { mode = 'local'; emit(); });
    emit();
    announce();
  } catch {
    mode = 'local';
  }
}
