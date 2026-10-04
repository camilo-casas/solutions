// Rotation flash cards: guided Learn mode (chunked encoding + immediate
// retrieval quiz), then free practice with Leitner-box spaced repetition.

import { ROTATIONS, STREETS, bracketWest, conflicts } from '../lib/rotations.js';
import { ordinal } from '../lib/names.js';
import { rule, mnemonic, alsoNote, MAJOR_TIP, PEGS, PEG_ART } from '../lib/mnemonics.js';
import { openPoster, artURI } from '../mnemonicArt.js';
import { el, shuffle, onKeys, scoreBar } from '../ui.js';
import * as store from '../store.js';

const MODES = [
  { id: 'learn', label: 'Learn', hint: 'Learn 6 streets at a time with memory hooks, then quiz on them.' },
  { id: 'study', label: 'Study', hint: 'Flip the card, then grade yourself.' },
  { id: 'name2block', label: 'Name → Block', hint: 'What hundred block is this street?' },
  { id: 'block2name', label: 'Block → Name', hint: 'Which street sits on this block?' },
  { id: 'decode', label: 'Address → Cross streets', hint: 'Which two streets is this avenue address between?' },
  { id: 'side', label: 'Street side', hint: 'Which side of the street is it on? Even = south or east, odd = north or west.' },
];
const DECKS = [
  { id: 'major', label: 'Major streets', title: 'The 18 bold anchor streets' },
  { id: 'all', label: 'All streets', title: 'Every street on the rotation sheet' },
];
const CHUNK = 6;

