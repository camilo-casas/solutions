// Rotation flash cards with simple Leitner-box spaced repetition.

import { ROTATIONS, STREETS, bracketWest } from '../lib/rotations.js';
import { ordinal } from '../lib/names.js';
import { el, shuffle, onKeys, scoreBar } from '../ui.js';
import * as store from '../store.js';

const MODES = [
  { id: 'study', label: 'Study', hint: 'Flip the card, then grade yourself.' },
  { id: 'name2block', label: 'Name → Block', hint: 'What hundred block is this street?' },
  { id: 'block2name', label: 'Block → Name', hint: 'Which street sits on this block?' },
  { id: 'decode', label: 'Address → Cross streets', hint: 'Which two streets is this avenue address between?' },
];

export function flashcards(root, ctx) {
  const prefs = store.load('fc:prefs', { mode: 'study', rotations: [1, 2, 3, 4], anchors: false });
  let boxes = store.loadMine('fc:boxes', {});
  let last = null;

  const pool = () => STREETS.filter((s) => prefs.rotations.includes(s.rotation) && (!prefs.anchors || s.major));
  const boxOf = (s) => boxes[`${prefs.mode}:${s.block}`] || 1;
  const setBox = (s, ok) => {
    const k = `${prefs.mode}:${s.block}`;
    boxes[k] = ok ? Math.min(5, (boxes[k] || 1) + 1) : 1;
    store.saveMine('fc:boxes', boxes);
  };
  const nextCard = () => {
    const p = pool();
    const cand = p.length > 1 ? p.filter((s) => s !== last) : p;
    const w = cand.map((s) => 1 / boxOf(s) ** 2);
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < cand.length; i++) { r -= w[i]; if (r <= 0) return (last = cand[i]); }
    return (last = cand[cand.length - 1]);
  };

  const head = el('div', { class: 'game-head' });
  const stage = el('div', { class: 'stage' });
  root.append(el('h1', { class: 'game-title' }, '🗂️ Rotations'), head, stage);

  function renderHead() {
    const p = pool();
    const mastered = p.filter((s) => boxOf(s) >= 4).length;
    head.replaceChildren(
      el('div', { class: 'tabs', role: 'tablist' }, MODES.map((m) => el('button', {
        class: m.id === prefs.mode ? 'tab on' : 'tab', role: 'tab', 'aria-selected': String(m.id === prefs.mode),
        onclick: () => { prefs.mode = m.id; store.save('fc:prefs', prefs); renderHead(); ask(); },
      }, m.label))),
      el('div', { class: 'chips' },
        ROTATIONS.map((r) => el('button', {
          class: prefs.rotations.includes(r.id) ? 'chip on' : 'chip', title: r.theme,
          onclick: () => {
            const on = prefs.rotations.includes(r.id);
            if (on && prefs.rotations.length === 1) return;
            prefs.rotations = on ? prefs.rotations.filter((x) => x !== r.id) : [...prefs.rotations, r.id].sort();
            store.save('fc:prefs', prefs); renderHead(); ask();
          },
        }, `${r.streets[0][1]}–${r.streets[r.streets.length - 1][1]}`)),
        el('button', {
          class: prefs.anchors ? 'chip on' : 'chip', title: 'Only the bold anchor streets (every 800)',
          onclick: () => { prefs.anchors = !prefs.anchors; store.save('fc:prefs', prefs); renderHead(); ask(); },
        }, 'Anchors only')),
      el('div', { class: 'progress' },
        el('div', { class: 'progress-bar' }, el('span', { style: `width:${p.length ? (100 * mastered) / p.length : 0}%` })),
        el('small', {}, `${mastered} of ${p.length} cards mastered in this mode · ${MODES.find((m) => m.id === prefs.mode).hint}`)),
      prefs.mode === 'study' ? null : scoreBar(store.stats('flashcards')),
    );
  }

  function context(s) {
    const i = STREETS.indexOf(s);
    const prev = STREETS[i - 1];
    const next = STREETS[i + 1];
    const rot = ROTATIONS.find((r) => r.id === s.rotation);
    const anchor = [...STREETS].filter((x) => x.major).sort((a, b) => Math.abs(a.block - s.block) - Math.abs(b.block - s.block))[0];
    return el('div', { class: 'card-context' },
      el('div', { class: 'ladder' },
        prev ? el('span', {}, `${prev.block} ${prev.name}`) : null,
        el('span', { class: 'here' }, `${s.block} ${s.name}${s.alias ? ` (${s.alias})` : ''}`),
        next ? el('span', {}, `${next.block} ${next.name}`) : null),
      el('small', {}, `${rot.title}. ${rot.theme}.`,
        anchor && anchor !== s ? ` Nearest anchor: ${anchor.name} (${anchor.block}).` : ' This is an anchor street.'));
  }

  function choiceButtons(options, correctIdx, onDone) {
    const t0 = performance.now();
    let done = false;
    const btns = options.map((o, i) => el('button', {
      class: 'choice',
      onclick: () => answer(i),
    }, el('kbd', {}, i + 1), o));
    function answer(i) {
      if (done) return;
      done = true;
      btns.forEach((b, j) => {
        b.disabled = true;
        if (j === correctIdx) b.classList.add('right');
        else if (j === i) b.classList.add('wrong');
      });
      onDone(i === correctIdx, performance.now() - t0);
    }
    onKeys((e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= options.length) answer(n - 1);
      else if ((e.key === 'Enter' || e.key === ' ') && done) { e.preventDefault(); ask(); }
    });
    return el('div', { class: 'choices' }, btns);
  }

  function nearby(s, count, valid = () => true) {
    const p = STREETS.filter((x) => x !== s && valid(x)).sort((a, b) => Math.abs(a.block - s.block) - Math.abs(b.block - s.block));
    return shuffle(p.slice(0, count + 3)).slice(0, count);
  }

  function result(ok, ms, s, extra) {
    const points = ok ? 10 + Math.max(0, Math.round(5 - ms / 1000)) : 0;
    store.record('flashcards', ok ? 1 : 0, points, ms);
    setBox(s, ok);
    renderHead();
    return el('div', { class: `verdict ${ok ? 'good' : 'bad'}` },
      el('b', {}, ok ? `Correct (+${points})` : 'Not quite'),
      extra || null,
      context(s),
      el('button', { class: 'btn primary', onclick: ask }, 'Next card ↵'));
  }

  function ask() {
    const s = nextCard();
    stage.replaceChildren();
    if (prefs.mode === 'study') {
      let flipped = false;
      const card = el('button', { class: 'flashcard', 'aria-live': 'polite' });
      const grade = el('div', { class: 'grade hidden' },
        el('button', { class: 'btn bad', onclick: () => { setBox(s, false); renderHead(); ask(); } }, 'Missed it (1)'),
        el('button', { class: 'btn good', onclick: () => { setBox(s, true); renderHead(); ask(); } }, 'Knew it (2)'));
      const front = Math.random() < 0.5;
      const show = () => {
        card.replaceChildren(
          el('div', { class: 'face-big' }, front ? s.name : s.block),
          el('div', { class: 'face-sub' }, flipped ? (front ? `${s.block} W` : s.name + (s.alias ? ` (${s.alias})` : '')) : 'tap to flip'),
          flipped ? context(s) : null);
        card.classList.toggle('flipped', flipped);
      };
      card.onclick = () => { flipped = !flipped; show(); grade.classList.toggle('hidden', !flipped); };
      show();
      stage.append(card, grade);
      onKeys((e) => {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); card.click(); }
        if (flipped && e.key === '1') grade.children[0].click();
        if (flipped && e.key === '2') grade.children[1].click();
      });
      return;
    }

    if (prefs.mode === 'name2block' || prefs.mode === 'block2name') {
      const opts = shuffle([s, ...nearby(s, 3)]);
      const n2b = prefs.mode === 'name2block';
      stage.append(
        el('div', { class: 'prompt' },
          el('div', { class: 'face-big' }, n2b ? s.name : `${s.block} W`),
          el('div', { class: 'face-sub' }, n2b ? 'What block is it?' : 'Which street is it?')),
        choiceButtons(opts.map((o) => (n2b ? `${o.block}` : o.name)), opts.indexOf(s), (ok, ms) => stage.append(result(ok, ms, s))),
      );
      return;
    }

    // decode: "3650 W 88th Ave"
    if (!STREETS[STREETS.indexOf(s) + 1]) { ask(); return; }
    const nextS = STREETS[STREETS.indexOf(s) + 1];
    const span = nextS ? nextS.block - s.block : 100;
    const num = s.block + 2 * Math.floor((Math.random() * (span - 2)) / 2) + 2;
    const ave = 70 + Math.floor(Math.random() * 80);
    const pair = (x) => {
      const { lo, hi } = bracketWest(x);
      return lo && hi ? `${lo.name} & ${hi.name}` : null;
    };
    const correct = pair(num);
    const i = STREETS.indexOf(s);
    const others = shuffle([-3, -2, -1, 1, 2, 3]).map((d) => STREETS[i + d]).filter(Boolean).map((x) => pair(x.block + 1)).filter((x) => x && x !== correct);
    const opts = shuffle([correct, ...[...new Set(others)].slice(0, 3)]);
    stage.append(
      el('div', { class: 'prompt' },
        el('div', { class: 'face-big addr' }, `${num} W ${ordinal(ave)} Ave`),
        el('div', { class: 'face-sub' }, 'Between which two cross streets?')),
      choiceButtons(opts, opts.indexOf(correct), (ok, ms) => stage.append(result(ok, ms, s,
        el('p', {}, `${num} sits between ${correct.replace(' & ', ` (${s.block}) and `)}${nextS ? ` (${nextS.block})` : ''}.`)))),
    );
  }

  renderHead();
  ask();
  return {};
}
