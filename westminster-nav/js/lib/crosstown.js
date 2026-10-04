// Cross-town avenues: the east-west streets that carry you across the city,
// and how far each one runs without a break. Built from the road network, so
// it follows the map data: a street's "run" is one connected stretch of road
// segments that share its name (both carriageways of a divided avenue count).

import { shortName, nameKey, ordinal } from './names.js';
import { STREETS, bracketWest } from './rotations.js';

const SHEET_W = 13200; // Alkire, the west end of the rotation sheet
const MIN_RUN = 3000; // about 1.9 miles of the sheet (1600 = 1 mile)
const MIN_PIECE = 500; // shorter pieces aren't worth learning

const AVE = /^(?:[WE] )?(\d+)(?:st|nd|rd|th) (Ave|Pkwy)$/;

/** The cross-town avenues, south to north. Cached on the shared context. */
export function crosstown(ctx) {
  if (ctx.crosstown) return ctx.crosstown;
  const G = ctx.graph;
  const grid = ctx.grid;
  const lats = ctx.city.boundary.flat().map((p) => p[0]);
  const [south, north] = [Math.min(...lats), Math.max(...lats)];

  const groups = new Map();
  for (const e of G.edges) {
    if (!e.name) continue;
    const m = AVE.exec(shortName(e.name));
    if (!m) continue;
    const k = nameKey(e.name);
    if (!groups.has(k)) groups.set(k, { number: Number(m[1]), type: m[2], edges: [] });
    groups.get(k).edges.push(e);
  }

  const list = [];
  for (const { number, type, edges } of groups.values()) {
    // Connected pieces (union-find over the street's own segments).
    const parent = new Map();
    const find = (x) => {
      while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); }
      return x;
    };
    for (const e of edges) {
      for (const n of [e.from, e.to]) if (!parent.has(n)) parent.set(n, n);
      parent.set(find(e.from), find(e.to));
    }
    const comps = new Map();
    for (const n of parent.keys()) {
      const r = find(n);
      if (!comps.has(r)) comps.set(r, []);
      comps.get(r).push(n);
    }
    const pieces = [...comps.values()].map((ns) => {
      let w0 = Infinity;
      let w1 = -Infinity;
      let lat = 0;
      for (const n of ns) {
        const [la, lo] = G.pt(n);
        const w = grid.westNumber(lo);
        w0 = Math.min(w0, w);
        w1 = Math.max(w1, w);
        lat += la;
      }
      return { w0, w1, lat: lat / ns.length };
    })
      // Only what's on the rotation sheet (Broadway to Alkire) counts.
      .map((p) => ({ ...p, a: Math.max(0, p.w0), b: Math.min(SHEET_W, p.w1) }))
      .filter((p) => p.b - p.a >= MIN_PIECE)
      .sort((x, y) => (y.b - y.a) - (x.b - x.a));
    const run = pieces[0];
    if (!run || run.b - run.a < MIN_RUN || run.lat < south || run.lat > north) continue;
    list.push({
      id: `ave-${number}-${type}`,
      number,
      name: `W ${ordinal(number)} ${type}`,
      block: number * 100 + (type === 'Ave' ? 0 : 50),
      run,
      // Ends of the unbroken stretch, named by the rotation street there.
      west: endpoint(run.w1, 'west'),
      east: endpoint(run.w0, 'east'),
      miles: (run.b - run.a) / 1600,
      crosses: STREETS.filter((s) => s.major && s.block > run.a + 50 && s.block < run.b - 50),
      others: pieces.slice(1).sort((x, y) => y.b - x.b).map((p) => ({ ...p, west: endpoint(p.w1, 'west'), east: endpoint(p.w0, 'east') })),
    });
  }
  list.sort((a, b) => a.block - b.block);
  ctx.crosstown = list;
  return list;
}

/** Where a run ends, as a rotation street ("Pecos (1600)"), or past the sheet's edge. */
function endpoint(w, side) {
  if (side === 'east' && w < 100) return { label: 'Broadway and beyond', short: 'Broadway', block: 0, beyond: w < -50 };
  if (side === 'west' && w > SHEET_W - 100) return { label: 'Alkire and beyond', short: 'Alkire', block: SHEET_W, beyond: w > SHEET_W + 50 };
  const { lo, hi } = bracketWest(w);
  const s = !hi || (lo && w - lo.block <= hi.block - w) ? lo : hi;
  return { label: `${s.name} (${s.block})`, short: s.name, block: s.block, street: s };
}

/** "Pecos (1600) to Zephyr (7900), 3.9 mi" */
export const runText = (a) => `${a.east.label} west to ${a.west.label}, about ${a.miles.toFixed(1)} mi unbroken`;

export const SHEET_WIDTH = SHEET_W;