export function flashcards(root, ctx) {
  const prefs = { mode: 'learn', deck: 'major', rotations: [1, 2, 3, 4], ...store.load('fc:prefs', {}) };
  if (!MODES.some((m) => m.id === prefs.mode)) prefs.mode = 'learn';
  const savePrefs = () => store.save('fc:prefs', prefs);
  let boxes = store.loadMine('fc:boxes', {});
  let last = null;

  const pool = () => (prefs.deck === 'major'
    ? STREETS.filter((s) => s.major)
    : STREETS.filter((s) => prefs.rotations.includes(s.rotation)));
  const deckKey = () => (prefs.deck === 'major' ? 'major' : `all-${prefs.rotations.join('')}`);
  const boxKey = (s, mode = prefs.mode) => `${mode === 'learn' ? 'name2block' : mode}:${s.block}`;
  const boxOf = (s) => boxes[boxKey(s)] || 1;
  const setBox = (s, ok, mode) => {
    const k = boxKey(s, mode);
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
  root.append(el('h1', { class: 'game-title' }, 'Rotations'), head, stage);

  const restart = () => { savePrefs(); renderHead(); ask(); };

  function renderHead() {
    const p = pool();
    const mastered = p.filter((s) => boxOf(s) >= 4).length;
    head.replaceChildren(...[
      el('div', { class: 'deck-row' },
        el('span', { class: 'deck-label' }, 'Deck'),
        el('div', { class: 'segs' }, DECKS.map((d) => el('button', {
          type: 'button', class: d.id === prefs.deck ? 'seg on' : 'seg', title: d.title,
          onclick: () => { prefs.deck = d.id; restart(); },
        }, `${d.label} (${d.id === 'major' ? STREETS.filter((s) => s.major).length : STREETS.length})`)))),
      prefs.deck === 'all' ? el('div', { class: 'chips' },
        ROTATIONS.map((r) => el('button', {
          class: prefs.rotations.includes(r.id) ? 'chip on' : 'chip', title: r.theme,
          onclick: () => {
            const on = prefs.rotations.includes(r.id);
            if (on && prefs.rotations.length === 1) return;
            prefs.rotations = on ? prefs.rotations.filter((x) => x !== r.id) : [...prefs.rotations, r.id].sort();
            restart();
          },
        }, `${r.streets[0][1]}–${r.streets[r.streets.length - 1][1]}`))) : null,
      el('div', { class: 'tabs', role: 'tablist' }, MODES.map((m) => el('button', {
        class: m.id === prefs.mode ? 'tab on' : 'tab', role: 'tab', 'aria-selected': String(m.id === prefs.mode),
        onclick: () => { prefs.mode = m.id; restart(); },
      }, m.label))),
      el('div', { class: 'progress' },
        el('div', { class: 'progress-bar' }, el('span', { style: `width:${p.length ? (100 * mastered) / p.length : 0}%` })),
        el('small', {}, `${mastered} of ${p.length} cards mastered${prefs.mode === 'learn' ? ' (Name → Block)' : ' in this mode'} · ${MODES.find((m) => m.id === prefs.mode).hint}`)),
      prefs.mode === 'study' ? null : scoreBar(store.stats('flashcards')),
    ].filter(Boolean));
  }

  /** Rule + hook + neighbors, shown on every card back and answer. */
  function memory(s, { ladder = true } = {}) {
    const i = STREETS.indexOf(s);
    const prev = STREETS[i - 1];
    const next = STREETS[i + 1];
    return el('div', { class: 'memory' },
      (() => {
        const m = mnemonic(s);
        if (!m) return null;
        // Tap the mnemonic to open its picture.
        return el('button', {
          type: 'button', class: 'hook hook-btn', 'aria-label': `Open the picture for ${s.name}: ${m.text}`,
          onclick: (e) => { e.stopPropagation(); openPoster(s); },
        },
        artURI(s.block)
          ? el('img', { class: 'hook-img', src: artURI(s.block), alt: '', width: 56, height: 56 })
          : el('span', { class: 'hook-art', 'aria-hidden': 'true' }, m.art),
        el('span', { class: 'hook-body' },
          el('span', { class: 'mem-label' }, 'Mnemonic · tap for picture'),
          m.text,
          el('span', { class: 'hook-pegs' }, m.pegs.map((p) => `${p.art} ${p.digit}`).join('  '))));
      })(),
      el('div', { class: 'rule' }, el('span', { class: 'mem-label' }, 'Letter math'), rule(s)),
      alsoNote(s) ? el('div', { class: 'also' }, el('span', { class: 'mem-label' }, 'Heads up'), alsoNote(s)) : null,
      ladder ? el('div', { class: 'ladder' },
        prev ? el('span', {}, `${prev.block} ${prev.name}`) : null,
        el('span', { class: 'here' }, `${s.block} ${s.name}${s.alias ? ` (${s.alias})` : ''}`),
        next ? el('span', {}, `${next.block} ${next.name}`) : null) : null);
  }

  function choiceButtons(options, correctIdx, onDone, onNext = ask) {
    const t0 = performance.now();
    let done = false;
    const btns = options.map((o, i) => el('button', { class: 'choice', onclick: () => answer(i) }, el('kbd', {}, i + 1), o));
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
      if (!done && n >= 1 && n <= options.length) answer(n - 1);
      else if ((e.key === 'Enter' || e.key === ' ') && done) { e.preventDefault(); onNext(); }
    });
    return el('div', { class: 'choices' }, btns);
  }

  /** Distractors: nearby streets from the same deck, so major-deck answers stay major. */
  function nearby(s, count, within = pool()) {
    const src = within.length > count ? within : STREETS;
    // Never offer a second right answer (Pierce can also be 6600).
    const p = src.filter((x) => x !== s && !conflicts(s, x)).sort((a, b) => Math.abs(a.block - s.block) - Math.abs(b.block - s.block));
    return shuffle(p.slice(0, count + 2)).slice(0, count);
  }

  function score(ok, ms, s, mode) {
    const points = ok ? 10 + Math.max(0, Math.round(5 - ms / 1000)) : 0;
    store.record('flashcards', ok ? 1 : 0, points, ms);
    setBox(s, ok, mode);
    renderHead();
    return points;
  }

  function result(ok, ms, s, extra) {
    const points = score(ok, ms, s);
    return el('div', { class: `verdict ${ok ? 'good' : 'bad'}` },
      el('b', {}, ok ? `Correct (+${points})` : `It's ${s.name} · ${s.block}`),
      extra || null,
      memory(s),
      el('button', { class: 'btn primary', onclick: ask }, 'Next card ↵'));
  }

  // ---- Learn mode ---------------------------------------------------------
  function learn() {
    const deck = [...pool()].sort((a, b) => a.block - b.block);
    const chunks = [];
    for (let i = 0; i < deck.length; i += CHUNK) chunks.push(deck.slice(i, i + CHUNK));
    const state = store.loadMine(`fc:learn:${deckKey()}`, { chunk: 0, passed: [] });
    state.chunk = Math.min(state.chunk, chunks.length - 1);
    const saveState = () => store.saveMine(`fc:learn:${deckKey()}`, state);

    const method = el('details', { class: 'panel method', open: !state.passed.length },
      el('summary', {}, 'How Learn mode works'),
      el('ol', {},
        el('li', {}, el('b', {}, 'Picture the mnemonic. '), 'The street name becomes a keyword you can see (Lowell is a low well), and the number is spelled with pegs (3 = tree, 6 = sticks). Tap the mnemonic to open its picture and hold the scene in your mind for a few seconds. Odd, vivid and moving images stick best.'),
        el('li', {}, el('b', {}, 'Use the letter math. '), 'In rotations 1 to 3, block = rotation start + letter position × 100. Rotation 4 has two names per letter.'),
        el('li', {}, el('b', {}, 'Quiz right away. '), 'After 6 cards you\'re tested on them. Pulling an answer from memory builds it far faster than re-reading.'),
        el('li', {}, el('b', {}, 'Come back tomorrow. '), 'Name → Block practice brings back the cards you miss more often (spaced repetition).')),
      prefs.deck === 'major' ? el('p', { class: 'tip' }, MAJOR_TIP) : null,
      el('p', { class: 'peg-key' }, el('b', {}, 'Number pegs: '), PEGS.map((p, i) => `${i} ${PEG_ART[i]} ${p}`).join(' · ')));

    const chunkChips = el('div', { class: 'chips chunk-chips' });
    const renderChips = () => chunkChips.replaceChildren(...chunks.map((c, i) => el('button', {
      class: `chip${i === state.chunk ? ' on' : ''}${state.passed.includes(i) ? ' done' : ''}`,
      title: `${c[0].name} – ${c[c.length - 1].name}`,
      onclick: () => { state.chunk = i; saveState(); learn(); },
    }, `${state.passed.includes(i) ? '✓ ' : ''}${c[0].name}–${c[c.length - 1].name}`)));
    renderChips();

    const body = el('div', { class: 'learn-body' });
    stage.replaceChildren(method, chunkChips, body);
    const chunk = chunks[state.chunk];
    encode(0);

    function encode(i) {
      const s = chunk[i];
      const next = () => (i + 1 < chunk.length ? encode(i + 1) : quiz());
      body.replaceChildren(
        el('div', { class: 'learn-step' }, `Set ${state.chunk + 1} of ${chunks.length} · card ${i + 1} of ${chunk.length}`),
        el('div', { class: `flashcard learn${s.major ? ' major' : ''}` },
          s.major ? el('span', { class: 'badge-major' }, 'Major street') : null,
          el('div', { class: 'face-big' }, s.name, s.alias ? el('span', { class: 'alias' }, ` (${s.alias})`) : null),
          el('div', { class: 'face-block' }, s.block),
          s.also.length ? el('div', { class: 'face-also' }, `also ${s.also.join(', ')} in places`) : null,
          memory(s, { ladder: false })),
        el('div', { class: 'row end' },
          i > 0 ? el('button', { class: 'btn', onclick: () => encode(i - 1) }, '‹ Back') : null,
          el('button', { class: 'btn primary', onclick: next }, i + 1 < chunk.length ? 'Next card ↵' : 'Quiz me on these ↵')));
      onKeys((e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); next(); }
        if (e.key === 'ArrowLeft' && i > 0) encode(i - 1);
      });
    }

    function quiz() {
      const order = shuffle(chunk);
      let right = 0;
      const ask1 = (k) => {
        if (k >= order.length) return finish();
        const s = order[k];
        const opts = shuffle([s, ...nearby(s, 3, chunk.length >= 4 ? chunk : pool())]);
        const fb = el('div');
        body.replaceChildren(
          el('div', { class: 'learn-step' }, `Quiz · ${k + 1} of ${order.length}`),
          el('div', { class: 'prompt' }, el('div', { class: 'face-big' }, s.name), el('div', { class: 'face-sub' }, 'What block is it?')),
          choiceButtons(opts.map((o) => `${o.block}`), opts.indexOf(s), (ok, ms) => {
            if (ok) right++;
            const pts = score(ok, ms, s, 'name2block');
            fb.replaceChildren(el('div', { class: `verdict ${ok ? 'good' : 'bad'}` },
              el('b', {}, ok ? `Correct (+${pts})` : `${s.name} is ${s.block}`),
              ok ? null : memory(s, { ladder: false }),
              el('button', { class: 'btn primary', onclick: () => ask1(k + 1) }, 'Next ↵')));
          }, () => ask1(k + 1)),
          fb);
      };
      const finish = () => {
        const pass = right >= order.length - 1;
        if (pass && !state.passed.includes(state.chunk)) state.passed.push(state.chunk);
        const nextChunk = chunks.findIndex((_, i) => !state.passed.includes(i));
        saveState();
        const go = () => { state.chunk = nextChunk >= 0 ? nextChunk : state.chunk; saveState(); learn(); };
        body.replaceChildren(el('div', { class: `verdict ${pass ? 'good' : 'meh'}` },
          el('b', {}, `${right} of ${order.length} correct`),
          el('p', {}, pass
            ? (nextChunk >= 0 ? 'Set learned. On to the next one.' : 'Every set in this deck is learned. Switch to Name → Block for mixed review, and come back tomorrow.')
            : 'Almost. Run through these cards once more, then retry the quiz.'),
          el('div', { class: 'row' },
            el('button', { class: 'btn', onclick: () => encode(0) }, 'Review these cards'),
            pass && nextChunk >= 0 ? el('button', { class: 'btn primary', onclick: go }, 'Next set ↵') : null,
            pass && nextChunk < 0 ? el('button', { class: 'btn primary', onclick: () => { prefs.mode = 'name2block'; restart(); } }, 'Mixed review ↵') : null,
            pass ? null : el('button', { class: 'btn primary', onclick: quiz }, 'Retry quiz ↵'))));
        onKeys((e) => {
          if (e.key !== 'Enter') return;
          if (!pass) quiz();
          else if (nextChunk >= 0) go();
          else { prefs.mode = 'name2block'; restart(); }
        });
        renderChips();
      };
      ask1(0);
    }
  }

  function ask() {
    stage.replaceChildren();
    if (prefs.mode === 'learn') { learn(); return; }
    const s = nextCard();
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
          el('div', { class: 'face-sub' }, flipped ? (front ? `${s.block} W${s.also.length ? ` (also ${s.also.join(', ')} in places)` : ''}` : s.name + (s.alias ? ` (${s.alias})` : '')) : 'tap to flip'),
          flipped ? memory(s) : null);
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

    if (prefs.mode === 'side') { streetSide(s); return; }

    // decode: "3650 W 88th Ave"
    const nextS = STREETS[STREETS.indexOf(s) + 1];
    if (!nextS) { ask(); return; }
    const span = nextS.block - s.block;
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
        el('p', {}, `${num} sits between ${s.name} (${s.block}) and ${nextS.name} (${nextS.block}).`)))),
    );
  }

  // Street side: South and East sides are even, North and West sides are odd.
  function streetSide(s) {
    const BLVD = new Set(['Federal', 'Lowell', 'Sheridan', 'Wadsworth']);
    const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    const ave = rnd(70, 149);
    const nsStreet = Math.random() < 0.5;
    let num;
    let label;
    if (nsStreet) {
      num = ave * 100 + rnd(1, 98);
      label = `${num} ${s.name} ${BLVD.has(s.name) ? 'Blvd' : 'St'}`;
    } else {
      const nextS = STREETS[STREETS.indexOf(s) + 1];
      num = s.block + rnd(1, Math.max(2, (nextS ? nextS.block - s.block : 100) - 2));
      label = `${num} W ${ordinal(ave)} Ave`;
    }
    const even = num % 2 === 0;
    const truth = nsStreet ? (even ? 'E' : 'W') : (even ? 'S' : 'N');
    const NAMES = { N: 'North', E: 'East', S: 'South', W: 'West' };
    const t0 = performance.now();
    let done = false;
    const btns = {};
    const answer = (c) => {
      if (done) return;
      done = true;
      const ok = c === truth;
      Object.entries(btns).forEach(([k, b]) => {
        b.disabled = true;
        if (k === truth) b.classList.add('right');
        else if (k === c) b.classList.add('wrong');
      });
      const ms = performance.now() - t0;
      const points = ok ? 10 + Math.max(0, Math.round(5 - ms / 1000)) : 0;
      store.record('flashcards', ok ? 1 : 0, points, ms);
      renderHead();
      const where = nsStreet
        ? `${s.name} runs north–south, so its sides are east and west. It's between ${ordinal(ave)} and ${ordinal(ave + 1)} Ave.`
        : `W ${ordinal(ave)} Ave runs east–west, so its sides are north and south. It's on the ${s.name} block (${s.block}).`;
      stage.append(el('div', { class: `verdict ${ok ? 'good' : 'bad'}` },
        el('b', {}, ok ? `Correct: ${NAMES[truth]} side (+${points})` : `It's the ${NAMES[truth]} side`),
        el('p', {}, `${num} is ${even ? 'even' : 'odd'}, and ${even ? 'even numbers are on the south and east sides' : 'odd numbers are on the north and west sides'}. ${where}`),
        el('div', { class: 'memory' }, el('div', { class: 'hook' }, el('span', { class: 'mem-label' }, 'Remember'),
          'Odd ones go up and left: North and West, like the top-left of a map. Evens settle down and right: South and East.')),
        el('button', { class: 'btn primary', onclick: ask }, 'Next ↵')));
    };
    for (const c of ['N', 'E', 'S', 'W']) btns[c] = el('button', { class: 'rose-btn', onclick: () => answer(c) }, NAMES[c]);
    stage.append(
      el('div', { class: 'prompt' },
        el('div', { class: 'face-big addr' }, label),
        el('div', { class: 'face-sub' }, 'Which side of the street is it on?')),
      el('div', { class: 'rose side-rose' },
        el('div'), btns.N, el('div'),
        btns.W, el('div', { class: 'rose-center', 'aria-hidden': 'true' }, '±'), btns.E,
        el('div'), btns.S, el('div')));
    onKeys((e) => {
      const map = { ArrowUp: 'N', ArrowRight: 'E', ArrowDown: 'S', ArrowLeft: 'W' };
      if (!done && map[e.key]) { e.preventDefault(); answer(map[e.key]); } else if ((e.key === 'Enter' || e.key === ' ') && done) { e.preventDefault(); ask(); }
    });
  }

  renderHead();
  ask();
  return {};
}
