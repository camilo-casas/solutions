// Rotation flash cards: guided Learn mode (chunked encoding + immediate
// retrieval quiz), then free practice with Leitner-box spaced repetition.

import { ROTATIONS, STREETS, bracketWest, conflicts } from '../lib/rotations.js';
import { ordinal } from '../lib/names.js';
import { rule, mnemonic, alsoNote, MAJOR_TIP, PEGS, PEG_ART } from '../lib/mnemonics.js';
import { openPoster, artURI } from '../mnemonicArt.js';
import { crosstown, SHEET_WIDTH } from '../lib/crosstown.js';
import { el, shuffle, pick, onKeys, scoreBar } from '../ui.js';
import * as store from '../store.js';

const MODES = [
  { id: 'learn', label: 'Learn', hint: 'Learn 6 streets at a time with memory hooks, then quiz on them.' },
  { id: 'study', label: 'Study', hint: 'Flip the card, then grade yourself.' },
  { id: 'name2block', label: 'Name → Block', hint: 'What hundred block is this street?' },
  { id: 'block2name', label: 'Block → Name', hint: 'Which street sits on this block?' },
  { id: 'decode', label: 'Address → Cross streets', hint: 'Which two streets is this avenue address between?' },
  { id: 'westeast', label: 'West or East', hint: 'Is the second street west or east of the first? Higher numbers are further west.' },
  { id: 'side', label: 'Street side', hint: 'Which side of the street is it on? Even = south or east, odd = north or west.' },
];
// The cross-town avenues deck has its own two modes.
const EW_MODES = [
  { id: 'learn', label: 'Learn', hint: 'Learn a few avenues at a time: where each runs unbroken and where it breaks, then quiz on them.' },
  { id: 'reach', label: 'Ends & gaps', hint: 'Where does each avenue start, stop and break? Missed avenues come back more often.' },
];
const DECKS = [
  { id: 'major', label: 'Major streets', title: 'The 18 bold anchor streets' },
  { id: 'all', label: 'All streets', title: 'Every street on the rotation sheet' },
  { id: 'ew', label: 'Cross-town avenues', title: 'East-west avenues that cross the city: where each runs unbroken and where it breaks' },
];
const CHUNK = 6;

