// Road graph, shortest paths, turn-by-turn directions and the Router's
// "drive the user's directions" simulator.

import { distance, bearing, angleDiff } from './geo.js';
import { nameKey, baseKey, shortName, streetMatches } from './names.js';

// Rough apparatus speeds (m/s) by road class, used as edge costs.
const SPEED = {
  motorway: 26, trunk: 20, primary: 18, secondary: 16, tertiary: 14,
  link: 13, unclassified: 11, residential: 11, service: 6,
};
export const ROUTABLE = new Set(['trunk', 'primary', 'secondary', 'tertiary', 'link', 'unclassified', 'residential']);

const LOOK = 30; // meters used to measure a road's heading at an intersection

export function turnOf(rel) {
  if (Math.abs(rel) <= 35) return 'straight';
  if (Math.abs(rel) >= 160) return 'u-turn';
  return rel > 0 ? 'right' : 'left';
}

class MinHeap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k; const v = this.v;
    let i = k.length; k.push(key); v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p]; v[i] = v[p]; i = p;
    }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k; const v = this.v;
    const top = v[0];
    const lk = k.pop(); const lv = v.pop();
    if (k.length) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= k.length) break;
        if (c + 1 < k.length && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = lk; v[i] = lv;
    }
    return top;
  }
}

export class RoadGraph {
  constructor(city) {
    this.city = city;
    const n = city.nodes.length / 2;
    this.n = n;
    this.pt = (i) => [city.nodes[2 * i], city.nodes[2 * i + 1]];
    this.edges = []; // {from, to, way, len, cost, name}
    this.out = Array.from({ length: n }, () => []);
    this.inc = Array.from({ length: n }, () => []);
    this.names = city.names;
    this.ways = city.ways.map(([nameIdx, cls, oneway, nodes], id) => ({
      id, name: nameIdx >= 0 ? city.names[nameIdx] : '', cls, oneway, nodes,
    }));
    for (const w of this.ways) {
      if (!ROUTABLE.has(w.cls)) continue;
      for (let i = 0; i + 1 < w.nodes.length; i++) {
        const a = w.nodes[i];
        const b = w.nodes[i + 1];
        if (w.oneway >= 0) this.addEdge(a, b, w);
        if (w.oneway <= 0) this.addEdge(b, a, w);
      }
    }
  }

  addEdge(from, to, way) {
    const len = distance(this.pt(from), this.pt(to));
    const id = this.edges.length;
    this.edges.push({ id, from, to, way: way.id, name: way.name, len, cost: len / (SPEED[way.cls] || 10) });
    this.out[from].push(id);
    this.inc[to].push(id);
  }

  wayName(e) { return this.edges[e].name; }

  /** Nearest routable node, optionally restricted to nodes on a street matching `street`. */
  nearestNode(p, street = null) {
    let best = -1;
    let bestD = Infinity;
    const key = street ? baseKey(street) : null;
    for (const e of this.edges) {
      if (key && baseKey(e.name) !== key) continue;
      const d = distance(p, this.pt(e.from));
      if (d < bestD) { bestD = d; best = e.from; }
    }
    if (best < 0 && street) return this.nearestNode(p, null);
    return best;
  }

  /** Dijkstra toward `target`: cost-to-go from every node, plus the next edge to take. */
  costsTo(target) {
    const dist = new Float64Array(this.n).fill(Infinity);
    const next = new Int32Array(this.n).fill(-1);
    const h = new MinHeap();
    dist[target] = 0;
    h.push(0, target);
    while (h.size) {
      const u = h.pop();
      const du = dist[u];
      for (const eid of this.inc[u]) {
        const e = this.edges[eid];
        const nd = du + e.cost;
        if (nd < dist[e.from]) {
          dist[e.from] = nd;
          next[e.from] = eid;
          h.push(nd, e.from);
        }
      }
    }
    return { dist, next };
  }

  pathFrom(start, tree) {
    const path = [];
    let u = start;
    const guard = this.n + 5;
    while (tree.next[u] >= 0 && path.length < guard) {
      const eid = tree.next[u];
      path.push(eid);
      u = this.edges[eid].to;
    }
    return path;
  }

