// Pieces shared by the station-based games.

import { CARDINAL_NAMES, toCardinal, distance } from '../lib/geo.js';
import { describeWest, describeNorth } from '../lib/grid.js';
import { el, pick, fmtTime } from '../ui.js';
import * as store from '../store.js';
import { MinHeap } from '../lib/graph.js';

export const COLORS = { best: '#c1121f', alt: '#8a8178', user: '#e0a400', station: '#c1121f', dest: '#1f6feb', poi: '#7d1128' };

export const facingName = (deg) => CARDINAL_NAMES[toCardinal(deg)];

/** "Any station" / "Station 3" selector remembered per game. */
export function stationPicker(ctx, game, onChange, anyLabel = 'Random station') {
  const key = `station:${game}`;
  const sel = el('select', { 'aria-label': 'Station', onchange: () => { store.save(key, sel.value); onChange?.(); } },
    el('option', { value: '' }, anyLabel),
    ctx.stations.map((s) => el('option', { value: String(s.id) }, s.name)));
  sel.value = store.load(key, '');
  return {
    el: el('label', { class: 'inline' }, 'From ', sel),
    get: () => (sel.value ? ctx.stations.find((s) => String(s.id) === sel.value) : pick(ctx.stations)) || pick(ctx.stations),
    /** The station picked, or null for "closest station". */
    chosen: () => (sel.value ? ctx.stations.find((s) => String(s.id) === sel.value) || null : null),
  };
}

export function stationCard(s) {
  return el('div', { class: 'station-card' },
    el('div', { class: 'station-badge' }, s.id),
    el('div', {},
      el('b', {}, s.name),
      el('div', {}, s.address || ''),
      el('small', {}, `Bay faces ${facingName(s.facing)} onto ${s.street}`)));
}

// ---- First due -------------------------------------------------------------
// Every spot in the city belongs to the station that can drive there fastest:
// one Dijkstra run outward from all six stations at once, cached per layout.
export function firstDue(ctx) {
  const stations = ctx.stations;
  const key = stations.map((s) => `${s.id}:${s.lat},${s.lon},${s.street}`).join('|');
  if (ctx.firstDueCache?.key === key) return ctx.firstDueCache;
  const G = ctx.graph;
  // Place the stations on the road map first: snapping can add nodes.
  const starts = stations.map((s) => ctx.stationNode(s));
  const size = G.base + G.extra.length;
  const dist = new Float64Array(size).fill(Infinity);
  const who = new Int16Array(size).fill(-1);
  const done = new Uint8Array(size);
  const heap = new MinHeap();
  starts.forEach((v, i) => {
    if (v < 0 || v >= size) return;
    if (dist[v] > 0) { dist[v] = 0; who[v] = i; heap.push(0, v); }
  });
  while (heap.size) {
    const n = heap.pop();
    if (done[n]) continue;
    done[n] = 1;
    for (const id of G.out[n]) {
      const e = G.edges[id];
      if (e.to >= size) continue;
      const d = dist[n] + e.cost;
      if (d < dist[e.to]) { dist[e.to] = d; who[e.to] = who[n]; heap.push(d, e.to); }
    }
  }
  ctx.firstDueCache = { key, dist, who };
  return ctx.firstDueCache;
}

/** The station closest (by drive time) to an address, and the drive time in seconds. */
export function stationFor(ctx, a) {
  const fd = firstDue(ctx);
  const G = ctx.graph;
  const size = fd.who.length;
  if (a.fdNode === undefined) {
    // Nearest point on the address's street that was on the map when the table
    // was built (placing addresses can add points after that).
    let best = -1;
    let bd = Infinity;
    fd.streets ??= new Map();
    if (!fd.streets.has(a.street)) {
      const on = G.edgesOn(a.street);
      fd.streets.set(a.street, on.length ? on : G.edgesOn(null));
    }
    for (const e of fd.streets.get(a.street)) {
      if (e.from >= size) continue;
      const d = distance(a.p, G.pt(e.from));
      if (d < bd) { bd = d; best = e.from; }
    }
    a.fdNode = best;
  }
  const n = a.fdNode;
  if (!(n >= 0) || n >= size || fd.who[n] < 0) return null;
  return { station: ctx.stations[fd.who[n]], time: fd.dist[n] };
}

/**
 * A random address and the station that answers it: the closest station, or
 * only addresses in `only`'s first-due area when a station is picked.
 */
export function firstDueCall(ctx, only = null) {
  if (only) {
    // Sort every address into its first-due station once, then pick from the list.
    const fd = firstDue(ctx);
    if (!fd.byStation) {
      fd.byStation = new Map();
      for (const a of ctx.addresses) {
        const f = stationFor(ctx, a);
        if (!f) continue;
        if (!fd.byStation.has(f.station.id)) fd.byStation.set(f.station.id, []);
        fd.byStation.get(f.station.id).push(a);
      }
    }
    const list = fd.byStation.get(only.id) || [];
    if (!list.length) return null;
    const a = pick(list);
    return { a, station: stationFor(ctx, a).station, time: stationFor(ctx, a).time };
  }
  for (let i = 0; i < 50; i++) {
    const a = ctx.randomAddress();
    const f = stationFor(ctx, a);
    if (f) return { a, station: f.station, time: f.time };
  }
  return null;
}

export const FIRST_DUE_NOTE = 'Each call goes out from the station closest to the address by drive time. Pick a station to get only calls in its first-due area.';

/** Random address at least `minDist` meters from a point. */
export function addressAwayFrom(ctx, p, minDist = 500, maxDist = Infinity) {
  if (isFinite(maxDist)) {
    const near = ctx.addresses.filter((a) => { const d = distance(a.p, p); return d >= minDist && d <= maxDist; });
    if (near.length) return pick(near);
  }
  for (let i = 0; i < 50; i++) {
    const a = ctx.randomAddress();
    if (distance(a.p, p) >= minDist) return a;
  }
  return ctx.randomAddress();
}

/** Where a point sits on the address grid, e.g. "about 4350 W, 8634 N". */
export function gridNote(ctx, p) {
  const w = Math.round(ctx.grid.westNumber(p[1]) / 10) * 10;
  const n = Math.round(ctx.grid.northNumber(p[0]) / 10) * 10;
  return `about ${w} W (${describeWest(w)}), ${n} N (${describeNorth(n)})`;
}

const TURN_WORD = { left: 'Turn left', right: 'Turn right', straight: 'Continue', 'u-turn': 'Make a U-turn' };

export function directionsList(steps, destLabel) {
  return el('ol', { class: 'directions' },
    steps.map((st, i) => el('li', {},
      el('span', { class: `turn ${st.turn || ''}` }, i === 0 ? `${st.turn === 'left' ? 'Left' : st.turn === 'right' ? 'Right' : 'Out'} out of the bay` : TURN_WORD[st.turn] || 'Continue'),
      ' onto ', el('b', {}, st.name), el('small', {}, ` · ${(st.dist / 1609.344).toFixed(2)} mi`))),
    el('li', {}, el('span', { class: 'turn arrive' }, 'Arrive'), ' at ', el('b', {}, destLabel)));
}

export const driveTime = (sec) => `≈${fmtTime(sec)}`;
