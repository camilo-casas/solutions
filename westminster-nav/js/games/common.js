// Pieces shared by the station-based games.

import { CARDINAL_NAMES, toCardinal, distance } from '../lib/geo.js';
import { describeWest, describeNorth } from '../lib/grid.js';
import { el, pick, fmtTime } from '../ui.js';
import * as store from '../store.js';

export const COLORS = { best: '#c1121f', alt: '#8a8178', user: '#e0a400', station: '#c1121f', dest: '#1f6feb', poi: '#7d1128' };

export const facingName = (deg) => CARDINAL_NAMES[toCardinal(deg)];

/** "Any station" / "Station 3" selector remembered per game. */
export function stationPicker(ctx, game, onChange) {
  const key = `station:${game}`;
  const sel = el('select', { 'aria-label': 'Station', onchange: () => { store.save(key, sel.value); onChange?.(); } },
    el('option', { value: '' }, 'Random station'),
    ctx.stations.map((s) => el('option', { value: String(s.id) }, s.name)));
  sel.value = store.load(key, '');
  return {
    el: el('label', { class: 'inline' }, 'From ', sel),
    get: () => (sel.value ? ctx.stations.find((s) => String(s.id) === sel.value) : pick(ctx.stations)) || pick(ctx.stations),
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
