// "Router": build turn-by-turn directions, then we drive them on the map.

import { el, scoreBar, stopwatch, onKeys } from '../ui.js';
import { mapPanel } from '../map.js';
import * as store from '../store.js';
import { COLORS, stationPicker, stationCard, addressAwayFrom, gridNote, directionsList, driveTime } from './common.js';

let listSeq = 0;

export function router(root, ctx) {
  const G = ctx.graph;
  const prefs = store.load('router:prefs', { showMap: false });
  const picker = stationPicker(ctx, 'router', () => ask());
  const head = el('div', { class: 'game-head' });
  const stage = el('div', { class: 'stage' });
  const { el: mapEl, map } = mapPanel(ctx);
  const mapBox = el('div', { class: 'reveal hidden' }, mapEl);
  const listId = `streets-${++listSeq}`;
  const datalist = el('datalist', { id: listId }, ctx.streetNames.map((n) => el('option', { value: n })));
  root.append(el('h1', { class: 'game-title' }, '🚒 Router'), head, stage, mapBox, datalist);

  const renderHead = () => head.replaceChildren(
    el('div', { class: 'row' }, picker.el,
      el('label', { class: 'inline' },
        el('input', { type: 'checkbox', checked: prefs.showMap, onchange: (e) => { prefs.showMap = e.target.checked; store.save('router:prefs', prefs); showPlanningMap(); } }),
        ' Show map while planning')),
    scoreBar(store.stats('router')));

  let q = null;

  function showPlanningMap() {
    if (!q) return;
    mapBox.classList.toggle('hidden', !prefs.showMap && !q.done);
    if (q.done) return;
    map.set({
      routes: [],
      markers: [
        { p: [q.s.lat, q.s.lon], color: COLORS.station, text: q.s.id, r: 9, heading: q.s.facing },
        { p: q.a.p, color: COLORS.dest, r: 7 },
      ],
    });
    map.fit([[q.s.lat, q.s.lon], q.a.p], 60);
  }

  function makeQuestion() {
    for (let tries = 0; tries < 25; tries++) {
      const s = picker.get();
      const start = ctx.stationNode(s);
      const a = addressAwayFrom(ctx, [s.lat, s.lon], 800);
      const target = ctx.addressNode(a);
      const { opts } = G.departureOptions(start, s.facing, s.street, target);
      const best = [opts.left, opts.right].filter((o) => o && isFinite(o.cost)).sort((x, y) => x.cost - y.cost)[0];
      if (best) return { s, a, start, target, best, attempts: 0, done: false };
    }
    return null;
  }

  function stepRow(step = { turn: 'right', street: '' }) {
    const turn = el('select', { 'aria-label': 'Turn' },
      el('option', { value: 'left' }, 'Left'), el('option', { value: 'right' }, 'Right'), el('option', { value: 'straight' }, 'Straight'));
    turn.value = step.turn;
    const street = el('input', { type: 'text', list: listId, placeholder: 'Street, e.g. Sheridan Blvd', value: step.street, 'aria-label': 'Street', autocomplete: 'off' });
    const row = el('li', { class: 'step-row' }, turn, el('span', { class: 'onto' }, 'onto'), street,
      el('button', { type: 'button', class: 'icon-btn', title: 'Remove step', 'aria-label': 'Remove step', onclick: () => row.remove() }, '✕'));
    row.read = () => ({ turn: turn.value, street: street.value.trim() });
    return row;
  }

  function ask() {
    renderHead();
    stage.replaceChildren();
    q = makeQuestion();
    if (!q) {
      stage.append(el('div', { class: 'panel error' }, 'Could not build a question: check the station locations in Station setup.'));
      return;
    }
    const timer = el('span', { class: 'timer' }, '0.0s');
    q.watch = stopwatch(timer);
    let exit = 'left';
    const exitBtns = ['left', 'right'].map((side) => el('button', {
      type: 'button', class: side === exit ? 'seg on' : 'seg',
      onclick: () => { exit = side; exitBtns.forEach((b) => b.classList.toggle('on', b.dataset.side === exit)); },
      'data-side': side,
    }, side === 'left' ? '◀ Left' : 'Right ▶'));
    const steps = el('ol', { class: 'steps' }, stepRow());
    const hint = el('span', { class: 'muted' });
    const out = el('div', { class: 'result' });
    const form = el('form', {
      class: 'builder',
      onsubmit: (e) => {
        e.preventDefault();
        drive({ exit, steps: [...steps.children].map((r) => r.read()).filter((r) => r.street) }, out);
      },
    },
    el('div', { class: 'exit-row' }, el('span', {}, `Out of the bay onto ${q.s.street}:`), el('div', { class: 'segs' }, exitBtns)),
    steps,
    el('div', { class: 'row' },
      el('button', { type: 'button', class: 'btn', onclick: () => { const r = stepRow(); steps.append(r); r.querySelector('input').focus(); } }, '+ Add turn'),
      el('button', { type: 'submit', class: 'btn primary' }, 'Drive it')));
    stage.append(
      el('div', { class: 'prompt' },
        stationCard(q.s),
        el('div', { class: 'face-sub' }, 'Responding to'),
        el('div', { class: 'face-big addr' }, ctx.addressLabel(q.a)),
        el('div', {}, el('button', { type: 'button', class: 'link', onclick: (e) => { hint.textContent = ` ${gridNote(ctx, q.a.p)}`; e.target.remove(); } }, 'Decode hint'), hint),
        timer),
      form, out);
    showPlanningMap();
    onKeys((e) => { if (e.key === 'Enter' && q.done) ask(); });
  }

  function drive(answer, out) {
    if (!answer.steps.length) {
      out.replaceChildren(el('div', { class: 'verdict bad' }, 'Add at least one turn: the street you take after leaving the station street, then each turn after that.'));
      return;
    }
    q.attempts += 1;
    const ms = q.watch.stop();
    const sim = G.simulate({
      start: q.start, facing: q.s.facing, exitTurn: answer.exit, stationStreet: q.s.street, steps: answer.steps, target: q.target,
    });
    const bestCost = q.best.cost;
    const userCost = G.pathCost(sim.path);
    const eff = sim.ok ? Math.min(1, bestCost / Math.max(userCost, 1)) : 0;
    const credit = sim.ok ? (eff >= 0.9 ? 1 : eff >= 0.75 ? 0.5 : 0.25) : 0;
    const points = sim.ok ? Math.round(30 * eff) + (q.attempts === 1 ? 5 : 0) : 0;
    if (q.attempts === 1) store.record('router', credit, points, ms);
    renderHead();
    const steps = G.directions(q.best.path, q.s.facing);
    out.replaceChildren(el('div', { class: `verdict ${credit === 1 ? 'good' : sim.ok ? 'meh' : 'bad'}` },
      el('b', {}, sim.ok
        ? `Arrived! Your route ${driveTime(userCost)} vs best ${driveTime(bestCost)}: ${Math.round(eff * 100)}% efficient${q.attempts === 1 ? ` (+${points})` : ''}`
        : `Didn't make it${sim.failedStep === 0 ? ' out of the station' : ` (step ${sim.failedStep})`}`),
      sim.reason ? el('p', {}, sim.reason) : null,
      el('details', { open: !sim.ok || credit < 1 }, el('summary', {}, 'Suggested route'), directionsList(steps, ctx.addressLabel(q.a))),
      el('div', { class: 'row' },
        el('button', { class: 'btn', onclick: () => { q.watch = stopwatch(el('span')); out.replaceChildren(); mapBox.classList.toggle('hidden', !prefs.showMap); q.done = false; showPlanningMap(); } }, 'Edit & retry'),
        el('button', { class: 'btn primary', onclick: ask }, 'Next call ↵'))));
    q.done = true;
    mapBox.classList.remove('hidden');
    const bestPts = G.pathPoints(q.best.path);
    const userPts = G.pathPoints(sim.path);
    map.set({
      routes: [
        { pts: bestPts, color: COLORS.best, width: 6, alpha: 0.55 },
        { pts: userPts, color: COLORS.user, width: 4 },
      ],
      markers: [
        { p: [q.s.lat, q.s.lon], color: COLORS.station, text: q.s.id, r: 9, heading: q.s.facing, label: q.s.name },
        { p: q.a.p, color: COLORS.dest, r: 7, label: ctx.addressLabel(q.a) },
      ],
    });
    map.fit([...bestPts, ...userPts, q.a.p]);
  }

  ask();
  return { destroy: () => map.destroy() };
}
