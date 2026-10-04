// Responder and Transporter: drive the real street grid one block at a time.
//   ↑  drive forward to the next intersection
//   ↓  back up one block (heading unchanged)
//   ← → turn onto the cross street at this intersection (then ↑ to drive it)
// Responder starts in a station bay; Transporter starts at a scene address and
// ends at a hospital.

import { distance, bearing, angleDiff, toCardinal, CARDINAL_NAMES } from '../lib/geo.js';
import { shortName, nameKey } from '../lib/names.js';
import { el, pick, onKeys, scoreBar, fmtTime } from '../ui.js';
import { mapPanel } from '../map.js';
import { Windshield } from '../windshield.js';
import * as store from '../store.js';
import { COLORS, stationPicker, stationCard, addressAwayFrom, gridNote, directionsList, driveTime } from './common.js';

const LOOK = 40; // degrees counted as "straight ahead"
const SPEED = 13; // m/s, for backing-up cost

export function responder(root, ctx) { return drive(root, ctx, 'responder'); }
export function transporter(root, ctx) { return drive(root, ctx, 'transporter'); }

function drive(root, ctx, mode) {
  const G = ctx.graph;
  const isT = mode === 'transporter';
  const title = isT ? 'Transporter' : 'Responder';
  const prefs = { showMap: false, hints: false, off: [], ...store.load(`${mode}:prefs`, {}) };

  // Hospitals the street data reaches (others are outside the downloaded map).
  // A hospital counts only if its street connects to Westminster's road network.
  const hub = ctx.stationNode(ctx.stations[0]);
  const hospitals = ctx.landmarks.filter((h) => h.type === 'hospital').map((h) => {
    const n = G.snap([h.lat, h.lon]);
    const near = n >= 0 && distance([h.lat, h.lon], G.pt(n)) < 400;
    return { ...h, p: [h.lat, h.lon], node: n, reach: near && isFinite(G.costsTo(n).dist[hub]) };
  });
  const reachable = hospitals.filter((h) => h.reach);

  const picker = isT ? null : stationPicker(ctx, mode, () => start());
  // Transporter: each hospital can be switched on or off; calls go to a random one that's on.
  const enabledHospitals = () => reachable.filter((h) => !prefs.off.includes(h.name));
  let hospOpen = false;
  const hospToggles = () => el('details', { class: 'hosp-toggles', open: hospOpen, ontoggle: (e) => { hospOpen = e.target.open; } },
    el('summary', {}, el('span', { class: 'deck-label' }, 'Hospitals'), ` ${enabledHospitals().length} of ${reachable.length} on`),
    el('div', { class: 'chips' }, reachable.map((h) => {
      const on = !prefs.off.includes(h.name);
      return el('button', {
        type: 'button', class: on ? 'chip on' : 'chip', 'aria-pressed': String(on), title: h.city,
        onclick: () => {
          if (on && enabledHospitals().length === 1) return; // keep at least one
          prefs.off = on ? [...prefs.off, h.name] : prefs.off.filter((n) => n !== h.name);
          store.save(`${mode}:prefs`, prefs);
          start();
        },
      }, `${on ? '✓ ' : ''}${h.name}`);
    })),
    el('small', { class: 'muted' }, 'Tap a hospital to switch it on or off. Calls go to a random hospital that\'s on.'));
  const ws = new Windshield(ctx, { vehicle: isT ? 'ambulance' : 'engine' });
  let seen = null; // what the windshield last showed: { trail, heading, pending }
  const head = el('div', { class: 'game-head' });
  const stage = el('div', { class: 'stage' });
  const { el: mapEl, map } = mapPanel(ctx);
  const mapBox = el('div', { class: 'reveal hidden' }, mapEl);
  root.append(el('h1', { class: 'game-title' }, title), head, stage, mapBox);

  const toggle = (key, label) => el('label', { class: 'inline' },
    el('input', { type: 'checkbox', checked: prefs[key], onchange: (e) => { prefs[key] = e.target.checked; store.save(`${mode}:prefs`, prefs); render(); } }),
    ` ${label}`);
  const renderHead = () => head.replaceChildren(...[
    el('div', { class: 'row' }, isT ? null : picker.el, toggle('showMap', 'Show map'), toggle('hints', 'Hints')),
    isT ? hospToggles() : null,
    isT && hospitals.length > reachable.length
      ? el('small', { class: 'muted' }, `Not drivable yet (no connected streets in the map data): ${hospitals.filter((h) => !h.reach).map((h) => h.name).join(', ')}.`)
      : null,
    scoreBar(store.stats(mode)),
  ].filter(Boolean));

  // ---- Game state ---------------------------------------------------------
  let g = null;
  let quiet = false; // true while the test hook previews moves

  /** Named-road neighbors of a node, for "is this an intersection?" */
  function namedDegree(n) {
    const seen = new Set();
    for (const e of G.out[n]) if (G.edges[e].name) seen.add(G.edges[e].to);
    for (const e of G.inc[n]) if (G.edges[e].name) seen.add(G.edges[e].from);
    return seen.size;
  }
  /** Distinct neighboring nodes over any road segment, named or not. */
  function degree(n) {
    const seen = new Set();
    for (const e of G.out[n]) seen.add(G.edges[e].to);
    for (const e of G.inc[n]) seen.add(G.edges[e].from);
    return seen.size;
  }
  // A "block" ends wherever three or more segments meet: an intersection, a side
  // street joined by an unnamed connector, or a freeway exit or entrance.
  const isStop = (n) => n === g.target || n === g.start || degree(n) >= 3 || namedDegree(n) <= 1;

  /** Road segments leaving n: forward edges, plus reversed incoming edges when backing up. */
  function segmentsFrom(n, reverse) {
    const segs = G.out[n].map((id) => ({ id, from: n, to: G.edges[id].to, way: G.edges[id].way, name: G.edges[id].name, len: G.edges[id].len, cost: G.edges[id].cost }));
    if (reverse) {
      for (const id of G.inc[n]) {
        const e = G.edges[id];
        if (!segs.some((s) => s.to === e.from)) segs.push({ id, from: n, to: e.from, way: e.way, name: e.name, len: e.len, cost: e.len / SPEED });
      }
    }
    return segs.map((s) => ({ ...s, brg: bearing(G.pt(s.from), G.pt(s.to)) }));
  }

  const aheadScore = (x) => Math.abs(angleDiff(g.heading, x.brg)) - (nameKey(x.name) === nameKey(g.street) ? 10 : 0) + (!x.name ? 40 : 0);

  /** Walk from `first` (a segment) to the next intersection. Returns the segments walked. */
  function walkBlock(first, reverse) {
    const segs = [first];
    let cur = first;
    let guard = 0;
    while (!isStop(cur.to) && guard++ < 2000) {
      const opts = segmentsFrom(cur.to, reverse).filter((s) => s.to !== cur.from);
      if (!opts.length) break;
      // Straightest wins, but stay on the same road: a ramp peeling off at a shallow angle is not "ahead".
      const score = (x) => Math.abs(angleDiff(cur.brg, x.brg)) - (x.way === cur.way ? 10 : 0) + (cur.name && !x.name ? 40 : 0)
        - (cur.name && nameKey(x.name) === nameKey(cur.name) ? 10 : 0);
      opts.sort((a, b) => score(a) - score(b));
      if (Math.abs(angleDiff(cur.brg, opts[0].brg)) > 100) break;
      cur = opts[0];
      segs.push(cur);
    }
    return segs;
  }

  /** Turn options at a node: named roads reachable directly or through short slip lanes. */
  function turnOptions(n) {
    return G.exits(n, -1).map(({ via, edge }) => ({ via, edge, brg: G.headingOut(edge), name: shortName(G.edges[edge].name) }));
  }

  function pickTurn(n, side) {
    let best = null;
    for (const o of turnOptions(n)) {
      const rel = angleDiff(g.heading, o.brg);
      // Through a ramp or slip lane, the side is the way the ramp peels off, even
      // when the road it reaches runs parallel (a freeway beside a frontage road).
      const peel = o.via.length ? angleDiff(g.heading, bearing(G.pt(G.edges[o.via[0]].from), G.pt(G.edges[o.via[0]].to))) : rel;
      let ok;
      if (o.via.length && Math.abs(rel) <= 30) ok = side === 'left' ? peel < -5 : peel > 5;
      // Sharp turns up to a U-turn count, but a real side street always wins.
      else ok = side === 'left' ? rel < -30 || rel > 175 : rel > 30;
      if (!ok) continue;
      const score = Math.abs(Math.abs(rel) - 90) + (Math.abs(rel) > 150 ? 200 : 0);
      if (!best || score < best.score) best = { ...o, score };
    }
    return best;
  }

  /** What each arrow does from here (for button labels). */
  function preview() {
    const n = g.node;
    const ahead = g.pending
      ? { name: g.pending.name }
      : (() => {
        const s = segmentsFrom(n, false).filter((x) => Math.abs(angleDiff(g.heading, x.brg)) <= LOOK)
          .sort((a, b) => aheadScore(a) - aheadScore(b))[0];
        return s ? { name: shortName(s.name) || 'unnamed road' } : null;
      })();
    const back = segmentsFrom(n, true).some((x) => Math.abs(angleDiff(g.heading + 180, x.brg)) <= LOOK);
    return { ahead, left: pickTurn(n, 'left') || nearTurn('left'), right: pickTurn(n, 'right') || nearTurn('right'), back };
  }

  // Divided roads: the turn may be one short hop ahead, across the median.
  function nearTurn(side) {
    const s = segmentsFrom(g.node, false).filter((x) => Math.abs(angleDiff(g.heading, x.brg)) <= LOOK)[0];
    if (!s || s.len > 45) return null;
    const saved = { node: g.node };
    g.node = s.to;
    const t = pickTurn(s.to, side);
    g.node = saved.node;
    return t ? { ...t, hop: s } : null;
  }

  function addSegs(segs) {
    for (const s of segs) {
      g.trail.push(G.pt(s.to));
      g.cost += s.cost;
      g.dist += s.len;
      if (s.to === g.target) return true;
    }
    return false;
  }

  function streetsAt(n) {
    const names = new Set();
    for (const e of [...G.out[n], ...G.inc[n]]) if (G.edges[e].name) names.add(shortName(G.edges[e].name));
    return [...names];
  }

  // ---- Moves --------------------------------------------------------------
  function forward() {
    if (g.done) return;
    let first;
    let via = [];
    if (g.pending) {
      via = g.pending.via.map((id) => ({ id, from: G.edges[id].from, to: G.edges[id].to, way: G.edges[id].way, name: '', len: G.edges[id].len, cost: G.edges[id].cost }));
      const e = G.edges[g.pending.edge];
      first = { id: e.id, from: e.from, to: e.to, way: e.way, name: e.name, len: e.len, cost: e.cost, brg: bearing(G.pt(e.from), G.pt(e.to)) };
    } else {
      first = segmentsFrom(g.node, false).filter((s) => Math.abs(angleDiff(g.heading, s.brg)) <= LOOK)
        .sort((a, b) => aheadScore(a) - aheadScore(b))[0];
      if (!first) return flash(g.node === g.start && !g.moves ? `You're in the bay. Turn left or right onto ${g.startStreet}.` : 'No road straight ahead. Turn left or right.');
    }
    if (addSegs(via)) return arrive();
    const segs = walkBlock(first, false);
    g.lastMove = 'forward';
    g.moves++;
    g.pending = null;
    const last = segs[segs.length - 1];
    g.prev = last.from;
    g.node = last.to;
    g.street = shortName(last.name) || g.street;
    g.heading = G.headingIn(last.id);
    if (addSegs(segs)) return arrive();
    render();
  }

  function backward() {
    if (g.done) return;
    const first = segmentsFrom(g.node, true).filter((s) => Math.abs(angleDiff(g.heading + 180, s.brg)) <= LOOK)
      .sort((a, b) => Math.abs(angleDiff(g.heading + 180, a.brg)) - Math.abs(angleDiff(g.heading + 180, b.brg)))[0];
    if (!first) return flash('No room to back up here.');
    const segs = walkBlock(first, true);
    g.lastMove = 'back';
    g.moves++;
    g.pending = null;
    const last = segs[segs.length - 1];
    g.prev = last.from;
    g.node = last.to;
    g.street = shortName(last.name) || g.street;
    if (addSegs(segs)) return arrive();
    render();
  }

  function turn(side) {
    if (g.done) return;
    const t = pickTurn(g.node, side) || nearTurn(side);
    if (!t) return flash(`No street to the ${side} here.`);
    g.lastMove = 'forward';
    if (t.hop) {
      g.node = t.hop.to;
      if (addSegs([t.hop])) return arrive();
    }
    g.moves++;
    g.pending = t;
    g.heading = t.brg;
    g.street = t.name;
    render();
  }

  // ---- Setup ----------------------------------------------------------------
  function start() {
    renderHead();
    mapBox.classList.add('hidden');
    stage.replaceChildren();
    for (let tries = 0; tries < 20; tries++) {
      if (isT) {
        const h = pick(enabledHospitals().length ? enabledHospitals() : reachable);
        if (!h) { stage.append(el('div', { class: 'panel error' }, 'No hospital in data/landmarks.json is inside the map area.')); return; }
        const a = addressAwayFrom(ctx, h.p, 1500);
        const s = ctx.addressNode(a);
        const target = h.node;
        const outs = G.out[s];
        if (!outs.length) continue;
        const e0 = pick(outs);
        const tree = G.costsTo(target);
        if (!isFinite(tree.dist[s])) continue;
        g = {
          node: s, start: s, target, heading: G.headingOut(e0), street: shortName(G.edges[e0].name), startStreet: shortName(G.edges[e0].name),
          from: a, to: h, best: { cost: tree.dist[s], path: G.pathFrom(s, tree) }, startFacing: null,
        };
      } else {
        const st = picker.get();
        const s = ctx.stationNode(st);
        const a = addressAwayFrom(ctx, [st.lat, st.lon], 800);
        const target = ctx.addressNode(a);
        const { opts } = G.departureOptions(s, st.facing, st.street, target);
        const best = [opts.left, opts.right].filter((o) => o && isFinite(o.cost)).sort((x, y) => x.cost - y.cost)[0];
        if (!best) continue;
        g = { node: s, start: s, target, heading: st.facing, street: st.street, startStreet: st.street, station: st, to: a, best, startFacing: st.facing };
      }
      Object.assign(g, { prev: -1, pending: null, trail: [G.pt(g.node)], cost: 0, dist: 0, moves: 0, done: false, t0: performance.now(), msg: '', lastMove: 'forward' });
      ws.reset({ node: g.node, heading: g.heading, street: g.street, target: g.to.p, targetLabel: isT ? g.to.name : ctx.addressLabel(g.to) });
      seen = { trail: 1, heading: g.heading, pending: null };
      render();
      onKeys((e) => {
        const k = e.key;
        if (g.done) { if (k === 'Enter') start(); return; }
        if (k === 'ArrowUp' || k === 'w') { e.preventDefault(); forward(); }
        else if (k === 'ArrowDown' || k === 's') { e.preventDefault(); backward(); }
        else if (k === 'ArrowLeft' || k === 'a') { e.preventDefault(); turn('left'); }
        else if (k === 'ArrowRight' || k === 'd') { e.preventDefault(); turn('right'); }
      });
      return;
    }
    stage.append(el('div', { class: 'panel error' }, 'Could not build a call. Try again or check Station setup.'));
  }

  // ---- Rendering ------------------------------------------------------------
  let msgTimer = 0;
  function flash(text) {
    if (quiet) return;
    g.msg = text;
    render();
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => { if (g) { g.msg = ''; render(); } }, 2200);
  }

  /** Animate the windshield from what it last showed to the current state. */
  function syncView() {
    if (!seen) return;
    if (g.trail.length > seen.trail) {
      ws.go({ kind: g.lastMove, pts: g.trail.slice(seen.trail - 1), heading: g.heading, street: g.street, turning: !!g.pending, dist: g.dist });
    } else if (Math.abs(angleDiff(seen.heading, g.heading)) > 0.5 || seen.pending !== g.pending) {
      ws.go({ kind: 'turn', heading: g.heading, street: g.street, turning: !!g.pending, dist: g.dist });
    }
    seen = { trail: g.trail.length, heading: g.heading, pending: g.pending };
  }

  function render() {
    if (!g || quiet) return;
    syncView();
    stage.replaceChildren();
    const p = g.done ? null : preview();
    const cross = streetsAt(g.node).filter((n) => nameKey(n) !== nameKey(g.street));
    const elapsed = (performance.now() - g.t0) / 1000;
    const pad = (dir, arrow, label, sub, enabled, fn) => el('button', {
      class: `pad pad-${dir}`, disabled: !enabled, onclick: fn, 'aria-label': `${dir}: ${label}${sub ? `, ${sub}` : ''}`,
    }, el('span', { class: 'pad-arrow' }, arrow), el('span', { class: 'pad-label' }, label), sub ? el('span', { class: 'pad-sub' }, sub) : null);

    stage.append(...[
      el('div', { class: 'prompt drive-prompt' },
        isT
          ? el('div', { class: 'patient' }, el('span', { class: 'face-sub' }, 'Patient loaded at'), el('div', { class: 'patient-addr' }, ctx.addressLabel(g.from)))
          : stationCard(g.station),
        el('div', { class: 'face-sub' }, isT ? 'Transport to' : 'Responding to'),
        el('div', { class: 'face-big addr' }, isT ? g.to.name : ctx.addressLabel(g.to)),
        isT ? el('small', { class: 'muted' }, g.to.city) : null,
        prefs.hints ? el('small', { class: 'hint' }, `Destination: ${gridNote(ctx, g.to.p)}. It's ${CARDINAL_NAMES[toCardinal(bearing(G.pt(g.node), g.to.p))]} of you, ${(distance(G.pt(g.node), g.to.p) / 1609.344).toFixed(1)} mi straight-line.`) : null),
      ws.el,
      el('div', { class: 'trip-line' }, `${g.moves} moves · ${fmtTime(elapsed)}`, cross.length ? ` · At ${cross.slice(0, 2).join(' & ')}` : ''),
      g.done ? null : el('div', { class: 'dpad' },
        pad('up', '▲', 'Forward', p.ahead ? p.ahead.name : 'no road', !!p.ahead, forward),
        pad('left', '◀', 'Left', p.left ? p.left.name : '—', !!p.left, () => turn('left')),
        pad('right', '▶', 'Right', p.right ? p.right.name : '—', !!p.right, () => turn('right')),
        pad('down', '▼', 'Back up', p.back ? 'one block' : '—', p.back, backward)),
      g.msg ? el('div', { class: 'drive-msg', role: 'status' }, g.msg) : null,
      g.done ? null : el('div', { class: 'row end' },
        el('small', { class: 'muted' }, 'Keys: ↑ forward · ↓ back · ← → turn'),
        el('button', { class: 'btn', onclick: giveUp }, 'Show me the route')),
      g.result || null,
    ].filter(Boolean));
    const showMap = prefs.showMap || g.done;
    mapBox.classList.toggle('hidden', !showMap);
    if (showMap) drawMap();
  }

  function drawMap() {
    const markers = [
      isT ? { p: G.pt(g.start), color: COLORS.dest, r: 7, label: ctx.addressLabel(g.from) } : { p: [g.station.lat, g.station.lon], color: COLORS.station, text: g.station.id, r: 9, label: g.station.name },
      { p: g.done || prefs.hints ? (g.to.p) : null, color: isT ? COLORS.poi : COLORS.dest, r: 8, shape: isT ? 'square' : null, label: g.done || prefs.hints ? (isT ? g.to.name : ctx.addressLabel(g.to)) : '' },
      { p: G.pt(g.node), color: COLORS.user, r: 8, heading: g.heading },
    ].filter((m) => m.p);
    const routes = [{ pts: g.trail, color: COLORS.user, width: 4 }];
    if (g.done) routes.unshift({ pts: G.pathPoints(g.best.path), color: COLORS.best, width: 6, alpha: 0.5 });
    map.set({ routes, markers });
    if (g.done) map.fit([...g.trail, ...G.pathPoints(g.best.path)]);
    else if (!g.fitted) { map.fit([G.pt(g.node), g.to.p], 60); g.fitted = true; }
  }

  function finish(arrived) {
    g.done = true;
    if (quiet) return;
    clearTimeout(msgTimer);
    g.msg = '';
    const ms = performance.now() - g.t0;
    const eff = arrived ? Math.min(1, g.best.cost / Math.max(g.cost, 1)) : 0;
    const credit = arrived ? (eff >= 0.9 ? 1 : eff >= 0.75 ? 0.5 : 0.25) : 0;
    const points = arrived ? Math.round(30 * eff) + 5 : 0;
    store.record(mode, credit, points, ms);
    renderHead();
    const steps = G.directions(g.best.path, g.startFacing);
    const dest = isT ? g.to.name : ctx.addressLabel(g.to);
    g.result = el('div', { class: `verdict ${credit === 1 ? 'good' : arrived ? 'meh' : 'bad'}` },
      el('b', {}, arrived
        ? `${isT ? 'At the hospital' : 'On scene'}! Your drive ${driveTime(g.cost)} vs best ${driveTime(g.best.cost)}: ${Math.round(eff * 100)}% efficient (+${points})`
        : 'Here\'s the fastest route'),
      el('details', { open: !arrived || credit < 1 }, el('summary', {}, 'Suggested route'),
        isT ? el('ol', { class: 'directions' }, steps.map((st, i) => el('li', {},
          el('span', { class: `turn ${st.turn || ''}` }, i === 0 ? 'Head out' : st.turn === 'left' ? 'Turn left' : st.turn === 'right' ? 'Turn right' : st.turn === 'u-turn' ? 'Make a U-turn' : 'Continue'),
          ' onto ', el('b', {}, st.name), el('small', {}, ` · ${(st.dist / 1609.344).toFixed(2)} mi`))),
        el('li', {}, el('span', { class: 'turn arrive' }, 'Arrive'), ' at ', el('b', {}, dest)))
          : directionsList(steps, dest)),
      el('button', { class: 'btn primary', onclick: start }, 'Next call ↵'));
    render();
  }
  const arrive = () => finish(true);
  const giveUp = () => finish(false);

  // Test hook: automated tests set window.WFD_DEBUG to read the game state and
  // preview where a sequence of moves would leave the truck, without making them.
  if (window.WFD_DEBUG) {
    const acts = { up: () => forward(), down: () => backward(), left: () => turn('left'), right: () => turn('right') };
    window.WFD_DEBUG.drive = {
      state: () => g,
      graph: G,
      peek(seq) {
        const saved = { ...g, trail: g.trail.slice() };
        quiet = true;
        try {
          for (const a of seq) { if (!g.done) acts[a](); }
          return { node: g.node, done: g.done, heading: g.heading, moved: g.node !== saved.node || !!g.pending !== !!saved.pending || Math.abs(angleDiff(g.heading, saved.heading)) > 1 };
        } finally {
          g = saved;
          quiet = false;
        }
      },
    };
  }

  start();
  return { destroy: () => { clearTimeout(msgTimer); map.destroy(); ws.destroy(); } };
}
