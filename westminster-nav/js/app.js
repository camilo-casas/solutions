import { RoadGraph } from './lib/graph.js';
import { makeGrid } from './lib/grid.js';
import { shortName } from './lib/names.js';
import { CARDINAL_DEG } from './lib/geo.js';
import { el, clearKeys, pick } from './ui.js';
import * as store from './store.js';
import { flashcards } from './games/flashcards.js';
import { turnSignal } from './games/turnSignal.js';
import { cardinal } from './games/cardinal.js';
import { router } from './games/router.js';
import { setup } from './games/setup.js';
import { splash, scores } from './games/players.js';
import * as board from './scoreboard.js';

const GAMES = [
  { id: 'flashcards', name: 'Rotations', icon: '🗂️', blurb: 'Flash cards for the street rotations, from Broadway (0) out to Alkire (13200).', view: flashcards },
  { id: 'turn', name: 'Turn Signal', icon: '↔️', blurb: 'Station plus an address: do you turn left or right out of the bay?', view: turnSignal },
  { id: 'cardinal', name: 'Cardinal', icon: '🧭', blurb: 'From an address, which way is the hospital, station or landmark?', view: cardinal },
  { id: 'router', name: 'Router', icon: '🚒', blurb: 'Give turn-by-turn directions from the station. We drive them and grade the route.', view: router },
];

/** Shared context handed to every view. */
async function loadContext() {
  const get = async (url) => {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return res.json();
  };
  const embedded = window.WFD_DATA;
  const city = embedded?.city || await get('data/city.json');
  const fileStations = embedded?.stations || await get('data/stations.json');
  const landmarks = embedded?.landmarks || await get('data/landmarks.json').catch(() => []);
  const graph = new RoadGraph(city);
  const grid = makeGrid(city.meta.grid);
  const addresses = city.addresses.map(([num, ni, lat, lon, src]) => ({
    num, street: shortName(city.names[ni]), p: [lat, lon], approx: src === 1,
  }));
  const nodeCache = new Map();
  const ctx = {
    city, graph, grid, addresses, fileStations, landmarks,
    demo: city.meta.source === 'demo',
    streetNames: [...new Set(graph.edges.map((e) => shortName(e.name)).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    get stations() {
      const over = store.load('stations', null);
      return (over || fileStations).map((s) => ({ ...s, facing: typeof s.facing === 'string' ? CARDINAL_DEG[s.facing] : s.facing }));
    },
    stationsVerified() { return this.stations.every((s) => s.verified); },
    addressLabel: (a) => `${a.num} ${a.street}`,
    randomAddress: () => pick(addresses),
    /** Graph node where an address sits. */
    addressNode(a) {
      a.node ??= graph.snap(a.p, a.street);
      return a.node;
    },
    stationNode(s) {
      const k = `${s.lat},${s.lon},${s.street}`;
      if (!nodeCache.has(k)) nodeCache.set(k, graph.snap([s.lat, s.lon], s.street));
      return nodeCache.get(k);
    },
  };
  return ctx;
}

function home(root, ctx) {
  const cards = GAMES.map((g) => {
    const s = store.stats(g.id);
    const pct = s.played ? Math.round((100 * s.correct) / s.played) : null;
    return el('a', { class: 'game-card', href: `#/${g.id}` },
      el('div', { class: 'game-icon', 'aria-hidden': 'true' }, g.icon),
      el('div', {},
        el('h2', {}, g.name),
        el('p', {}, g.blurb),
        el('div', { class: 'game-meta' }, s.played ? `${s.points} pts · ${pct}% of ${s.played} · best streak ${s.best}` : 'Not played yet')));
  });
  root.append(
    el('section', { class: 'hero' },
      el('h1', {}, 'Know your first-due by heart.'),
      el('p', {}, 'Learn the Westminster street rotations, then test yourself on getting out of the station and to the address.')),
    el('div', { class: 'game-grid' }, cards),
    el('section', { class: 'panel small' },
      el('h3', {}, 'How the grid works'),
      el('p', {}, 'Avenues run east to west and are numbered: an address on a north-south street tells you the avenue (8732 Lowell = between 87th and 88th). ',
        'Names run north to south in alphabetical rotations: an address on an avenue tells you the cross street (3650 W 88th = between Lowell (3600) and Meade (3700)). ',
        'The bold anchor streets come every 800 numbers, about half a mile.')),
    el('p', { class: 'foot' },
      el('a', { href: '#/setup' }, 'Station setup'), ' · ',
      el('a', { href: '#/scores' }, 'Scoreboard'), ' · ',
      el('button', {
        class: 'link',
        onclick: (e) => {
          // Two-step confirm (dialogs are blocked inside artifacts).
          if (e.target.dataset.armed) { store.resetMine(); board.announce(); route(); return; }
          e.target.dataset.armed = '1';
          e.target.textContent = `Click again to erase ${store.player()?.name ? `${store.player().name}'s` : 'anonymous'} progress`;
        },
      }, 'Reset my progress'),
      ' · ', ctx.city.meta.note || ''),
  );
}

let ctxPromise = null;
let current = null;

async function route() {
  const root = document.getElementById('view');
  clearKeys();
  current?.destroy?.();
  current = null;
  root.replaceChildren(el('div', { class: 'loading' }, 'Loading map data…'));
  let ctx;
  try {
    ctx = await (ctxPromise ??= loadContext());
  } catch (err) {
    root.replaceChildren(el('div', { class: 'panel error' }, el('h2', {}, 'Could not load map data'), el('p', {}, String(err.message)),
      el('p', {}, 'Serve this folder over HTTP (for example ', el('code', {}, 'python3 -m http.server'), ') and check that data/city.json exists.')));
    return;
  }
  root.replaceChildren();
  const id = location.hash.replace(/^#\/?/, '').split('?')[0];
  renderPlayerChip();
  if (id === 'player' || (!store.player() && id !== 'setup')) {
    document.getElementById('banner').replaceChildren();
    splash(root, ctx, () => {
      renderPlayerChip();
      if (id === 'player') location.hash = '#/'; else route();
    });
    return;
  }
  const banner = document.getElementById('banner');
  banner.replaceChildren();
  if (ctx.demo) banner.append(el('div', { class: 'banner warn' }, el('b', {}, 'Demo map. '), 'These roads are a simplified grid, not the real street network. Build real data with tools/build-data.mjs (see README).'));
  if (id && id !== 'flashcards' && id !== 'setup' && !ctx.stationsVerified()) {
    banner.append(el('div', { class: 'banner' }, el('b', {}, 'Station locations not verified. '), 'Check them on the ', el('a', { href: '#/setup' }, 'Station setup'), ' page.'));
  }
  document.querySelectorAll('nav a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#/${id}`));
  const game = GAMES.find((g) => g.id === id);
  if (game) current = game.view(root, ctx);
  else if (id === 'setup') current = setup(root, ctx);
  else if (id === 'scores') current = scores(root, ctx);
  else home(root, ctx);
  window.scrollTo(0, 0);
}

function renderPlayerChip() {
  const chip = document.getElementById('player-chip');
  if (!chip) return;
  const p = store.player();
  chip.hidden = !p;
  chip.textContent = p?.name ? `👤 ${p.name}` : '👤 Anonymous';
  chip.title = 'Switch player';
}

window.addEventListener('hashchange', route);
board.connect();
route();