export function flashcards(root, ctx) {
  const prefs = { mode: 'learn', deck: 'major', rotations: [1, 2, 3, 4], ...store.load('fc:prefs', {}) };
  const modes = () => (prefs.deck === 'ew' ? EW_MODES : MODES);
  if (!modes().some((m) => m.id === prefs.mode)) prefs.mode = 'learn';
  const avenues = crosstown(ctx);
  const ewBox = (a) => boxes[`ew:${a.id}`] || 1;
  const setEwBox = (a, ok) => {
    const k = `ew:${a.id}`;
    boxes[k] = ok ? Math.min(5, (boxes[k] || 1) + 1) : 1;
    store.saveMine('fc:boxes', boxes);
  };
  const savePrefs = () => store.save('fc:prefs', prefs);
  let boxes = store.loadMine('fc:boxes', {});
  let last = null;

  const pool = () => (prefs.deck === 'major'
    ? STREETS.filter((s) => s.major)
    : STREETS.filter((s) => prefs.rotations.includes(s.rotation)));
  const deckKey = () => (prefs.deck === 'major' ? 'major' : prefs.deck === 'ew' ? 'ew' : `all-${prefs.rotations.join('')}`);
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
    const ew = prefs.deck === 'ew';
    const p = ew ? avenues : pool();
    const mastered = ew ? avenues.filter((a) => ewBox(a) >= 4).length : p.filter((s) => boxOf(s) >= 4).length;
    const count = (d) => (d.id === 'major' ? STREETS.filter((s) => s.major).length : d.id === 'ew' ? avenues.length : STREETS.length);
    head.replaceChildren(...[
      el('div', { class: 'deck-row' },
        el('span', { class: 'deck-label' }, 'Deck'),
        el('div', { class: 'segs' }, DECKS.map((d) => el('button', {
          type: 'button', class: d.id === prefs.deck ? 'seg on' : 'seg', title: d.title,
          onclick: () => {
            prefs.deck = d.id;
            if (!modes().some((m) => m.id === prefs.mode)) prefs.mode = 'learn';
            restart();
          },
        }, `${d.label} (${count(d)})`)))),
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
      el('div', { class: 'tabs', role: 'tablist' }, modes().map((m) => el('button', {
        class: m.id === prefs.mode ? 'tab on' : 'tab', role: 'tab', 'aria-selected': String(m.id === prefs.mode),
        onclick: () => { prefs.mode = m.id; restart(); },
      }, m.label))),
      el('div', { class: 'progress' },
        el('div', { class: 'progress-bar' }, el('span', { style: `width:${p.length ? (100 * mastered) / p.length : 0}%` })),
        el('small', {}, `${mastered} of ${p.length} ${ew ? 'avenues' : 'cards'} mastered${ew ? '' : prefs.mode === 'learn' ? ' (Name → Block)' : ' in this mode'} · ${modes().find((m) => m.id === prefs.mode).hint}`)),
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
    if (prefs.deck === 'ew') {
      if (!avenues.length) { stage.append(el('div', { class: 'panel' }, 'The cross-town avenues need the real map data (data/city.json).')); return; }
      if (prefs.mode === 'learn') crossLearn(); else crossPractice();
      return;
    }
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
    if (prefs.mode === 'westeast') { westOrEast(s); return; }

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

  // West or East: is the second street west or east of the first?
  function westOrEast(a) {
    // A partner from the same deck: usually close by (harder), sometimes anywhere.
    const blocks = (x) => [x.block, ...x.also];
    const clear = (x) => x !== a && blocks(x).every((bx) => blocks(a).every((ba) => (bx > ba) === (x.block > a.block) && bx !== ba));
    const p = pool().filter(clear);
    const near = p.filter((x) => Math.abs(x.block - a.block) <= 500);
    const list = near.length && Math.random() < 0.6 ? near : p;
    if (!list.length) { stage.append(el('div', { class: 'panel' }, 'Pick a bigger deck to play West or East.')); return; }
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
      store.record('flashcards', ok ? 1 : 0, points, ms);
      setBox(a, ok);
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
      el('div', { class: 'prompt' },
        el('div', { class: 'face-sub' }, 'Starting on'),
        el('div', { class: 'face-mid' }, a.name, a.alias ? ` (${a.alias})` : ''),
        el('div', { class: 'face-sub' }, 'is this street west or east of it?'),
        el('div', { class: 'face-big' }, b.name, b.alias ? el('span', { class: 'alias' }, ` (${b.alias})`) : null)),
      el('div', { class: 'lr' }, btns.west, btns.east));
    onKeys((e) => {
      if (!done && (e.key === 'ArrowLeft' || e.key === 'a')) { e.preventDefault(); answer('west'); }
      else if (!done && (e.key === 'ArrowRight' || e.key === 'd')) { e.preventDefault(); answer('east'); }
      else if ((e.key === 'Enter' || e.key === ' ') && done) { e.preventDefault(); ask(); }
    });
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

  // ---- Cross-town avenues -------------------------------------------------
  // The east-west avenues that carry you across the city: where each one runs
  // unbroken, which majors it passes, and where it breaks.
  const MAJORS = STREETS.filter((s) => s.major);
  const ordinalOf = (a) => a.name.replace(/^W /, '').replace(/ (Ave|Pkwy)$/, '');

  /** The avenue as a strip, west on the left like a map: majors as ticks, the unbroken run in red, other pieces faded. */
  function runStrip(a, { compact = false } = {}) {
    const L = 40;
    const R = 930;
    const x = (w) => L + ((SHEET_WIDTH - Math.max(0, Math.min(SHEET_WIDTH, w))) / SHEET_WIDTH) * (R - L);
    const ends = new Set([a.west.short, a.east.short]);
    const parts = [];
    for (const s of MAJORS) {
      const xx = x(s.block).toFixed(1);
      const hot = ends.has(s.name) ? ' hot' : '';
      parts.push(`<line class="tick${hot}" x1="${xx}" x2="${xx}" y1="104" y2="142"/>`,
        `<text class="tick-label${hot}" transform="translate(${xx} 98) rotate(-55)">${s.name}</text>`);
    }
    for (const o of a.others) parts.push(`<rect class="piece" x="${x(o.b).toFixed(1)}" y="120" width="${(x(o.a) - x(o.b)).toFixed(1)}" height="7" rx="3.5"/>`);
    const x0 = x(a.run.b);
    const x1 = x(a.run.a);
    parts.push(`<rect class="run" x="${x0.toFixed(1)}" y="115" width="${(x1 - x0).toFixed(1)}" height="17" rx="8.5"/>`);
    // An arrow where the avenue keeps going past the sheet's edge.
    if (a.west.beyond) parts.push(`<path class="run" d="M${(x0 - 4).toFixed(1)} 112 l-18 11.5 l18 11.5 z"/>`);
    if (a.east.beyond) parts.push(`<path class="run" d="M${(x1 + 4).toFixed(1)} 112 l18 11.5 l-18 11.5 z"/>`);
    parts.push('<text class="dir" x="0" y="168">◀ WEST</text>', '<text class="dir" x="1000" y="168" text-anchor="end">EAST ▶</text>');
    return el('div', { class: `strip${compact ? ' compact' : ''}`, role: 'img', 'aria-label': `${a.name} runs unbroken from ${a.east.label} to ${a.west.label}` },
      el('div', { html: `<svg viewBox="0 0 1000 176" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>` }));
  }

  function aveFacts(a) {
    return el('div', { class: 'memory' },
      el('div', { class: 'hook' },
        el('span', { class: 'mem-label' }, 'Unbroken run'),
        el('div', {}, `${a.east.label} → ${a.west.label}`),
        el('div', { class: 'muted' }, `About ${a.miles.toFixed(1)} mi. Say it like a route: “${ordinalOf(a)}, ${a.east.short} to ${a.west.short}.”`)),
      el('div', { class: 'rule' }, el('span', { class: 'mem-label' }, 'Passes these majors'), a.crosses.length ? a.crosses.map((s) => s.name).join(' · ') : 'none between its ends'),
      a.others.length
        ? el('div', { class: 'also' }, el('span', { class: 'mem-label' }, 'Breaks'),
          `Other pieces named ${ordinalOf(a)} don't connect to the main run: ${a.others.map((o) => `${o.east.short} to ${o.west.short}`).join('; ')}. Don't plan a route through the gap.`)
        : el('div', { class: 'also' }, el('span', { class: 'mem-label' }, 'Ends'), endsNote(a)));
  }

  function endsNote(a) {
    const stops = [a.east, a.west].filter((e) => !e.beyond).map((e) => e.short);
    const goes = [a.east, a.west].filter((e) => e.beyond).map((e) => e.short);
    if (!stops.length) return `It keeps going past ${goes.join(' and ')}, off both ends of the rotation sheet.`;
    return `It stops at ${stops.join(' and ')}: past ${stops.length > 1 ? 'them' : 'it'} you need another avenue.${goes.length ? ` It keeps going past ${goes[0]}.` : ''}`;
  }

  function aveScore(ok, ms, a) {
    const points = ok ? 10 + Math.max(0, Math.round(5 - ms / 1000)) : 0;
    store.record('flashcards', ok ? 1 : 0, points, ms);
    setEwBox(a, ok);
    renderHead();
    return points;
  }

  /** End-of-run choices near the right answer, so the quiz tests the real place. */
  function endOptions(correct) {
    const all = new Map();
    for (const s of MAJORS) all.set(`${s.name} (${s.block})`, s.block);
    for (const x of avenues) for (const e of [x.west, x.east]) all.set(e.label, e.block);
    const near = [...all].filter(([l, b]) => l !== correct.label && b !== correct.block)
      .sort((p, q) => Math.abs(p[1] - correct.block) - Math.abs(q[1] - correct.block)).slice(0, 5).map(([l]) => l);
    return shuffle([correct.label, ...shuffle(near).slice(0, 3)]);
  }

  /** One question about avenue `a`: its west end, east end, which avenue, or can you go straight through. */
  function aveQuestion(a) {
    const kinds = ['west', 'east', 'which', 'through'];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    if (kind === 'west' || kind === 'east') {
      const end = a[kind];
      const options = endOptions(end);
      return {
        prompt: [el('div', { class: 'face-big' }, a.name), el('div', { class: 'face-sub' }, `Heading ${kind}, where does it stop running unbroken?`)],
        options, correct: options.indexOf(end.label), answer: end.label,
      };
    }
    if (kind === 'which') {
      const others = avenues.filter((x) => x !== a && !(x.west.label === a.west.label && x.east.label === a.east.label))
        .sort((p, q) => Math.abs(p.block - a.block) - Math.abs(q.block - a.block)).slice(0, 5);
      const options = shuffle([a.name, ...shuffle(others).slice(0, 3).map((x) => x.name)]);
      return {
        prompt: [el('div', { class: 'face-sub' }, 'Which avenue runs unbroken from'), el('div', { class: 'face-mid' }, `${a.east.label} to ${a.west.label}?`)],
        options, correct: options.indexOf(a.name), answer: a.name,
      };
    }
    // Through: two majors, both on the run (yes) or one off it (no).
    const on = MAJORS.filter((s) => s.block >= a.run.a - 50 && s.block <= a.run.b + 50);
    const off = MAJORS.filter((s) => !on.includes(s));
    const yes = on.length >= 2 && (!off.length || Math.random() < 0.5);
    let p;
    let q;
    if (yes) [p, q] = shuffle(on).slice(0, 2);
    else if (on.length && off.length) { p = pick(on); q = off.sort((m, n) => Math.abs(m.block - p.block) - Math.abs(n.block - p.block))[Math.floor(Math.random() * Math.min(3, off.length))]; }
    else return aveQuestion(a);
    const [e1, w1] = p.block < q.block ? [p, q] : [q, p];
    const options = ['Yes, straight through', 'No, it breaks or ends'];
    return {
      prompt: [el('div', { class: 'face-sub' }, `Can you stay on ${a.name} the whole way from`), el('div', { class: 'face-mid' }, `${e1.name} (${e1.block}) to ${w1.name} (${w1.block})?`)],
      options, correct: yes ? 0 : 1, answer: options[yes ? 0 : 1],
    };
  }

  function aveVerdict(ok, pts, q, a, onNext) {
    return el('div', { class: `verdict ${ok ? 'good' : 'bad'}` },
      el('b', {}, ok ? `Correct (+${pts})` : `Answer: ${q.answer}`),
      el('div', { class: 'face-mid' }, a.name),
      runStrip(a, { compact: true }),
      aveFacts(a),
      el('button', { class: 'btn primary', onclick: onNext }, 'Next ↵'));
  }

  function crossLearn() {
    const n = avenues.length;
    const sets = Math.ceil(n / 5);
    const size = Math.ceil(n / sets);
    const chunks = [];
    for (let i = 0; i < n; i += size) chunks.push(avenues.slice(i, i + size));
    const state = store.loadMine('fc:learn:ew', { chunk: 0, passed: [] });
    state.chunk = Math.min(state.chunk, chunks.length - 1);
    const saveState = () => store.saveMine('fc:learn:ew', state);

    const method = el('details', { class: 'panel method', open: !state.passed.length },
      el('summary', {}, 'How to learn the cross-town avenues'),
      el('ol', {},
        el('li', {}, el('b', {}, 'See the run. '), 'Each avenue is drawn as a strip from west (left) to east (right), ruled by the major north-south streets you already know. The red bar is the stretch you can drive without leaving the avenue. Faded pieces share its name but don\'t connect.'),
        el('li', {}, el('b', {}, 'Say it like a route. '), 'Two ends are easier to hold than a whole line: “92nd, Pecos to Zephyr.” Hang the ends on the majors and their numbers.'),
        el('li', {}, el('b', {}, 'Know the breaks. '), 'An avenue that stops or jogs is where a route goes wrong. When there\'s a gap, picture the red bar ending and the faded piece floating on its own.'),
        el('li', {}, el('b', {}, 'Quiz right away, then come back. '), 'After each set you\'re tested on ends, gaps and which avenue goes where. Ends & gaps practice brings back the avenues you miss.')));

    const chunkChips = el('div', { class: 'chips chunk-chips' });
    const renderChips = () => chunkChips.replaceChildren(...chunks.map((c, i) => el('button', {
      class: `chip${i === state.chunk ? ' on' : ''}${state.passed.includes(i) ? ' done' : ''}`,
      onclick: () => { state.chunk = i; saveState(); crossLearn(); },
    }, `${state.passed.includes(i) ? '✓ ' : ''}${ordinalOf(c[0])}–${ordinalOf(c[c.length - 1])}`)));
    renderChips();
    const body = el('div', { class: 'learn-body' });
    stage.replaceChildren(method, chunkChips, body);
    const chunk = chunks[state.chunk];
    encode(0);

    function encode(i) {
      const a = chunk[i];
      const next = () => (i + 1 < chunk.length ? encode(i + 1) : quiz());
      body.replaceChildren(
        el('div', { class: 'learn-step' }, `Set ${state.chunk + 1} of ${chunks.length} · avenue ${i + 1} of ${chunk.length}`),
        el('div', { class: 'flashcard learn ave' },
          el('span', { class: 'badge-major' }, 'Cross-town avenue'),
          el('div', { class: 'face-big' }, a.name),
          el('div', { class: 'face-block' }, `${a.block} N`),
          runStrip(a),
          aveFacts(a)),
        el('div', { class: 'row end' },
          i > 0 ? el('button', { class: 'btn', onclick: () => encode(i - 1) }, '‹ Back') : null,
          el('button', { class: 'btn primary', onclick: next }, i + 1 < chunk.length ? 'Next avenue ↵' : 'Quiz me on these ↵')));
      onKeys((e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); next(); }
        if (e.key === 'ArrowLeft' && i > 0) encode(i - 1);
      });
    }

    function quiz() {
      // Two questions per avenue: one end, plus one of the others.
      const order = shuffle(chunk.flatMap((a) => [a, a]));
      let right = 0;
      const ask1 = (k) => {
        if (k >= order.length) return finish();
        const a = order[k];
        const q = aveQuestion(a);
        const fb = el('div');
        body.replaceChildren(
          el('div', { class: 'learn-step' }, `Quiz · ${k + 1} of ${order.length}`),
          el('div', { class: 'prompt' }, ...q.prompt),
          choiceButtons(q.options, q.correct, (ok, ms) => {
            if (ok) right++;
            fb.replaceChildren(aveVerdict(ok, aveScore(ok, ms, a), q, a, () => ask1(k + 1)));
          }, () => ask1(k + 1)),
          fb);
      };
      const finish = () => {
        const pass = right >= order.length - 1;
        if (pass && !state.passed.includes(state.chunk)) state.passed.push(state.chunk);
        const nextChunk = chunks.findIndex((_, i) => !state.passed.includes(i));
        saveState();
        const go = () => { state.chunk = nextChunk >= 0 ? nextChunk : state.chunk; saveState(); crossLearn(); };
        const review = () => { prefs.mode = 'reach'; restart(); };
        body.replaceChildren(el('div', { class: `verdict ${pass ? 'good' : 'meh'}` },
          el('b', {}, `${right} of ${order.length} correct`),
          el('p', {}, pass
            ? (nextChunk >= 0 ? 'Set learned. On to the next one.' : 'Every cross-town avenue is learned. Switch to Ends & gaps for mixed review, and come back tomorrow.')
            : 'Almost. Run through these avenues once more, then retry the quiz.'),
          el('div', { class: 'row' },
            el('button', { class: 'btn', onclick: () => encode(0) }, 'Review these avenues'),
            pass && nextChunk >= 0 ? el('button', { class: 'btn primary', onclick: go }, 'Next set ↵') : null,
            pass && nextChunk < 0 ? el('button', { class: 'btn primary', onclick: review }, 'Ends & gaps ↵') : null,
            pass ? null : el('button', { class: 'btn primary', onclick: quiz }, 'Retry quiz ↵'))));
        onKeys((e) => {
          if (e.key !== 'Enter') return;
          if (!pass) quiz(); else if (nextChunk >= 0) go(); else review();
        });
        renderChips();
      };
      ask1(0);
    }
  }

  let lastAve = null;
  function crossPractice() {
    const cand = avenues.length > 1 ? avenues.filter((a) => a !== lastAve) : avenues;
    const w = cand.map((a) => 1 / ewBox(a) ** 2);
    let r = Math.random() * w.reduce((x, y) => x + y, 0);
    let a = cand[cand.length - 1];
    for (let i = 0; i < cand.length; i++) { r -= w[i]; if (r <= 0) { a = cand[i]; break; } }
    lastAve = a;
    const q = aveQuestion(a);
    stage.append(
      el('div', { class: 'prompt' }, ...q.prompt),
      choiceButtons(q.options, q.correct, (ok, ms) => stage.append(aveVerdict(ok, aveScore(ok, ms, a), q, a, ask))));
  }

  renderHead();
  ask();
  return {};
}
