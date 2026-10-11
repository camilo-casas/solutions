// "West or East": starting on one rotation street, is another street west or
// east of it? Higher hundred-block numbers are further west.

import { STREETS } from '../lib/rotations.js';
import { el, onKeys, scoreBar } from '../ui.js';
import * as store from '../store.js';

const DECKS = [
  { id: 'major', label: 'Major streets' },
  { id: 'all', label: 'All streets' },
];

export function westEast(root, ctx) {
  const prefs = { deck: 'all', ...store.load('westeast:prefs', {}) };
  const head = el('div', { class: 'game-head' });
  const stage = el('div', { class: 'stage' });
  root.append(el('h1', { class: 'game-title' }, 'West or East'), head, stage);

  const pool = () => (prefs.deck === 'major' ? STREETS.filter((s) => s.major) : STREETS);
  const renderHead = () => head.replaceChildren(
    el('div', { class: 'deck-row' },
      el('span', { class: 'deck-label' }, 'Deck'),
      el('div', { class: 'segs' }, DECKS.map((d) => el('button', {
        type: 'button', class: d.id === prefs.deck ? 'seg on' : 'seg',
        onclick: () => { prefs.deck = d.id; store.save('westeast:prefs', prefs); ask(); },
      }, d.label)))),
    el('p', { class: 'muted small' }, 'Bigger hundred-block numbers are further west: Broadway is 0, Alkire is 13200.'),
    scoreBar(store.stats('westeast')));

  function ask() {
    renderHead();
    stage.replaceChildren();
    const list0 = pool();
    const a = list0[Math.floor(Math.random() * list0.length)];
    // A partner from the same deck: usually close by (harder), sometimes anywhere.
    // Skip pairs that can swap sides (Pierce also runs on the 6600 line).
    const blocks = (x) => [x.block, ...x.also];
    const clear = (x) => x !== a && blocks(x).every((bx) => blocks(a).every((ba) => (bx > ba) === (x.block > a.block) && bx !== ba));
    const p = list0.filter(clear);
    const near = p.filter((x) => Math.abs(x.block - a.block) <= 500);
    const list = near.length && Math.random() < 0.6 ? near : p;
    if (!list.length) { stage.append(el('div', { class: 'panel' }, 'Pick the bigger deck.')); return; }
    const b = list[Math.floor(Math.random() * list.length)];
    const truth = b.block > a.block ? 'west' : 'east';
    const t0 = performance.now();
    let done = false;
    const btns = {};
    const answer = (dir) => {
      if (done) return;
      done = true;
      const ok = dir === truth;
      Object.entries(btns).forEach(([k, btn]) => {
        btn.disabled = true;
        if (k === truth) btn.classList.add('right');
        else if (k === dir) btn.classList.add('wrong');
      });
      const ms = performance.now() - t0;
      const points = ok ? 10 + Math.max(0, Math.round(5 - ms / 1000)) : 0;
      store.record('westeast', ok ? 1 : 0, points, ms);
      renderHead();
      const gap = Math.abs(b.block - a.block) / 100;
      const miles = (Math.abs(b.block - a.block) / 1600).toFixed(1);
      stage.append(el('div', { class: `verdict ${ok ? 'good' : 'bad'}` },
        el('b', {}, ok ? `Correct: ${truth} (+${points})` : `It's ${truth}`),
        el('p', {}, `${b.name} (${b.block}) is ${gap} block${gap === 1 ? '' : 's'} ${truth} of ${a.name} (${a.block}), about ${miles} mi. Bigger number = further west.`),
        el('div', { class: 'ladder' },
          ...[a, b].sort((x, y) => y.block - x.block).map((x) => el('span', { class: x === b ? 'here' : '' }, `${x.block} ${x.name}`))),
        el('small', { class: 'muted' }, 'West ◀ ··· ▶ East'),
        el('button', { class: 'btn primary', onclick: ask }, 'Next ↵')));
    };
    btns.west = el('button', { class: 'btn big', onclick: () => answer('west') }, '◀ WEST');
    btns.east = el('button', { class: 'btn big', onclick: () => answer('east') }, 'EAST ▶');
    stage.append(
      el('div', { class: 'prompt we-prompt' },
        el('div', { class: 'face-sub' }, 'Starting on'),
        el('div', { class: 'face-big we-a' }, a.name, a.alias ? el('span', { class: 'alias' }, ` (${a.alias})`) : null),
        el('div', { class: 'face-sub' }, 'is'),
        el('div', { class: 'face-big we-b' }, b.name, b.alias ? el('span', { class: 'alias' }, ` (${b.alias})`) : null),
        el('div', { class: 'face-sub' }, 'west or east?')),
      el('div', { class: 'lr' }, btns.west, btns.east));
    onKeys((e) => {
      if (!done && (e.key === 'ArrowLeft' || e.key === 'a')) { e.preventDefault(); answer('west'); }
      else if (!done && (e.key === 'ArrowRight' || e.key === 'd')) { e.preventDefault(); answer('east'); }
      else if ((e.key === 'Enter' || e.key === ' ') && done) { e.preventDefault(); ask(); }
    });
  }

  ask();
  return {};
}
