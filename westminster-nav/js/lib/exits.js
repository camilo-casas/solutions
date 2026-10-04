// Freeway exits: where a ramp leaves a freeway, and the streets it leads to.
// Ramps are unnamed in OpenStreetMap, so the sign text comes from following the
// ramp to the first named road. Exit numbers come from the map data when the
// build found them (city.exits).

import { angleDiff } from './geo.js';
import { shortName, nameKey } from './names.js';

const RAMP_LIMIT = 2500; // meters followed along a ramp
const WORD = { N: 'North', E: 'East', S: 'South', W: 'West' };
const dir4 = (b) => ['N', 'E', 'S', 'W'][Math.round((((b % 360) + 360) % 360) / 90) % 4];

/** Map of node -> exits leaving the freeway there, built once per city. */
export function freewayExits(ctx) {
  if (ctx.freewayExits) return ctx.freewayExits;
  const G = ctx.graph;
  const cls = (e) => G.ways[G.edges[e].way].cls;
  const numbered = new Map((ctx.city.exits || []).map(([n, ref, dest]) => [n, { ref, dest }]));
  const res = new Map();
  for (let n = 0; n < G.base; n++) {
    const fwyIn = G.inc[n].find((e) => G.edges[e].name && (cls(e) === 'motorway' || cls(e) === 'trunk'));
    if (fwyIn === undefined) continue;
    const fwy = G.edges[fwyIn];
    const fwyKey = fwy.key;
    const fwyOut = G.out[n].filter((e) => G.edges[e].key === fwyKey)
      .sort((a, b) => Math.abs(angleDiff(G.headingIn(fwyIn), G.headingOut(a))) - Math.abs(angleDiff(G.headingIn(fwyIn), G.headingOut(b))))[0];
    const along = fwyOut !== undefined ? G.headingOut(fwyOut) : G.headingIn(fwyIn);
    for (const id of G.out[n]) {
      if (cls(id) !== 'link') continue;
      const found = followRamp(G, id, fwyKey);
      // On a trunk road, short links are right-turn slip lanes at signals, not exits.
      if (!found.names.size || (cls(fwyIn) === 'trunk' && found.len < 250)) continue;
      const names = [...found.names].slice(0, 2).map(([nm, dirs]) => (dirs.size === 1 ? `${nm} ${WORD[[...dirs][0]]}` : nm));
      const brg = G.headingOut(id);
      const num = numbered.get(n);
      const exit = { node: n, edge: id, brg, along, side: angleDiff(along, brg) < 0 ? 'left' : 'right', names, ref: num?.ref || '', dest: num?.dest || '', freeway: shortName(fwy.name) };
      if (!res.has(n)) res.set(n, []);
      res.get(n).push(exit);
    }
  }
  ctx.freewayExits = res;
  return res;
}

/** Follow a ramp to the named roads it reaches. Returns name -> set of directions you can head on it. */
function followRamp(G, first, fwyKey) {
  const names = new Map();
  const add = (e) => {
    // Signs say "Sheridan Blvd", not "N Sheridan Blvd"; avenues keep their W or E.
    const nm = shortName(G.edges[e].name).replace(/^[NS] (?=\D)/, '');
    if (!names.has(nm)) names.set(nm, new Set());
    names.get(nm).add(dir4(G.headingOut(e)));
  };
  const f = G.edges[first];
  if (f.name && f.key !== fwyKey) { add(first); return { names, len: f.len }; }
  const seen = new Set([f.from, f.to]);
  const queue = [{ n: f.to, len: f.len, back: f.from }];
  let reached = 0;
  while (queue.length) {
    const { n, len, back } = queue.shift();
    const out = G.out[n].filter((e) => G.edges[e].to !== back);
    const named = out.filter((e) => G.edges[e].name && G.edges[e].key !== fwyKey);
    if (named.length) {
      named.forEach(add);
      reached = Math.max(reached, len);
      continue; // the ramp ends here
    }
    for (const e of out) {
      const oe = G.edges[e];
      if (oe.name || seen.has(oe.to) || len + oe.len > RAMP_LIMIT) continue;
      seen.add(oe.to);
      queue.push({ n: oe.to, len: len + oe.len, back: n });
    }
  }
  return { names, len: reached };
}

/** The exit a turn option takes, when its first segment is a ramp leaving a freeway. */
export function exitFor(ctx, node, firstEdge) {
  return freewayExits(ctx).get(node)?.find((x) => x.edge === firstEdge) || null;
}

/** "Exit 217" or "Exit". */
export const exitTab = (x) => (x.ref ? `Exit ${x.ref}` : 'Exit');
