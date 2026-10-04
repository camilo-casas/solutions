// Scoreboard. Every named player's totals are shared with everyone who plays:
// - as a Claude artifact, through the artifact's database: one document per
//   signed-in account, scores/<account id>, holding { players: { <name key>: entry } }
//   so several people can play under different names on one station tablet;
// - on a regular web host (Netlify, Hostinger, ...), through Google Cloud
//   Firestore: one document per player per device, players/<device>-<name key>
//   (see FIRESTORE below and "Shared scoreboard" in the README).
// If neither is reachable it falls back to the named players on this device.

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

// Firestore project for the shared scoreboard on a regular web host.
const FIRESTORE = { projectId: 'wfd-nav-trainer-scoreboard', apiKey: '' };
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${FIRESTORE.projectId}/databases/(default)/documents/players`;
const fsUrl = (path = '', query = '') => {
  const q = [query, FIRESTORE.apiKey ? `key=${FIRESTORE.apiKey}` : ''].filter(Boolean).join('&');
  return `${FS_BASE}${path}${q ? `?${q}` : ''}`;
};

let shared = null; // { kind: 'claude' | 'firestore', db, uid, rows }
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
    if (shared.kind === 'firestore') {
      await fsWrite(`${shared.uid}-${key}`, entry);
      await fsRefresh();
    } else {
      const ref = shared.db.doc(`scores/${shared.uid}`);
      const snap = await ref.get();
      const players = { ...(snap.exists ? snap.data().players : {}) };
      players[key] = entry;
      await ref.set({ players });
    }
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

// ---- Firestore (REST, no SDK) ----------------------------------------------
const int = (v) => ({ integerValue: String(Math.max(0, Math.round(v || 0))) });
function toFields(e) {
  return {
    name: { stringValue: String(e.name).slice(0, 40) },
    points: int(e.points), played: int(e.played), correct: int(e.correct), best: int(e.best),
    games: { stringValue: JSON.stringify(e.games || {}).slice(0, 4000) },
    updated: { timestampValue: e.updated },
  };
}
function fromDoc(d) {
  const f = d.fields || {};
  const num = (x) => Number(x?.integerValue || 0);
  let games = {};
  try { games = JSON.parse(f.games?.stringValue || '{}'); } catch { /* keep empty */ }
  const id = d.name.split('/').pop();
  return { name: f.name?.stringValue || '?', points: num(f.points), played: num(f.played), correct: num(f.correct), best: num(f.best), games, key: id, mine: id.startsWith(`${shared.uid}-`) };
}
async function fsWrite(id, entry) {
  const res = await fetch(fsUrl(`/${encodeURIComponent(id)}`), { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fields: toFields(entry) }) });
  if (res.status === 403) { shared.readOnly = true; emit(); }
}
async function fsRefresh() {
  const rows = [];
  let token = '';
  for (let page = 0; page < 10; page++) {
    const res = await fetch(fsUrl('', `pageSize=300${token ? `&pageToken=${encodeURIComponent(token)}` : ''}`));
    if (!res.ok) throw new Error(`Firestore ${res.status}`);
    const data = await res.json();
    for (const d of data.documents || []) rows.push(fromDoc(d));
    token = data.nextPageToken;
    if (!token) break;
  }
  shared.rows = rows;
  emit();
}
async function connectFirestore() {
  if (!FIRESTORE.projectId || !/^https?:$/.test(location.protocol)) return;
  let device = store.load('device', null);
  if (!device) { device = Math.random().toString(36).slice(2, 10); store.save('device', device); }
  shared = { kind: 'firestore', uid: device, rows: [] };
  try {
    await fsRefresh();
  } catch {
    shared = null; // database not set up or unreachable: stay on this device's board
    return;
  }
  mode = 'shared';
  emit();
  announce();
  // Pick up other players' scores while the page is open.
  setInterval(() => { if (!document.hidden) fsRefresh().catch(() => {}); }, 30000);
}

/** Re-read the shared board now (opening the Scoreboard page). */
export function refresh() {
  if (shared?.kind === 'firestore') fsRefresh().catch(() => {});
}

/** Try to connect to the shared database: the artifact's own, else Firestore. */
export async function connect() {
  if (!window.claude?.use) { await connectFirestore(); return; }
  try {
    const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
    const uid = db && user ? await user.id() : null;
    if (!db || !uid) return;
    shared = { kind: 'claude', db, uid, rows: [] };
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
