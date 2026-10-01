// Station setup: place each station on the map, set the street the bay
// opens onto and which way it faces. Saved on this device; export the JSON
// and commit it as data/stations.json to share with everyone.

import { distance, CARDINALS, CARDINAL_NAMES, toCardinal } from '../lib/geo.js';
import { shortName } from '../lib/names.js';
import { el } from '../ui.js';
import { mapPanel } from '../map.js';
import * as store from '../store.js';
import { COLORS } from './common.js';

export function setup(root, ctx) {
  const G = ctx.graph;
  let stations = ctx.stations.map((s) => ({ ...s, facing: toCardinal(s.facing) }));
  let sel = stations[0]?.id;
  const { el: mapEl, map } = mapPanel(ctx, { labels: true, height: '60vh' });
  const form = el('div', { class: 'panel' });
  const listEl = el('div', { class: 'station-list' });
  const status = el('small', { class: 'muted' });

  root.append(
    el('h1', { class: 'game-title' }, 'Station setup'),
    el('p', {}, 'Pick a station, then tap the map where the apparatus pulls out. Set the street the bay opens onto and the direction the trucks face when they leave. ',
      'Changes save on this device. Use ', el('b', {}, 'Export'), ' and commit the file as ', el('code', {}, 'data/stations.json'), ' so everyone gets them.'),
    listEl, el('div', { class: 'setup-grid' }, mapEl, form), status);

  const persist = () => {
    store.save('stations', stations);
    status.textContent = 'Saved on this device.';
  };

  // Streets near a point, nearest first.
  function nearbyStreets(p) {
    const seen = new Map();
    for (const e of G.edges) {
      if (!e.name) continue;
      const d = distance(p, G.pt(e.from));
      const n = shortName(e.name);
      if (d < 250 && (!seen.has(n) || d < seen.get(n))) seen.set(n, d);
    }
    return [...seen.entries()].sort((a, b) => a[1] - b[1]).map(([n]) => n);
  }

  function renderList() {
    listEl.replaceChildren(...stations.map((s) => el('button', {
      class: s.id === sel ? 'chip on' : 'chip',
      onclick: () => { sel = s.id; render(); },
    }, `${s.name}${s.verified ? ' ✓' : ''}`)));
  }

  function renderForm() {
    const s = stations.find((x) => x.id === sel);
    if (!s) { form.replaceChildren(); return; }
    const streets = [...new Set([s.street, ...nearbyStreets([s.lat, s.lon])])].filter(Boolean);
    const input = (label, key, attrs = {}) => el('label', { class: 'field' }, label,
      el('input', { value: s[key] ?? '', ...attrs, oninput: (e) => { s[key] = e.target.value; persist(); renderList(); } }));
    form.replaceChildren(
      el('h3', {}, s.name),
      input('Name', 'name'),
      input('Address', 'address'),
      el('label', { class: 'field' }, 'Bay opens onto',
        el('select', { onchange: (e) => { s.street = e.target.value; persist(); render(); } },
          streets.map((n) => el('option', { value: n, selected: n === s.street }, n)))),
      el('label', { class: 'field' }, 'Trucks face',
        el('select', { onchange: (e) => { s.facing = e.target.value; persist(); render(); } },
          CARDINALS.map((c) => el('option', { value: c, selected: c === s.facing }, `${c} (${CARDINAL_NAMES[c]})`)))),
      el('label', { class: 'field check' },
        el('input', { type: 'checkbox', checked: !!s.verified, onchange: (e) => { s.verified = e.target.checked; persist(); renderList(); } }),
        ' Location, street and facing are verified'),
      el('p', { class: 'muted' }, `${s.lat.toFixed(5)}, ${s.lon.toFixed(5)}`),
      el('div', { class: 'row' },
        el('button', { class: 'btn primary', onclick: exportJson }, 'Export stations.json'),
        el('button', {
          class: 'btn',
          onclick: (e) => {
            // Two-step confirm (dialogs are blocked inside artifacts).
            if (!e.target.dataset.armed) {
              e.target.dataset.armed = '1';
              e.target.textContent = 'Click again to discard changes';
              return;
            }
            store.remove('stations');
            stations = ctx.fileStations.map((x) => ({ ...x }));
            render();
          },
        }, 'Reset')));
  }

  function renderMap() {
    const osmStations = ctx.city.pois.filter(([, t]) => t === 'fire_station');
    map.set({
      markers: [
        ...osmStations.map(([name, , lat, lon]) => ({ p: [lat, lon], color: COLORS.alt, r: 5, shape: 'square', label: name })),
        ...stations.map((s) => ({
          p: [s.lat, s.lon], color: s.id === sel ? COLORS.station : COLORS.alt, text: s.id, r: 9,
          heading: { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 }[s.facing],
        })),
      ],
    });
  }

  function render() { renderList(); renderForm(); renderMap(); }

  map.onclick = (p) => {
    const s = stations.find((x) => x.id === sel);
    if (!s) return;
    s.lat = Math.round(p[0] * 1e5) / 1e5;
    s.lon = Math.round(p[1] * 1e5) / 1e5;
    s.street = nearbyStreets(p)[0] || s.street;
    persist();
    render();
  };

  function exportJson() {
    const text = JSON.stringify(stations.map(({ id, name, address, lat, lon, street, facing, verified }) => ({ id, name, address, lat, lon, street, facing, verified: !!verified })), null, 2) + '\n';
    const a = el('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: 'stations.json' });
    document.body.append(a);
    a.click();
    a.remove();
    navigator.clipboard?.writeText(text).then(() => { status.textContent = 'Downloaded stations.json and copied it to the clipboard.'; }, () => {});
  }

  render();
  return { destroy: () => map.destroy() };
}
