// "Cross Streets": a real address on a numbered avenue. Which two rotation
// streets is it between? (5850 W 94th Ave -> Fenton & Gray.)

import { STREETS, bracketWest } from '../lib/rotations.js';
import { rule } from '../lib/mnemonics.js';
import { el, onKeys, scoreBar, stopwatch, shuffle } from '../ui.js';
import { mapPanel } from '../map.js';
import * as store from '../store.js';
import { COLORS } from './common.js';

const AVENUE = /^W \d+(st|nd|rd|th) (Ave|Pl|Dr|Way|Cir|Ct|Pkwy)$/;

export function crossStreets(root, ctx) {
  const head = el('div', { class: 'game-head' });
  const stage = el('div', { class: 'stage' });
  const { el: mapEl, map } = mapPanel(ctx, { labels: true });
  const mapBox = el('div', { class: 'reveal hidden' }, mapEl);
  root.append(el('h1', { class: 'game-title' }, 'Cross Streets'), head, stage, mapBox);

  const renderHead = () => head.replaceChildren(
    el('p', { class: 'muted small' }, 'An address on a numbered avenue tells you the cross streets: the house number is the hundred block west of Broadway. 3650 W 88th Ave sits between Lowell (3600) and Meade (3700).'),
    scoreBar(store.stats('cross')));

  // Real addresses on the numbered avenues, inside the rotation sheet (Broadway to Alkire).
  const ambiguous = new Set(STREETS.flatMap((s) => s.also)); // e.g. 6600: Pierce runs there too in places
  const pool = ctx.addresses.filter((a) => AVENUE.test(a.street) && a.num > 0 && a.num < STREETS[STREETS.length - 1].block);
  const real = pool.filter((a) => !a.approx);
  const span = (num) => {
    const { lo, hi } = bracketWest(num);
    if (!lo || !hi || ambiguous.has(lo.block) || ambiguous.has(hi.block)) return null;
    return { lo, hi };
  };
  const pairText = (lo, hi) => `${lo.name} & ${hi.name}`;

  function makeQuestion() {
    for (let i = 0; i < 60; i++) {
      const list = real.length && i < 50 ? real : pool;
      const a = list[Math.floor(Math.random() * list.length)];
      if (!a) break;
      const sp = span(a.num);
      if (!sp) continue;
      const k = STREETS.indexOf(sp.lo);
      const correct = pairText(sp.lo, sp.hi);
      const others = shuffle([-3, -2, -1, 1, 2, 3]).map((d) => [STREETS[k + d], STREETS[k + d + 1]])
        .filter(([x, y]) => x && y).map(([x, y]) => pairText(x, y)).filter((t) => t !== correct);
      const options = shuffle([correct, ...[...new Set(others)].slice(0, 3)]);
      return { a, ...sp, correct, options };
    }
    return null;
  }

  function ask() {
    renderHead();
    mapBox.classList.add('hidden');
    stage.replaceChildren();
    const q = makeQuestion();
    if (!q) { stage.append(el('div', { class: 'panel error' }, 'No avenue addresses in the map data.')); return; }
    const label = ctx.addressLabel(q.a);
    const timer = el('span', { class: 'timer' }, '0.0s');
    const watch = stopwatch(timer);
    let done = false;
    const btns = q.options.map((o, i) => el('button', { class: 'choice', onclick: () => answer(i) }, el('kbd', {}, i + 1), o));
    function answer(i) {
      if (done) return;
      done = true;
      const ms = watch.stop();
      const ok = q.options[i] === q.correct;
      const points = ok ? 10 + Math.max(0, Math.round(5 - ms / 1000)) : 0;
      store.record('cross', ok ? 1 : 0, points, ms);
      btns.forEach((b, j) => {
        b.disabled = true;
        if (q.options[j] === q.correct) b.classList.add('right');
        else if (j === i) b.classList.add('wrong');
      });
      renderHead();
      stage.append(el('div', { class: `verdict ${ok ? 'good' : 'bad'}` },
        el('b', {}, ok ? `Correct (+${points})` : `It's ${q.correct}`),
        el('p', {}, `${q.a.num} is between ${q.lo.name} (${q.lo.block}) and ${q.hi.name} (${q.hi.block}).`),
        el('div', { class: 'memory' },
          [q.lo, q.hi].map((s) => el('div', { class: 'rule' }, el('span', { class: 'mem-label' }, `${s.block} ${s.name}`), rule(s)))),
        el('button', { class: 'btn primary', onclick: ask }, 'Next ↵')));
      mapBox.classList.remove('hidden');
      map.set({ routes: [], markers: [{ p: q.a.p, color: COLORS.dest, r: 7, label }] });
      map.follow(q.a.p, 900);
    }
    stage.append(
      el('div', { class: 'prompt' },
        el('div', { class: 'face-big addr' }, label, q.a.approx ? el('span', { class: 'tag' }, 'approximate') : null),
        el('div', { class: 'face-sub' }, 'Between which two cross streets?'),
        timer),
      el('div', { class: 'choices' }, btns));
    onKeys((e) => {
      const n = Number(e.key);
      if (!done && n >= 1 && n <= btns.length) answer(n - 1);
      else if ((e.key === 'Enter' || e.key === ' ') && done) { e.preventDefault(); ask(); }
    });
  }

  ask();
  return { destroy: () => map.destroy() };
}
