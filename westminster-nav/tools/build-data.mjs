#!/usr/bin/env node
// Builds westminster-nav/data/city.json, the only map data file the site loads.
//
//   node tools/build-data.mjs           # real data from OpenStreetMap (Overpass API)
//   node tools/build-data.mjs --demo    # offline demo grid of arterials (not real roads)
//
// Requires Node 18+ and no npm packages.

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STREETS, streetByName } from '../js/lib/rotations.js';
import { DEFAULT_GRID, makeGrid, houseNumber, avenueNumber } from '../js/lib/grid.js';
import { shortName, baseKey, ordinal } from '../js/lib/names.js';
import { pointInRings, distance, bearing } from '../js/lib/geo.js';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'data', 'city.json');
// Public Overpass servers are often busy; try each in turn.
const OVERPASS = process.env.OVERPASS_URL ? [process.env.OVERPASS_URL] : [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const SEARCH_BOX = [39.78, -105.20, 40.02, -104.95]; // S, W, N, E around Westminster
const MAX_ADDRESSES = 6000;

const round = (x) => Math.round(x * 1e5) / 1e5;

// Deterministic RNG so rebuilds are stable.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function overpass(query, label) {
  for (let attempt = 1; attempt <= 3 * OVERPASS.length; attempt++) {
    const url = OVERPASS[(attempt - 1) % OVERPASS.length];
    process.stderr.write(`overpass: ${label} via ${new URL(url).host} (attempt ${attempt})\n`);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'westminster-nav-trainer/1.0' },
        body: 'data=' + encodeURIComponent(query),
      });
      if (res.ok) return (await res.json()).elements;
      process.stderr.write(`  HTTP ${res.status}\n`);
    } catch (err) {
      process.stderr.write(`  ${err.message}\n`);
    }
    if (attempt % OVERPASS.length === 0) await new Promise((r) => setTimeout(r, 20000 * attempt));
  }
  throw new Error(`Overpass query failed: ${label}`);
}

// Join boundary member ways into closed rings.
function stitchRings(segments) {
  const key = (p) => `${p[0]},${p[1]}`;
  const rings = [];
  const pool = segments.filter((s) => s.length > 1).map((s) => s.slice());
  while (pool.length) {
    let ring = pool.pop();
    let grew = true;
    while (key(ring[0]) !== key(ring[ring.length - 1]) && grew) {
      grew = false;
      const end = key(ring[ring.length - 1]);
      for (let i = 0; i < pool.length; i++) {
        const s = pool[i];
        if (key(s[0]) === end) ring = ring.concat(s.slice(1));
        else if (key(s[s.length - 1]) === end) ring = ring.concat(s.slice().reverse().slice(1));
        else continue;
        pool.splice(i, 1);
        grew = true;
        break;
      }
    }
    if (ring.length > 3) rings.push(ring);
  }
  return rings;
}

function roadClass(hw) {
  if (hw.endsWith('_link')) return 'link';
  if (hw === 'living_street') return 'residential';
  return hw;
}

function onewayOf(tags) {
  const o = tags.oneway;
  if (o === '-1' || o === 'reverse') return -1;
  if (o === 'yes' || o === '1' || o === 'true') return 1;
  if (o === 'no') return 0;
  if (tags.junction === 'roundabout' || tags.junction === 'circular') return 1;
  if (tags.highway === 'motorway' || tags.highway === 'motorway_link') return 1;
  return 0;
}

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};

