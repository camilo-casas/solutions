// "Street Side": which side of the street is this address on?
// Westminster numbers odd on the north and west sides of a street, even on the
// south and east sides. NOW: North, Odd, West. SEE: South, Even, East.

import { el, onKeys, scoreBar, stopwatch } from '../ui.js';
import { mapPanel } from '../map.js';
import * as store from '../store.js';
import { COLORS } from './common.js';

const NAMES = { N: 'North', E: 'East', S: 'South', W: 'West' };
const KEYS = { ArrowUp: 'N', ArrowRight: 'E', ArrowDown: 'S', ArrowLeft: 'W', w: 'N', d: 'E', s: 'S', a: 'W' };
export const NOW_SEE = 'NOW: North, Odd, West. SEE: South, Even, East.';

export function streetSide(root, ctx) {
  const G = ctx.graph;
  const head = el('div', { class: 'game-head' });
  const stage = el('div', { class: 'stage' });
  const { el: mapEl, map } = mapPanel(ctx, { labels: true });
  const mapBox = el('div', { class: 'reveal hidden' }, mapEl);
  root.append(el('h1', { class: 'game-title' }, 'Street Side'), head, stage, mapBox);

  const renderHead = () => head.replaceChildren(
    el('p', { class: 'muted small' }, 'Odd numbers are on the north and west sides of a street, even numbers on the south and east. ', el('b', {}, 'NOW'), ' (North, Odd, West) and ', el('b', {}, 'SEE'), ' (South, Even, East).'),
    scoreBar(store.stats('side')));

  // Edges by street, built once: the street's direction near an address.
  const byStreet = new Map();
  const edgesOf = (street) => {
    if (!byStreet.has(street)) byStreet.set(street, G.edgesOn(street));
    return byStreet.get(street);
  };

  /** Where an address sits against its street: the street's axis, and which side the building is on. */
  function locate(a) {
    let best = null;
    const [lat, lon] = a.p;
    const kx = Math.cos((lat * Math.PI) / 180) * 111320;
    const ky = 110540;
    for (const e of edgesOf(a.street)) {
      const [alat, alon] = G.pt(e.from);
      const [blat, blon] = G.pt(e.to);
      const ax = (alon - lon) * kx; const ay = (alat - lat) * ky;
      const bx = (blon - lon) * kx; const by = (blat - lat) * ky;
      const dx = bx - ax; const dy = by - ay;
      const L2 = dx * dx + dy * dy;
      if (!L2) continue;
      const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L2));
      const px = ax + t * dx; const py = ay + t * dy;
      const d = Math.hypot(px, py);
      if (!best || d < best.d) best = { d, dx, dy, px, py };
    }
    if (!best || best.d > 120 || best.d < 3) return null;
    const ang = Math.abs(Math.atan2(best.dx, best.dy) * 180 / Math.PI) % 180; // 0 = north-south
    const off = Math.min(ang, 180 - ang); // degrees from north-south
    if (off > 25 && off < 65) return null; // diagonal street: no clean answer
    const ns = off <= 25;
    // The building is at the origin; the street point is at (px, py).
    const side = ns ? (best.px < 0 ? 'E' : 'W') : (best.py < 0 ? 'N' : 'S');
    return { ns, side };
  }

  function makeQuestion() {
    for (let i = 0; i < 80; i++) {
      const a = ctx.randomAddress();
      if (a.approx && i < 60) continue; // real address points first
      const loc = locate(a);
      if (!loc) continue;
      const even = a.num % 2 === 0;
      const truth = loc.ns ? (even ? 'E' : 'W') : (even ? 'S' : 'N');
      if (truth !== loc.side) continue; // the map must agree with the rule
      return { a, even, truth, ns: loc.ns };
    }
    return null;
  }

  function ask() {
    renderHead();
    mapBox.classList.add('hidden');
    stage.replaceChildren();
    const q = makeQuestion();
    if (!q) { stage.append(el('div', { class: 'panel error' }, 'Could not find an address to ask about.')); return; }
    const label = ctx.addressLabel(q.a);
    const timer = el('span', { class: 'timer' }, '0.0s');
    const watch = stopwatch(timer);
    let done = false;
    const btns = {};
    const answer = (c) => {
      if (done) return;
      done = true;
      const ms = watch.stop();
      const ok = c === q.truth;
      const points = ok ? 10 + Math.max(0, Math.round(5 - ms / 1000)) : 0;
      store.record('side', ok ? 1 : 0, points, ms);
      Object.entries(btns).forEach(([k, b]) => {
        b.disabled = true;
        if (k === q.truth) b.classList.add('right');
        else if (k === c) b.classList.add('wrong');
      });
      renderHead();
      const axis = q.ns ? 'north–south, so its sides are east and west' : 'east–west, so its sides are north and south';
      const offAxis = !ok && (q.ns ? c === 'N' || c === 'S' : c === 'E' || c === 'W');
      stage.append(el('div', { class: `verdict ${ok ? 'good' : 'bad'}` },
        el('b', {}, ok ? `Correct: ${NAMES[q.truth]} side (+${points})` : `It's the ${NAMES[q.truth]} side`),
        el('p', {}, `${q.a.street} runs ${axis}. ${q.a.num} is ${q.even ? 'even' : 'odd'}, so it's on the ${NAMES[q.truth].toLowerCase()} side.`,
          offAxis ? ` A street that runs ${q.ns ? 'north–south' : 'east–west'} has no ${NAMES[c].toLowerCase()} side.` : ''),
        el('div', { class: 'memory' }, el('div', { class: 'hook' }, el('span', { class: 'mem-label' }, 'Remember'),
          el('div', {}, el('b', {}, q.even ? 'SEE' : 'NOW'), q.even ? ': South, Even, East.' : ': North, Odd, West.'),
          el('div', { class: 'muted' }, NOW_SEE))),
        el('button', { class: 'btn primary', onclick: ask }, 'Next ↵')));
      mapBox.classList.remove('hidden');
      map.set({ routes: [], markers: [{ p: q.a.p, color: COLORS.dest, r: 7, label }] });
      map.follow(q.a.p, 420);
    };
    for (const c of ['N', 'E', 'S', 'W']) btns[c] = el('button', { class: 'rose-btn', onclick: () => answer(c) }, NAMES[c]);
    stage.append(
      el('div', { class: 'prompt' },
        el('div', { class: 'face-big addr' }, label),
        el('div', { class: 'face-sub' }, 'Which side of the street is it on?'),
        timer),
      el('div', { class: 'rose side-rose' },
        el('div'), btns.N, el('div'),
        btns.W, el('div', { class: 'rose-center', 'aria-hidden': 'true' }, '🏠'), btns.E,
        el('div'), btns.S, el('div')),
      el('small', { class: 'muted center' }, 'Keys: arrows or W A S D'));
    onKeys((e) => {
      const k = KEYS[e.key] || KEYS[e.key.toLowerCase()];
      if (!done && k) { e.preventDefault(); answer(k); } else if ((e.key === 'Enter' || e.key === ' ') && done) { e.preventDefault(); ask(); }
    });
  }

  ask();
  return { destroy: () => map.destroy() };
}