  pathLength(path) { return path.reduce((s, e) => s + this.edges[e].len, 0); }
  pathCost(path) { return path.reduce((s, e) => s + this.edges[e].cost, 0); }
  pathPoints(path) {
    if (!path.length) return [];
    return [this.pt(this.edges[path[0]].from), ...path.map((e) => this.pt(this.edges[e].to))];
  }

  // Heading leaving along edge `eid`, measured LOOK meters down the same street.
  headingOut(eid) {
    let e = this.edges[eid];
    const start = this.pt(e.from);
    let travelled = e.len;
    let guard = 0;
    while (travelled < LOOK && guard++ < 20) {
      const nx = this.continuation(e.id);
      if (nx < 0) break;
      e = this.edges[nx];
      travelled += e.len;
    }
    return bearing(start, this.pt(e.to));
  }

  // Heading arriving at the end of edge `eid`, measured LOOK meters back.
  headingIn(eid) {
    let e = this.edges[eid];
    const end = this.pt(e.to);
    let travelled = e.len;
    let guard = 0;
    while (travelled < LOOK && guard++ < 20) {
      const prev = this.inc[e.from].find((p) => this.edges[p].way === e.way && this.edges[p].from !== e.to);
      if (prev === undefined) break;
      e = this.edges[prev];
      travelled += e.len;
    }
    return bearing(this.pt(e.from), end);
  }

  /** Straightest next edge on the same street after `eid` (no U-turns), or -1. */
  continuation(eid, matchName = null) {
    const e = this.edges[eid];
    const key = nameKey(matchName ?? e.name);
    const h = bearing(this.pt(e.from), this.pt(e.to));
    let best = -1;
    let bestA = 999;
    for (const o of this.out[e.to]) {
      const oe = this.edges[o];
      if (oe.to === e.from) continue;
      const sameWay = oe.way === e.way;
      const sameName = key && nameKey(oe.name) === key;
      if (!sameWay && !sameName) continue;
      const a = Math.abs(angleDiff(h, bearing(this.pt(oe.from), this.pt(oe.to))));
      if (a > 100) continue;
      const score = a - (sameWay ? 5 : 0);
      if (score < bestA) { bestA = score; best = o; }
    }
    return best;
  }

  /**
   * Collapse an edge path into turn-by-turn steps.
   * `startHeading` (degrees) is the direction the apparatus faces before the first edge.
   */
  directions(path, startHeading = null) {
    const steps = [];
    if (!path.length) return steps;
    const label = (e) => shortName(this.edges[e].name) || 'unnamed road';
    let cur = { name: label(path[0]), dist: 0, turn: null, at: path[0] };
    if (startHeading != null) cur.turn = turnOf(angleDiff(startHeading, this.headingOut(path[0])));
    for (let i = 0; i < path.length; i++) {
      const e = this.edges[path[i]];
      const nm = label(path[i]);
      const unnamed = !e.name;
      const rel = i > 0 ? angleDiff(this.headingIn(path[i - 1]), bearing(this.pt(e.from), this.pt(e.to))) : 0;
      if (i > 0 && !unnamed && (nameKey(nm) !== nameKey(cur.name) || turnOf(rel) === 'u-turn')) {
        const turn = turnOf(nameKey(nm) === nameKey(cur.name) ? rel : angleDiff(this.headingIn(path[i - 1]), this.headingOut(path[i])));
        steps.push(cur);
        cur = { name: nm, dist: 0, turn, at: path[i] };
      } else if (cur.name === 'unnamed road' && !unnamed) {
        cur.name = nm;
      }
      cur.dist += e.len;
    }
    steps.push(cur);
    // Merge "straight" continuations through unnamed connectors into the prior step.
    return steps.filter((s, i) => !(i > 0 && s.turn === 'straight' && nameKey(s.name) === nameKey(steps[i - 1].name)));
  }