// Re-fit the address grid from where the anchor streets and avenues really are.
function calibrate(ways) {
  const west = new Map();
  const north = new Map();
  for (const w of ways) {
    if (!w.name || w.pts.length < 2) continue;
    const a = w.pts[0];
    const b = w.pts[w.pts.length - 1];
    const ns = Math.abs(b[0] - a[0]) * 1.3 > Math.abs(b[1] - a[1]);
    const rot = streetByName(baseKey(w.name));
    if (ns && rot && rot.major) {
      if (!west.has(rot.block)) west.set(rot.block, []);
      for (const p of w.pts) west.get(rot.block).push(p[1]);
    }
    const ave = avenueNumber(shortName(w.name));
    if (!ns && ave && ave % 4 === 0 && /ave/i.test(shortName(w.name))) {
      const k = ave * 100;
      if (!north.has(k)) north.set(k, []);
      for (const p of w.pts) north.get(k).push(p[0]);
    }
  }
  const fit = (m, def, dir) => {
    let pts = [...m.entries()].filter(([, v]) => v.length >= 6).map(([k, v]) => [k, median(v)]).sort((x, y) => x[0] - y[0]);
    // Drop anchors that disagree with the default grid by more than ~1/4 mile.
    const g = makeGrid(DEFAULT_GRID);
    const back = dir === 'west' ? g.westNumber : g.northNumber;
    pts = pts.filter(([k, v]) => Math.abs(back(v) - k) < 400);
    // Enforce monotonic order.
    const mono = [];
    for (const p of pts) {
      const last = mono[mono.length - 1];
      if (!last || (dir === 'west' ? p[1] < last[1] : p[1] > last[1])) mono.push(p);
    }
    if (mono.length < 3) return def;
    // Keep default anchors outside the observed range for extrapolation.
    const lo = mono[0][0];
    const hi = mono[mono.length - 1][0];
    return [...def.filter(([k]) => k < lo - 400), ...mono, ...def.filter(([k]) => k > hi + 400)].map(([k, v]) => [k, round(v)]);
  };
  return { west: fit(west, DEFAULT_GRID.west, 'west'), north: fit(north, DEFAULT_GRID.north, 'north') };
}

// Douglas-Peucker on interior points (meters, local approx).
function simplify(ids, coord, keep, tol = 3) {
  if (ids.length <= 2) return ids;
  const out = [ids[0]];
  let start = 0;
  for (let i = 1; i < ids.length; i++) {
    if (keep.has(ids[i]) || i === ids.length - 1) {
      out.push(...dp(ids.slice(start, i + 1), coord, tol).slice(1));
      start = i;
    }
  }
  return out;
}
function dp(ids, coord, tol) {
  if (ids.length <= 2) return ids;
  const A = coord(ids[0]);
  const B = coord(ids[ids.length - 1]);
  const kx = 111320 * Math.cos((A[0] * Math.PI) / 180);
  const ky = 110540;
  const bx = (B[1] - A[1]) * kx;
  const by = (B[0] - A[0]) * ky;
  const L = Math.hypot(bx, by) || 1;
  let max = 0;
  let idx = 0;
  for (let i = 1; i < ids.length - 1; i++) {
    const P = coord(ids[i]);
    const px = (P[1] - A[1]) * kx;
    const py = (P[0] - A[0]) * ky;
    const d = Math.abs(bx * py - by * px) / L;
    if (d > max) { max = d; idx = i; }
  }
  if (max <= tol) return [ids[0], ids[ids.length - 1]];
  return dp(ids.slice(0, idx + 1), coord, tol).concat(dp(ids.slice(idx), coord, tol).slice(1));
}

