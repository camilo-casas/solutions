// "Cardinal": from an address, which way is the point of interest?

import { bearing, distance, toCardinal, CARDINALS, CARDINAL_NAMES } from '../lib/geo.js';
import { el, onKeys, scoreBar, stopwatch, miles } from '../ui.js';
import { mapPanel } from '../map.js';
import * as store from '../store.js';
import { COLORS, gridNote } from './common.js';

const KINDS = [
  { id: 'key', label: 'Hospitals + stations' },
  { id: 'hospital', label: 'Hospitals' },
  { id: 'station', label: 'WFD stations' },
  { id: 'all', label: 'Everything on the map' },
];
const TYPE_LABEL = {
  station: 'WFD station', hospital: 'Hospital', fire_station: 'Fire station', police: 'Police', townhall: 'City building',
  library: 'Library', college: 'College', mall: 'Shopping', transit: 'Transit station', lake: 'Lake',
  stadium: 'Stadium', golf_course: 'Golf course', attraction: 'Attraction', museum: 'Museum', zoo: 'Zoo',
};
// Compass rose button order (3 x 3 grid, center is the address).
const ROSE = ['NW', 'N', 'NE', 'W', null, 'E', 'SW', 'S', 'SE'];
const KEYS = { 7: 'NW', 8: 'N', 9: 'NE', 4: 'W', 6: 'E', 1: 'SW', 2: 'S', 3: 'SE', q: 'NW', w: 'N', e: 'NE', a: 'W', d: 'E', z: 'SW', x: 'S', c: 'SE' };

export function cardinal(root, ctx) {
  const prefs = store.load('cardinal:prefs', { kind: 'key' });
  if (!KINDS.some((k) => k.id === prefs.kind)) prefs.kind = 'key';
  // The hospitals crews actually transport to (data/landmarks.json), the WFD
  // stations, then everything else the map data knows about.
  const key = [
    ...ctx.landmarks.map((l) => ({ name: l.name, city: l.city, type: l.type, p: [l.lat, l.lon], w: 2, key: true })),
    ...ctx.stations.map((s) => ({ name: `WFD ${s.name}`, city: s.address, type: 'station', p: [s.lat, s.lon], w: 1.5, key: true })),
  ];
  const extra = ctx.city.pois
    // WFD's own stations come from stations.json, not the map data.
    .filter(([name, type]) => !(type === 'fire_station' && /westminster/i.test(name)))
    .map(([name, type, lat, lon]) => ({ name, type, p: [lat, lon], w: 1 }))
    .filter((x) => !key.some((k) => distance(k.p, x.p) < 300));
  const ofKind = () => {
    if (prefs.kind === 'hospital') return key.filter((p) => p.type === 'hospital');
    if (prefs.kind === 'station') return key.filter((p) => p.type === 'station');
    if (prefs.kind === 'all') return [...key, ...extra];
    return key;
  };

  const head = el('div', { class: 'game-head' });
  const stage = el('div', { class: 'stage' });
  const { el: mapEl, map } = mapPanel(ctx, { labels: false });
  const mapBox = el('div', { class: 'reveal hidden' }, mapEl);
  root.append(el('h1', { class: 'game-title' }, 'Cardinal'), head, stage, mapBox);

  const renderHead = () => head.replaceChildren(
    el('div', { class: 'chips' }, KINDS.map((k) => el('button', {
      class: prefs.kind === k.id ? 'chip on' : 'chip',
      onclick: () => { prefs.kind = k.id; store.save('cardinal:prefs', prefs); ask(); },
    }, k.label))),
    scoreBar(store.stats('cardinal')));

  function weighted(list) {
    let r = Math.random() * list.reduce((s, p) => s + p.w, 0);
    for (const p of list) { r -= p.w; if (r <= 0) return p; }
    return list[list.length - 1];
  }

  function ask() {
    renderHead();
    mapBox.classList.add('hidden');
    stage.replaceChildren();
    const list = ofKind();
    if (!list.length) { stage.append(el('div', { class: 'panel' }, 'No places of that kind in the map data.')); return; }
    let a; let poi;
    for (let i = 0; i < 40; i++) {
      a = ctx.randomAddress();
      poi = weighted(list);
      if (distance(a.p, poi.p) > 600) break;
    }
    const truth = toCardinal(bearing(a.p, poi.p));
    const timer = el('span', { class: 'timer' }, '0.0s');
    const watch = stopwatch(timer);
    let done = false;
    const btns = {};
    const answer = (c) => {
      if (done) return;
      done = true;
      const ms = watch.stop();
      const diff = Math.abs(CARDINALS.indexOf(c) - CARDINALS.indexOf(truth));
      const off = Math.min(diff, 8 - diff);
      const credit = off === 0 ? 1 : off === 1 ? 0.5 : 0;
      const points = credit === 1 ? 10 + Math.max(0, Math.round(8 - ms / 1000)) : credit ? 4 : 0;
      store.record('cardinal', credit, points, ms);
      Object.entries(btns).forEach(([k, b]) => {
        b.disabled = true;
        if (k === truth) b.classList.add('right');
        else if (k === c) b.classList.add(credit ? 'close' : 'wrong');
      });
      renderHead();
      const brg = Math.round(bearing(a.p, poi.p));
      stage.append(el('div', { class: `verdict ${credit === 1 ? 'good' : credit ? 'meh' : 'bad'}` },
        el('b', {}, credit === 1 ? `Correct: ${truth} (+${points})` : credit ? `Close: it's ${truth} (+${points})` : `It's ${truth}`),
        el('p', {}, `${poi.name} is ${CARDINAL_NAMES[truth]} of the address: bearing ${brg}°, ${miles(distance(a.p, poi.p))} straight-line.`),
        el('p', { class: 'muted' }, `Address: ${gridNote(ctx, a.p)}.`, el('br'), `${poi.name}: ${gridNote(ctx, poi.p)}.`),
        el('button', { class: 'btn primary', onclick: ask }, 'Next ↵')));
      mapBox.classList.remove('hidden');
      map.set({
        routes: [{ pts: [a.p, poi.p], color: COLORS.poi, width: 3, dash: [4, 6] }],
        markers: [
          { p: a.p, color: COLORS.dest, r: 7, label: ctx.addressLabel(a) },
          { p: poi.p, color: poi.type === 'station' ? COLORS.station : COLORS.poi, r: 8, shape: 'square', label: poi.name },
        ],
      });
      map.fit([a.p, poi.p], 60);
    };
    for (const c of CARDINALS) btns[c] = el('button', { class: 'rose-btn', onclick: () => answer(c) }, c);
    stage.append(
      el('div', { class: 'prompt' },
        el('div', { class: 'face-sub' }, 'Standing at'),
        el('div', { class: 'face-big addr' }, ctx.addressLabel(a)),
        el('div', { class: 'face-sub' }, 'which way is'),
        el('div', { class: 'face-mid' }, poi.name, ' ', el('span', { class: 'tag' }, poi.city || TYPE_LABEL[poi.type] || poi.type)),
        timer),
      el('div', { class: 'rose' }, ROSE.map((c) => (c ? btns[c] : el('div', { class: 'rose-center' }, '📍')))));
    onKeys((e) => {
      if (!done && KEYS[e.key.toLowerCase()]) answer(KEYS[e.key.toLowerCase()]);
      else if ((e.key === 'Enter' || e.key === ' ') && done) { e.preventDefault(); ask(); }
    });
  }

  ask();
  return { destroy: () => map.destroy() };
}