  /**
   * Drive a user's directions.
   * exit: 'left'|'right' out of the station. steps: [{turn, street}].
   * Returns {ok, path, reason, failedStep}.
   */
  simulate({ start, facing, exitTurn, stationStreet, steps, target }) {
    const path = [];
    // 1. Leave the station onto its street.
    const exitOpts = this.out[start].filter((eid) => !stationStreet || streetMatches(stationStreet, this.edges[eid].name) || baseKey(stationStreet) === baseKey(this.edges[eid].name));
    const pool = exitOpts.length ? exitOpts : this.out[start];
    let edge = -1;
    let bestA = 999;
    for (const eid of pool) {
      const rel = angleDiff(facing, this.headingOut(eid));
      const t = turnOf(rel);
      if (t === exitTurn || (t === 'straight' && exitTurn === 'straight')) {
        const a = Math.abs(Math.abs(rel) - 90);
        if (a < bestA) { bestA = a; edge = eid; }
      }
    }
    if (edge < 0) return { ok: false, path, failedStep: 0, reason: `You can't turn ${exitTurn} out of the station onto ${stationStreet}.` };
    path.push(edge);

    const MAX_RUN = 20000;
    for (let si = 0; si < steps.length; si++) {
      const { turn, street } = steps[si];
      let run = 0;
      let wrongSide = false;
      let found = -1;
      let cur = edge;
      const curName = shortName(this.edges[cur].name) || 'the road';
      for (;;) {
        const node = this.edges[cur].to;
        const hin = this.headingIn(cur);
        for (const o of this.out[node]) {
          const oe = this.edges[o];
          if (oe.to === this.edges[cur].from) continue;
          if (!streetMatches(street, oe.name)) continue;
          if (nameKey(oe.name) === nameKey(this.edges[cur].name) && turn !== 'straight') continue;
          const t = turnOf(angleDiff(hin, this.headingOut(o)));
          if (t === turn) { found = o; break; }
          if (t === 'left' || t === 'right') wrongSide = true;
        }
        if (found >= 0) break;
        const nx = this.continuation(cur);
        if (nx < 0 || run > MAX_RUN) break;
        cur = nx;
        path.push(cur);
        run += this.edges[cur].len;
      }
      if (found < 0) {
        const why = wrongSide
          ? `${street} is there, but it's not a ${turn} turn from the way you were heading on ${curName}.`
          : `Driving ${curName} you never reach a ${turn} turn onto ${street} (the road ends or runs out of the area).`;
        return { ok: false, path, failedStep: si + 1, reason: why };
      }
      edge = found;
      path.push(edge);
    }

    // 2. Continue on the final street until the closest approach to the target.
    const tp = this.pt(target);
    let bestIdx = path.length;
    let bestD = distance(this.pt(this.edges[edge].to), tp);
    let cur = edge;
    let run = 0;
    const tail = [];
    while (bestD > 0 && run < 20000) {
      if (this.edges[cur].to === target) break;
      const nx = this.continuation(cur);
      if (nx < 0) break;
      cur = nx;
      tail.push(cur);
      run += this.edges[cur].len;
      const d = distance(this.pt(this.edges[cur].to), tp);
      if (d < bestD) { bestD = d; bestIdx = path.length + tail.length; }
    }
    path.push(...tail);
    path.length = Math.max(bestIdx, 0);
    const ok = bestD <= 150;
    return {
      ok, path, missBy: bestD, failedStep: ok ? null : steps.length,
      reason: ok ? null : `You end up ${Math.round(bestD)} m from the address. Closest point was on ${shortName(this.edges[path[path.length - 1]]?.name) || 'the last street'}.`,
    };
  }

  /** Station departure: options for left vs right turn out of the station. */
  departureOptions(start, facing, stationStreet, target) {
    const tree = this.costsTo(target);
    const opts = {};
    for (const eid of this.out[start]) {
      const e = this.edges[eid];
      if (stationStreet && baseKey(stationStreet) !== baseKey(e.name)) continue;
      const t = turnOf(angleDiff(facing, this.headingOut(eid)));
      if (t !== 'left' && t !== 'right') continue;
      const path = [eid, ...this.pathFrom(e.to, tree)];
      // Coming straight back past the station means a U-turn: charge for it.
      const uturn = path.slice(1).some((p) => this.edges[p].from === start);
      const cost = e.cost + tree.dist[e.to] + (uturn ? e.cost + 30 : 0);
      if (!opts[t] || cost < opts[t].cost) opts[t] = { cost, path, uturn };
    }
    return { opts, tree };
  }
}