// Make plausible grid addresses along grid-named streets inside the city.
function synthAddresses(ways, rings, grid, count, rand) {
  const cand = ways.filter((w) => w.name && ['residential', 'tertiary', 'secondary', 'unclassified', 'primary', 'trunk'].includes(w.cls)
    && (streetByName(baseKey(w.name)) || avenueNumber(shortName(w.name))));
  const total = cand.reduce((s, w) => s + w.len, 0);
  const out = [];
  const seen = new Set();
  let guard = 0;
  while (out.length < count && guard++ < count * 20) {
    let r = rand() * total;
    let w = cand[0];
    for (const c of cand) { r -= c.len; if (r <= 0) { w = c; break; } }
    const i = Math.floor(rand() * (w.pts.length - 1));
    const t = rand();
    const a = w.pts[i];
    const b = w.pts[i + 1];
    const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    if (!pointInRings(p, rings)) continue;
    const brg = bearing(a, b);
    const ns = Math.abs(Math.cos((brg * Math.PI) / 180)) > 0.6;
    const num = houseNumber(ns ? grid.northNumber(p[0]) : grid.westNumber(p[1]), rand() < 0.5);
    const name = shortName(w.name);
    const k = `${num} ${name}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ num, name, lat: round(p[0]), lon: round(p[1]), src: 1 });
  }
  return out;
}

function pack({ source, note, rings, ways, nodes, grid, addresses, pois }) {
  const names = [];
  const nameIdx = new Map();
  const nid = (n) => {
    if (!n) return -1;
    if (!nameIdx.has(n)) { nameIdx.set(n, names.length); names.push(n); }
    return nameIdx.get(n);
  };
  const flat = [];
  for (const p of nodes) flat.push(round(p[0]), round(p[1]));
  const lats = rings.flat().map((p) => p[0]);
  const lons = rings.flat().map((p) => p[1]);
  return {
    meta: {
      source, note, generated: new Date().toISOString(),
      origin: [round((Math.min(...lats) + Math.max(...lats)) / 2), round((Math.min(...lons) + Math.max(...lons)) / 2)],
      grid,
    },
    boundary: rings.map((r) => r.map((p) => [round(p[0]), round(p[1])])),
    names,
    nodes: flat,
    ways: ways.map((w) => [nid(w.name), w.cls, w.oneway, w.nodes]),
    addresses: addresses.map((a) => [a.num, nid(a.name), a.lat, a.lon, a.src]),
    pois: pois.map((p) => [p.name, p.type, round(p.lat), round(p.lon)]),
  };
}

async function buildFromOSM() {
  const [S, W, N, E] = SEARCH_BOX;
  const box = `${S},${W},${N},${E}`;
  const rel = await overpass(`[out:json][timeout:180];
    rel["boundary"="administrative"]["admin_level"="8"]["name"="Westminster"](${box});
    out geom;`, 'city boundary');
  const city = rel.find((r) => r.type === 'relation');
  if (!city) throw new Error('Westminster boundary relation not found');
  const segs = city.members.filter((m) => m.type === 'way' && m.geometry).map((m) => m.geometry.map((g) => [g.lat, g.lon]));
  const rings = stitchRings(segs);
  const lats = rings.flat().map((p) => p[0]);
  const lons = rings.flat().map((p) => p[1]);
  const pad = 0.012;
  const bb = [Math.min(...lats) - pad, Math.min(...lons) - pad, Math.max(...lats) + pad, Math.max(...lons) + pad].map((x) => x.toFixed(5)).join(',');

  const roads = await overpass(`[out:json][timeout:300];
    way["highway"~"^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|residential|unclassified|living_street)$"](${bb});
    out geom;`, 'roads');
  const addrEls = await overpass(`[out:json][timeout:300];
    nwr["addr:housenumber"]["addr:street"](${bb});
    out center tags;`, 'addresses');
  const poiEls = await overpass(`[out:json][timeout:180];
    (
      nwr["amenity"~"^(hospital|fire_station|police|townhall|library|college)$"](${bb});
      nwr["healthcare"="hospital"](${bb});
      nwr["shop"="mall"](${bb});
      nwr["leisure"~"^(stadium|golf_course)$"]["name"](${bb});
      nwr["tourism"~"^(attraction|museum|zoo)$"]["name"](${bb});
      nwr["natural"="water"]["name"~"Lake|Reservoir"](${bb});
      nwr["railway"="station"]["name"](${bb});
      nwr["public_transport"="station"]["name"](${bb});
    );
    out center tags;`, 'points of interest');

  // Nodes and topology.
  const idIndex = new Map();
  const coords = [];
  const useCount = new Map();
  for (const w of roads) for (const id of w.nodes) useCount.set(id, (useCount.get(id) || 0) + 1);
  const keep = new Set();
  for (const w of roads) {
    keep.add(w.nodes[0]); keep.add(w.nodes[w.nodes.length - 1]);
    for (const id of w.nodes) if (useCount.get(id) > 1) keep.add(id);
  }
  const geomOf = new Map();
  for (const w of roads) w.nodes.forEach((id, i) => geomOf.set(id, [w.geometry[i].lat, w.geometry[i].lon]));
  const idx = (id) => {
    if (!idIndex.has(id)) { idIndex.set(id, coords.length); coords.push(geomOf.get(id)); }
    return idIndex.get(id);
  };
  const ways = roads.map((w) => {
    const ids = simplify(w.nodes, (id) => geomOf.get(id), keep);
    const pts = w.geometry.map((g) => [g.lat, g.lon]);
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += distance(pts[i - 1], pts[i]);
    return {
      name: w.tags.name || w.tags.ref || '',
      cls: roadClass(w.tags.highway),
      oneway: onewayOf(w.tags),
      nodes: ids.map(idx),
      pts,
      len,
    };
  });

  const grid = calibrate(ways);
  const g = makeGrid(grid);

  // Real addresses inside the city on streets we have.
  const roadKeys = new Set(ways.filter((w) => w.name).map((w) => baseKey(w.name)));
  const rand = rng(20240607);
  let addresses = [];
  const seen = new Set();
  for (const el of addrEls) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null) continue;
    const num = parseInt(el.tags['addr:housenumber'], 10);
    const name = shortName(el.tags['addr:street']);
    if (!num || !roadKeys.has(baseKey(name))) continue;
    if (!pointInRings([lat, lon], rings)) continue;
    const k = `${num} ${name}`;
    if (seen.has(k)) continue;
    seen.add(k);
    addresses.push({ num, name, lat: round(lat), lon: round(lon), src: 0 });
  }
  process.stderr.write(`real addresses inside city: ${addresses.length}\n`);
  if (addresses.length > MAX_ADDRESSES) {
    for (let i = addresses.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [addresses[i], addresses[j]] = [addresses[j], addresses[i]];
    }
    addresses = addresses.slice(0, MAX_ADDRESSES);
  }
  if (addresses.length < 2000) addresses.push(...synthAddresses(ways, rings, g, 2500 - addresses.length, rand));

  const typeOf = (t) => {
    if (t.amenity === 'hospital' || t.healthcare === 'hospital') return 'hospital';
    if (t.amenity) return t.amenity;
    if (t.shop === 'mall') return 'mall';
    if (t.railway === 'station' || t.public_transport === 'station') return 'transit';
    if (t.natural === 'water') return 'lake';
    return t.leisure || t.tourism || 'landmark';
  };
  const pois = [];
  const poiSeen = new Set();
  for (const el of poiEls) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    const name = el.tags?.name;
    if (lat == null || !name || poiSeen.has(name)) continue;
    poiSeen.add(name);
    pois.push({ name, type: typeOf(el.tags), lat, lon });
  }

  return pack({
    source: 'osm',
    note: 'Map data © OpenStreetMap contributors (ODbL).',
    rings, ways, nodes: coords, grid, addresses, pois,
  });
}

// ---------------------------------------------------------------------------
// Demo grid: arterials and rotation streets laid out on the address grid.
// Good for trying the games; NOT real Westminster geometry.
function buildDemo() {
  const g = makeGrid(DEFAULT_GRID);
  const rand = rng(7);
  const NS = [ // name, west block, north from, north to, class
    ['Huron St', 800, 12000, 14400, 'secondary'], ['Pecos St', 1600, 10400, 14400, 'secondary'],
    ['Zuni St', 2400, 6900, 14400, 'secondary'], ['Federal Blvd', 3000, 6900, 12000, 'primary'],
    ['Lowell Blvd', 3600, 6900, 12000, 'secondary'], ['Tennyson St', 4400, 6900, 14400, 'tertiary'],
    ['Sheridan Blvd', 5200, 6900, 12000, 'primary'], ['Harlan St', 6000, 8000, 11200, 'tertiary'],
    ['Pierce St', 6800, 8000, 11200, 'tertiary'], ['Wadsworth Blvd', 7600, 8000, 11200, 'primary'],
    ['Garrison St', 9200, 8800, 11200, 'tertiary'], ['Kipling St', 10000, 8800, 11200, 'secondary'],
    ['Simms St', 11600, 8800, 11200, 'secondary'],
  ];
  const EW = [
    [72, 2900, 5200, 'secondary'], [76, 2900, 5200, 'tertiary'], [80, 2900, 9200, 'secondary'],
    [84, 2900, 9200, 'tertiary'], [88, 2900, 11600, 'secondary'], [92, 2900, 11600, 'primary'],
    [100, 5200, 11600, 'secondary'], [104, 2400, 11600, 'secondary'], [112, 2400, 11600, 'secondary'],
    [120, 800, 5200, 'primary'], [128, 800, 4400, 'secondary'], [136, 800, 4400, 'secondary'],
    [144, 800, 4400, 'secondary'],
  ].map(([ave, w0, w1, cls]) => [`W ${ordinal(ave)} Ave`, ave * 100, w0, w1, cls]);
  // Residential rotation streets between arterial avenues.
  for (const s of STREETS) {
    if (s.major || s.block < 2900 || s.block > 11500 || rand() < 0.45) continue;
    const spans = EW.filter((e) => s.block >= e[2] && s.block <= e[3]).map((e) => e[1]).sort((a, b) => a - b);
    if (spans.length < 2) continue;
    const i = Math.floor(rand() * (spans.length - 1));
    NS.push([`${s.name} St`, s.block, spans[i], spans[i + 1], 'residential']);
  }
  const lines = [];
  for (const [name, w, n0, n1, cls] of NS) lines.push({ name, cls, ns: true, at: w, from: n0, to: n1 });
  for (const [name, n, w0, w1, cls] of EW) lines.push({ name, cls, ns: false, at: n, from: w0, to: w1 });

  const nodes = [];
  const nodeAt = new Map();
  const node = (w, n) => {
    const k = `${w},${n}`;
    if (!nodeAt.has(k)) { nodeAt.set(k, nodes.length); nodes.push(g.toLatLon(w, n)); }
    return nodeAt.get(k);
  };
  const ways = [];
  for (const L of lines) {
    const stops = new Set([L.from, L.to]);
    for (const M of lines) {
      if (M.ns === L.ns) continue;
      if (M.at >= L.from && M.at <= L.to && L.at >= M.from && L.at <= M.to) stops.add(M.at);
    }
    const ids = [...stops].sort((a, b) => a - b).map((v) => (L.ns ? node(L.at, v) : node(v, L.at)));
    const pts = ids.map((i) => nodes[i]);
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += distance(pts[i - 1], pts[i]);
    ways.push({ name: L.name, cls: L.cls, oneway: 0, nodes: ids, pts, len });
  }

  const ring = [
    [2900, 6900], [5300, 6900], [5300, 7950], [9300, 7950], [9300, 8750], [11700, 8750], [11700, 11250],
    [5300, 11250], [5300, 12050], [4500, 12050], [4500, 14450], [750, 14450], [750, 11950], [2350, 11950],
    [2350, 10350], [2900, 10350], [2900, 6900],
  ].map(([w, n]) => g.toLatLon(w, n));
  const addresses = synthAddresses(ways, [ring], g, 2000, rand);
  const pois = [
    ['Westminster City Hall', 'townhall', 4800, 9200],
    ['Butterfly Pavilion', 'attraction', 6252, 10400],
    ['Standley Lake', 'lake', 9600, 9800],
    ['Demo Hospital North', 'hospital', 1000, 14200],
    ['Demo Hospital South', 'hospital', 3300, 8800],
    ['Demo Library', 'library', 4000, 9600],
    ['Demo Mall', 'mall', 5000, 10500],
    ['Demo Police HQ', 'police', 4600, 9150],
  ].map(([name, type, w, n]) => { const [lat, lon] = g.toLatLon(w, n); return { name, type, lat, lon }; });

  return pack({
    source: 'demo',
    note: 'DEMO GRID: arterials and rotation streets placed on the address grid. Not real Westminster roads. Run tools/build-data.mjs to load OpenStreetMap data.',
    rings: [ring], ways, nodes, grid: DEFAULT_GRID, addresses, pois,
  });
}

const demo = process.argv.includes('--demo');
const city = demo ? buildDemo() : await buildFromOSM();
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(city));
process.stderr.write(`wrote ${OUT}: ${city.nodes.length / 2} nodes, ${city.ways.length} ways, ${city.addresses.length} addresses, ${city.pois.length} POIs\n`);
