// "Turn Signal": left or right out of the bay?

import { bearing, toCardinal, CARDINAL_NAMES } from '../lib/geo.js';
import { el, onKeys, scoreBar, stopwatch } from '../ui.js';
import { mapPanel } from '../map.js';
import * as store from '../store.js';
import { COLORS, stationPicker, stationCard, addressAwayFrom, gridNote, directionsList, driveTime } from './common.js';

export function turnSignal(root, ctx) {
  const G = ctx.graph;
  const picker = stationPicker(ctx, 'turn', () => ask());
  const head = el('div', { class: 'game-head' });
  const stage = el('div', { class: 'stage' });
  const { el: mapEl, map } = mapPanel(ctx);
  const mapBox = el('div', { class: 'reveal hidden' }, mapEl);
  root.append(el('h1', { class: 'game-title' }, '↔️ Turn Signal'), head, stage, mapBox);

  const renderHead = () => head.replaceChildren(
    el('div', { class: 'row' }, picker.el),
    scoreBar(store.stats('turn')));

  function makeQuestion() {
    for (let tries = 0; tries < 25; tries++) {
      const s = picker.get();
      const start = ctx.stationNode(s);
      const a = addressAwayFrom(ctx, [s.lat, s.lon], 600);
      const target = ctx.addressNode(a);
      const { opts } = G.departureOptions(start, s.facing, s.street, target);
      if (opts.left && opts.right && isFinite(opts.left.cost) && isFinite(opts.right.cost)) return { s, a, start, target, opts };
    }
    return null;
  }

  function ask() {
    renderHead();
    mapBox.classList.add('hidden');
    const q = makeQuestion();
    stage.replaceChildren();
    if (!q) {
      stage.append(el('div', { class: 'panel error' }, 'Could not build a question: check that the station sits on a two-way street in Station setup.'));
      return;
    }
    const timer = el('span', { class: 'timer' }, '0.0s');
    const watch = stopwatch(timer);
    let done = false;
    const answer = (side) => {
      if (done) return;
      done = true;
      const ms = watch.stop();
      reveal(q, side, ms);
    };
    stage.append(
      el('div', { class: 'prompt' },
        stationCard(q.s),
        el('div', { class: 'face-sub' }, 'Responding to'),
        el('div', { class: 'face-big addr' }, ctx.addressLabel(q.a)),
        q.a.approx ? el('small', { class: 'muted' }, 'Approximate address generated from the grid') : null,
        timer),
      el('div', { class: 'lr' },
        el('button', { class: 'btn big', onclick: () => answer('left') }, '◀ LEFT'),
        el('button', { class: 'btn big', onclick: () => answer('right') }, 'RIGHT ▶')));
    onKeys((e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') answer('left');
      if (e.key === 'ArrowRight' || e.key === 'd') answer('right');
      if ((e.key === 'Enter' || e.key === ' ') && done) { e.preventDefault(); ask(); }
    });
  }

  function reveal(q, side, ms) {
    const { left, right } = q.opts;
    const best = left.cost <= right.cost ? 'left' : 'right';
    const other = best === 'left' ? 'right' : 'left';
    const margin = (q.opts[other].cost - q.opts[best].cost) / q.opts[best].cost;
    const close = margin < 0.05;
    const ok = side === best || close;
    const points = ok ? 10 + Math.max(0, Math.round(10 - ms / 1000)) : 0;
    store.record('turn', ok ? 1 : 0, points, ms);
    renderHead();
    const dir = CARDINAL_NAMES[toCardinal(bearing([q.s.lat, q.s.lon], q.a.p))];
    const steps = G.directions(q.opts[best].path, q.s.facing);
    stage.append(el('div', { class: `verdict ${ok ? 'good' : 'bad'}` },
      el('b', {}, ok ? `Correct: ${best.toUpperCase()} (+${points})` : `It's ${best.toUpperCase()}`),
      close ? el('p', {}, 'Close call: both ways are within 5%, so either counts.') : null,
      el('p', {}, `Left ${driveTime(left.cost)} · Right ${driveTime(right.cost)}. The address is ${dir} of the station, ${gridNote(ctx, q.a.p)}.`),
      directionsList(steps, ctx.addressLabel(q.a)),
      el('button', { class: 'btn primary', onclick: ask }, 'Next call ↵')));
    mapBox.classList.remove('hidden');
    const bestPts = G.pathPoints(q.opts[best].path);
    map.set({
      routes: [
        { pts: G.pathPoints(q.opts[other].path), color: COLORS.alt, width: 4, dash: [8, 6] },
        { pts: bestPts, color: COLORS.best, width: 5 },
      ],
      markers: [
        { p: [q.s.lat, q.s.lon], color: COLORS.station, text: q.s.id, r: 9, heading: q.s.facing, label: q.s.name },
        { p: q.a.p, color: COLORS.dest, r: 7, label: ctx.addressLabel(q.a) },
      ],
    });
    map.fit([...bestPts, q.a.p, [q.s.lat, q.s.lon]]);
  }

  ask();
  return { destroy: () => map.destroy() };
}
