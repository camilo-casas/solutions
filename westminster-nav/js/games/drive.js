// Responder and Transporter: drive the real street grid one block at a time.
//   ↑  drive forward to the next intersection
//   ↓  back up one block (heading unchanged)
//   ← → turn onto the cross street at this intersection (then ↑ to drive it)
// Responder starts in a station bay; Transporter starts at a scene address and
// ends at a hospital.

import { distance, bearing, angleDiff, toCardinal, CARDINAL_NAMES } from '../lib/geo.js';
import { shortName, nameKey, streetMatches } from '../lib/names.js';
import { el, pick, onKeys, scoreBar, fmtTime } from '../ui.js';
import { mapPanel } from '../map.js';
import { Windshield } from '../windshield.js';
import { freewayExits, exitFor, exitTab, dirWord } from '../lib/exits.js';
import * as store from '../store.js';
import { COLORS, stationPicker, stationCard, addressAwayFrom, gridNote, directionsList, driveTime, DISTRICT_MI, districtMeters } from './common.js';
import { NEEDS, pickNeed, capabilityOf } from '../lib/hospitals.js';

const LOOK = 40; // degrees counted as "straight ahead"
const SPEED = 13; // m/s, for backing-up cost

export function responder(root, ctx) { return drive(root, ctx, 'responder'); }
export function transporter(root, ctx) { return drive(root, ctx, 'transporter'); }


function drive(root, ctx, mode) {
  const G = ctx.graph;
  const isT = mode === 'transporter';
  const title = isT ? 'Transporter' : 'Responder';
  const prefs = { hints: false, off: [], ...store.load(`${mode}:prefs`, {}) };

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
    el('small', { class: 'muted' }, 'Tap a hospital to switch it on or off. Each call goes to one of the closest hospitals that\'s on and can take the patient: freestanding ERs and smaller hospitals for minor complaints, full-service hospitals for serious medical calls, a Level I trauma center for major trauma, Children\'s for kids.'));
  const ws = new Windshield(ctx, { vehicle: isT ? 'ambulance' : 'engine' });
  let seen = null; // what the windshield last showed: { trail, heading, pending }
  const head = el('div', { class: 'game-head' });
  const stage = el('div', { class: 'stage' });
  const { el: mapEl, map } = mapPanel(ctx, { labels: 'major' });
  const mapDest = el('div', { class: 'map-dest' });
  const mapBox = el('div', { class: 'drive-map' }, mapDest, mapEl);
  // The arrow buttons sit on the edges of both views, over the picture.
  const wsPads = el('div', { class: 'edge-pads' });
  const mapPads = el('div', { class: 'edge-pads' });
  ws.el.append(wsPads);
  mapEl.append(mapPads);
  const views = el('div', { class: 'drive-views' }, ws.el, mapBox);
  // Third view, below the windshield and map: turn-by-turn by street name.
  const tbt = el('section', { class: 'panel tbt', 'aria-label': 'Turn-by-turn' });
  root.append(el('h1', { class: 'game-title' }, title), head, stage, tbt);

  const toggle = (key, label) => el('label', { class: 'inline' },
    el('input', { type: 'checkbox', checked: prefs[key], onchange: (e) => { prefs[key] = e.target.checked; store.save(`${mode}:prefs`, prefs); render(); } }),
    ` ${label}`);
  const renderHead = () => head.replaceChildren(...[
    el('div', { class: 'row' }, isT ? null : picker.el, toggle('hints', 'Hints')),
    isT ? null : el('small', { class: 'muted' }, `Calls stay in the station's district: addresses come from anywhere within about ${DISTRICT_MI} miles of the station.`),
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
  // A "block" ends at an intersection: a side street (even one joined by an
  // unnamed connector) or a freeway exit. Driving forward, only a real choice
  // stops the truck, so it rolls through the spots where a divided road splits
  // into two one-way roadways or joins back up, and past on-ramps merging in.
  // Backing up (no `cur`) stops wherever three or more segments meet.
  const isStop = (n, cur = null) => {
    if (n === g.target || n === g.start) return true;
    // On a named street, a node with no other named neighbor is its end. On a
    // ramp or connector (unnamed) that test means nothing: keep rolling.
    if ((!cur || cur.name) && namedDegree(n) <= 1) return true;
    if (!cur) return degree(n) >= 3;
    // Any other named street here is an intersection, even one you can't turn onto directly.
    const mineKey = G.edges[cur.id]?.key ?? nameKey(cur.name);
    if ([...G.out[n], ...G.inc[n]].some((e) => G.edges[e].name && G.edges[e].key !== mineKey)) return true;
    // Not counting a U-turn back down the other roadway of the same street, or
    // a right-turn slip lane peeling off before the intersection itself.
    const ahead = new Set(G.out[n].filter((e) => {
      const x = G.edges[e];
      if (x.to === cur.from) return false;
      if (isSlipLane(e)) return false;
      return !(x.key === G.edges[cur.id]?.key && Math.abs(angleDiff(cur.brg, bearing(G.pt(n), G.pt(x.to)))) > 135);
    }).map((e) => G.edges[e].to));
    return ahead.size !== 1;
  };

  // A slip lane: an unnamed connector off a surface street that reaches a cross
  // street which also meets our street directly close by (so the truck stops at
  // that corner anyway). Ramps to a freeway, and connectors that are the only
  // way onto a side street, are real choices.
  const slipCache = new Map();
  function isSlipLane(e) {
    if (slipCache.has(e)) return slipCache.get(e);
    const x = G.edges[e];
    const cls = (id) => G.ways[G.edges[id].way].cls;
    let slip = false;
    const own = G.inc[x.from].map((i) => G.edges[i]).find((i) => i.name)?.key;
    if (!x.name && cls(e) === 'link' && own && !G.inc[x.from].some((i) => /motorway|trunk/.test(cls(i)))) {
      // Named streets the connector reaches.
      const reached = new Set();
      let freeway = false;
      const seen = new Set([x.to]);
      const queue = [{ n: x.to, len: x.len }];
      while (queue.length) {
        const { n, len } = queue.shift();
        for (const o of G.out[n]) {
          const y = G.edges[o];
          if (/motorway|trunk/.test(cls(o))) freeway = true;
          if (y.name) { if (y.key !== own) reached.add(y.key); continue; }
          if (seen.has(y.to) || len + y.len > 250) continue;
          seen.add(y.to);
          queue.push({ n: y.to, len: len + y.len });
        }
      }
      if (!freeway && reached.size) {
        // Does one of them also touch our street within 150 m of here?
        const near = new Set([x.from]);
        const q2 = [{ n: x.from, len: 0 }];
        while (q2.length && !slip) {
          const { n, len } = q2.shift();
          for (const o of [...G.out[n], ...G.inc[n]]) {
            const y = G.edges[o];
            if (y.name && reached.has(y.key)) { slip = true; break; }
            if (y.key !== own) continue;
            const m = y.from === n ? y.to : y.from;
            if (near.has(m) || len + y.len > 150) continue;
            near.add(m);
            q2.push({ n: m, len: len + y.len });
          }
        }
      }
    }
    slipCache.set(e, slip);
    return slip;
  }

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

  // The map has short stubs that split off a road and go nowhere (a turn bay or a
  // driveway carrying the road's name). "Straight on" never means one of those.
  const stubCache = new Map();
  function deadEnd(x) {
    if (x.to === g.target) return false;
    const k = `${x.from}>${x.to}`;
    if (stubCache.has(k)) return stubCache.get(k);
    let far = x.len;
    const seen = new Set([x.from, x.to]);
    const q = [{ n: x.to, len: x.len }];
    while (q.length && far < 300) {
      const { n, len } = q.shift();
      for (const e of G.out[n]) {
        const y = G.edges[e];
        if (seen.has(y.to)) continue;
        seen.add(y.to);
        far = Math.max(far, len + y.len);
        if (y.to === g.target) far = 1e9;
        q.push({ n: y.to, len: len + y.len });
      }
    }
    const stub = far < 300;
    stubCache.set(k, stub);
    return stub;
  }
  const stubPenalty = (x) => (deadEnd(x) ? 90 : 0);

  const aheadScore = (x) => Math.abs(angleDiff(g.heading, x.brg)) - (nameKey(x.name) === nameKey(g.street) ? 10 : 0) + (!x.name ? 40 : 0) + stubPenalty(x);

  /** Walk from `first` (a segment) to the next intersection. Returns the segments walked. */
  function walkBlock(first, reverse) {
    const segs = [first];
    let cur = first;
    let guard = 0;
    while (!isStop(cur.to, reverse ? null : cur) && guard++ < 2000) {
      const opts = segmentsFrom(cur.to, reverse).filter((s) => s.to !== cur.from);
      if (!opts.length) break;
      // Straightest wins, but stay on the same road: a ramp peeling off at a shallow angle is not "ahead".
      const score = (x) => Math.abs(angleDiff(cur.brg, x.brg)) - (x.way === cur.way ? 10 : 0) + (cur.name && !x.name ? 40 : 0) + stubPenalty(x)
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

  /**
   * Turn onto the cross street heading the way the player asked: search the roads
   * reachable from here through slip lanes and connectors, or a short way along
   * our own street (across the median of a divided road), and take the cross
   * street whose direction is closest to a true left or right.
   */
  function crossTurn(n, side) {
    const mine = nameKey(g.street);
    const want = g.heading + (side === 'left' ? -90 : 90);
    const found = [];
    const best = new Map([[n, 0]]);
    const queue = [{ n, via: [], len: 0, own: 0 }];
    while (queue.length) {
      const cur = queue.shift();
      for (const id of G.out[cur.n]) {
        const e = G.edges[id];
        if (!cur.via.length && e.to === g.prev) continue;
        if (e.name && nameKey(e.name) !== mine) {
          found.push({ via: cur.via, edge: id, brg: G.headingOut(id), name: shortName(e.name), len: cur.len });
          continue;
        }
        // Along our own street only a short way: across a median or through the
        // short stubs a complicated intersection is drawn with.
        const own = e.name ? cur.own + e.len : cur.own;
        if (e.name && own > 60) continue;
        const len = cur.len + e.len;
        if (len > (G.ways[e.way].cls === 'link' ? 2500 : 400) || cur.via.length >= 60) continue;
        if (best.has(e.to) && best.get(e.to) <= len) continue;
        best.set(e.to, len);
        queue.push({ n: e.to, via: [...cur.via, id], len, own });
      }
    }
    // Slip lanes passed on the way in.
    if (n === g.node) {
      for (const slip of g.slips || []) {
        const first = G.edges[slip.edge];
        const q = [{ n: first.to, via: [slip.edge], len: first.len }];
        const seen = new Set([first.to]);
        while (q.length) {
          const cur = q.shift();
          for (const id of G.out[cur.n]) {
            const e = G.edges[id];
            if (e.name) {
              if (nameKey(e.name) !== mine) found.push({ via: cur.via, edge: id, brg: G.headingOut(id), name: shortName(e.name), len: slip.back + cur.len, slip });
              continue;
            }
            if (seen.has(e.to) || cur.len + e.len > 400) continue;
            seen.add(e.to);
            q.push({ n: e.to, via: [...cur.via, id], len: cur.len + e.len });
          }
        }
      }
    }
    let pickd = null;
    for (const c of found) {
      const off = Math.abs(angleDiff(want, c.brg));
      if (off > 55) continue;
      const score = off + c.len / 8;
      if (!pickd || score < pickd.score) pickd = { ...c, score };
    }
    return pickd;
  }

  /**
   * A named road forking off right here at a shallow angle (I-25 splitting into
   * US-6, a named ramp leaving Kalamath): it's left or right by the side it peels
   * off from the road straight ahead.
   */
  function forkTurn(side) {
    const n = g.node;
    const up = segmentsFrom(n, false).filter((x) => Math.abs(angleDiff(g.heading, x.brg)) <= LOOK).sort((a, b) => aheadScore(a) - aheadScore(b))[0];
    if (!up) return null;
    const upH = G.headingOut(up.id);
    let best = null;
    for (const id of G.out[n]) {
      const e = G.edges[id];
      if (id === up.id || e.to === g.prev || !e.name || nameKey(e.name) === nameKey(g.street)) continue;
      const h = G.headingOut(id);
      if (Math.abs(angleDiff(g.heading, h)) > 35) continue;
      let rel = angleDiff(upH, h);
      if (Math.abs(rel) < 2) rel = angleDiff(up.brg, bearing(G.pt(e.from), G.pt(e.to)));
      if (Math.abs(rel) < 1 || (side === 'left') !== (rel < 0)) continue;
      const c = { via: [], edge: id, brg: h, name: shortName(e.name), len: 0, score: Math.abs(rel) };
      if (!best || c.score < best.score) best = c;
    }
    return best;
  }

  /**
   * On a freeway, an exit ramp on this side, when no street was found through it:
   * drive onto the ramp itself, and choose the street at the bottom of the ramp.
   */
  function rampTurn(side) {
    const n = g.node;
    const arr = G.inc[n].find((e) => G.edges[e].from === g.prev);
    if (arr === undefined || !/motorway|trunk/.test(G.ways[G.edges[arr].way].cls)) return null;
    let best = null;
    for (const id of G.out[n]) {
      const e = G.edges[id];
      if (e.name || G.ways[e.way].cls !== 'link') continue;
      let r = angleDiff(g.heading, bearing(G.pt(e.from), G.pt(e.to)));
      if (Math.abs(r) < 2) r = angleDiff(g.heading, G.headingOut(id));
      if (Math.abs(r) < 1 || (side === 'left') !== (r < 0)) continue;
      const x = exitFor(ctx, n, id);
      const c = { via: [], edge: id, brg: G.headingOut(id), name: x ? `${exitTab(x)} ramp` : 'Exit ramp', score: Math.abs(r) };
      if (!best || c.score < best.score) best = c;
    }
    return best;
  }

  /** On a surface street, a freeway on-ramp leaving right here on this side: drive onto it. */
  function onRampTurn(side) {
    const n = g.node;
    const arr = G.inc[n].find((e) => G.edges[e].from === g.prev);
    if (arr !== undefined && /motorway|trunk|link/.test(G.ways[G.edges[arr].way].cls)) return null;
    let best = null;
    for (const id of G.out[n]) {
      const e = G.edges[id];
      if (e.name || G.ways[e.way].cls !== 'link' || e.to === g.prev || isSlipLane(id)) continue;
      // Which freeway does it reach?
      let fwy = null;
      const seen = new Set([e.to]);
      const q = [{ n: e.to, len: e.len }];
      while (q.length && !fwy) {
        const cur = q.shift();
        for (const o of G.out[cur.n]) {
          const y = G.edges[o];
          if (y.name && /motorway|trunk/.test(G.ways[y.way].cls)) { fwy = shortName(y.name); break; }
          if (y.name || seen.has(y.to) || cur.len + y.len > 2500) continue;
          seen.add(y.to);
          q.push({ n: y.to, len: cur.len + y.len });
        }
      }
      if (!fwy) continue;
      let r = angleDiff(g.heading, bearing(G.pt(e.from), G.pt(e.to)));
      if (Math.abs(r) < 2) r = angleDiff(g.heading, G.headingOut(id));
      if (Math.abs(r) < 1 || Math.abs(r) > 150 || (side === 'left') !== (r < 0)) continue;
      const c = { via: [], edge: id, brg: G.headingOut(id), name: `On-ramp to ${fwy}`, score: Math.abs(r) };
      if (!best || c.score < best.score) best = c;
    }
    return best;
  }

  function chooseTurn(side) {
    const fork = forkTurn(side);
    if (fork) return fork;
    const cross = crossTurn(g.node, side);
    const ramp = onRampTurn(side);
    // An on-ramp leaving here wins, unless a real street leaves this same corner on that side.
    if (ramp && !(cross && !cross.via.length && !cross.slip)) return ramp;
    return cross || pickTurn(g.node, side) || rampTurn(side) || nearTurn(side);
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
    return { ahead, left: chooseTurn('left'), right: chooseTurn('right'), back };
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
      const outs = segmentsFrom(g.node, false);
      first = outs.filter((s) => Math.abs(angleDiff(g.heading, s.brg)) <= LOOK).sort((a, b) => aheadScore(a) - aheadScore(b))[0]
        // Where a divided road splits, its own roadway can veer off at a sharper angle: still "straight on".
        || outs.filter((s) => nameKey(s.name) === nameKey(g.street) && Math.abs(angleDiff(g.heading, s.brg)) <= 70).sort((a, b) => aheadScore(a) - aheadScore(b))[0];
      if (!first) return flash(g.node === g.start && !g.moves ? `You're in the bay. Turn left or right onto ${g.startStreet}.` : 'No road straight ahead. Turn left or right.');
    }
    if (addSegs(via)) return arrive();
    let segs = walkBlock(first, false);
    // A divided cross street is one intersection with two roadways: clear both
    // in one move. (Turns onto the far roadway are offered from the near one.)
    let from = g.node;
    for (let k = 0; k < 3; k++) {
      const last = segs[segs.length - 1];
      const n = last.to;
      if (n === g.target) break;
      const start = segs.findIndex((x) => x.from === from);
      const len = segs.slice(start).reduce((t, x) => t + x.len, 0);
      const mine = nameKey(last.name || g.street);
      const crossAt = (m) => streetsAt(m).filter((x) => nameKey(x) !== mine);
      const shared = crossAt(from).filter((x) => crossAt(n).includes(x));
      // Keep going through a stop with no cross street at all (a tangle of the
      // street's own pieces), or across the far roadway of a divided cross street.
      // (A ramp or connector leaving here is a real choice: stop for it.)
      const onlyOwn = G.out[n].every((e) => G.edges[e].to === last.from || (G.edges[e].name && nameKey(G.edges[e].name) === mine));
      if (crossAt(n).length ? (len > 45 || !shared.length) : !onlyOwn) break;
      // Tangled intersections jog: allow a wider angle, preferring our own street.
      const nxt = segmentsFrom(n, false).filter((x) => x.to !== last.from && Math.abs(angleDiff(last.brg, x.brg)) <= (nameKey(x.name) === mine ? 70 : LOOK))
        .sort((a, b) => Math.abs(angleDiff(last.brg, a.brg)) + stubPenalty(a) - Math.abs(angleDiff(last.brg, b.brg)) - stubPenalty(b) - (nameKey(a.name) === mine ? 10 : 0) + (nameKey(b.name) === mine ? 10 : 0))[0];
      if (!nxt) break;
      from = n;
      segs = segs.concat(walkBlock(nxt, false));
    }
    g.lastMove = 'forward';
    g.moves++;
    g.pending = null;
    // Slip lanes passed in the last 150 m: a turn can still take one, backing
    // the truck up to where it peels off (the map often has no turn at the corner itself).
    g.slips = [];
    {
      const cum = [];
      let c = g.cost;
      let d = g.dist;
      for (const x of segs) { c += x.cost; d += x.len; cum.push([c, d]); }
      let back = 0;
      for (let i = segs.length - 2; i >= 0 && back <= 150; i--) {
        back += segs[i + 1].len;
        const nd = segs[i].to;
        for (const e of G.out[nd]) {
          if (e === segs[i + 1].id || !isSlipLane(e)) continue;
          g.slips.push({ node: nd, prev: segs[i].from, edge: e, back, trail: g.trail.length + i + 1, cost: cum[i][0], dist: cum[i][1] });
        }
      }
    }
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
    g.slips = [];
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
    const t = chooseTurn(side);
    if (!t) return flash(`No street to the ${side} here.`);
    g.lastMove = 'forward';
    g.turnDist = g.dist;
    if (t.slip) {
      // Back up to where the slip lane peels off, then take it.
      const sl = t.slip;
      g.trail.length = sl.trail;
      g.cost = sl.cost;
      g.dist = sl.dist;
      g.node = sl.node;
      g.prev = sl.prev;
    }
    g.slips = [];
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

  // ---- Transporter destinations ---------------------------------------------
  // The patient's need decides which hospitals fit; the call goes to the
  // closest of those that are switched on (now and then the next closest,
  // when it's nearly as close).
  const trees = new Map();
  const treeFor = (h) => { if (!trees.has(h.name)) trees.set(h.name, G.costsTo(h.node)); return trees.get(h.name); };
  function chooseHospital(s) {
    const pool = enabledHospitals().length ? enabledHospitals() : reachable;
    const need = pickNeed();
    const timed = pool.map((h) => ({ h, t: treeFor(h).dist[s] })).filter((x) => isFinite(x.t)).sort((a, b) => a.t - b.t);
    const fit = timed.filter((x) => capabilityOf(x.h.name).some((c) => need.accepts.includes(c)));
    const list = fit.length ? fit : timed;
    if (!list.length) return null;
    const second = list.length > 1 && list[1].t <= list[0].t * 1.2 + 60 && Math.random() < 0.3;
    return { need, complaint: pick(need.complaints), chosen: list[second ? 1 : 0], options: list.slice(0, 3), fallback: !fit.length };
  }

  // ---- Setup ----------------------------------------------------------------
  function start() {
    renderHead();
    stage.replaceChildren();
    for (let tries = 0; tries < 20; tries++) {
      if (isT) {
        if (!reachable.length) { stage.append(el('div', { class: 'panel error' }, 'No hospital in data/landmarks.json is inside the map area.')); return; }
        const a = ctx.randomAddress();
        const s = ctx.addressNode(a);
        const outs = G.out[s];
        if (!outs.length) continue;
        const call = chooseHospital(s);
        if (!call) continue;
        const h = call.chosen.h;
        if (distance(a.p, h.p) < 1500) continue;
        const target = h.node;
        const e0 = pick(outs);
        const tree = treeFor(h);
        g = {
          node: s, start: s, target, heading: G.headingOut(e0), street: shortName(G.edges[e0].name), startStreet: shortName(G.edges[e0].name),
          from: a, to: h, call, best: { cost: tree.dist[s], path: G.pathFrom(s, tree) }, startFacing: null,
        };
      } else {
        const st = picker.get();
        const s = ctx.stationNode(st);
        // Anywhere in the district, from next door to its far edge.
        const a = addressAwayFrom(ctx, [st.lat, st.lon], 0, districtMeters(st));
        const target = ctx.addressNode(a);
        if (target === s) continue;
        const { opts } = G.departureOptions(s, st.facing, st.street, target);
        const best = [opts.left, opts.right].filter((o) => o && isFinite(o.cost)).sort((x, y) => x.cost - y.cost)[0];
        if (!best) continue;
        g = { node: s, start: s, target, heading: st.facing, street: st.street, startStreet: st.street, station: st, to: a, best, startFacing: st.facing };
      }
      Object.assign(g, { prev: -1, pending: null, trail: [G.pt(g.node)], cost: 0, dist: 0, turnDist: 0, moves: 0, done: false, t0: performance.now(), msg: '', lastMove: 'forward' });
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
    if (g.trail.length < seen.trail) {
      // Backed up to a slip lane: jump the view there.
      ws.reset({ node: g.node, heading: g.heading, street: g.street, dist: g.dist, target: g.to.p, targetLabel: isT ? g.to.name : ctx.addressLabel(g.to) });
    } else if (g.trail.length > seen.trail) {
      ws.go({ kind: g.lastMove, pts: g.trail.slice(seen.trail - 1), heading: g.heading, street: g.street, turning: !!g.pending, dist: g.dist });
    } else if (Math.abs(angleDiff(seen.heading, g.heading)) > 0.5 || seen.pending !== g.pending) {
      ws.go({ kind: 'turn', heading: g.heading, street: g.street, turning: !!g.pending, dist: g.dist });
    }
    seen = { trail: g.trail.length, heading: g.heading, pending: g.pending };
  }

  /** Button text for a turn option: the street, or the exit number and street on a freeway. */
  function turnLabel(o) {
    const x = o.via?.length ? exitFor(ctx, o.hop ? o.hop.to : g.node, o.via[0]) : null;
    if (x) return `${exitTab(x)} · ${o.name} ${dirWord(o.brg)}`;
    if (nameKey(o.name) === nameKey(g.street)) {
      // Out of the bay onto the station's own street: say which way.
      if (g.node === g.start && !g.moves) return `${o.name} ${dirWord(o.brg)}`;
      return `U-turn (${o.name})`;
    }
    return o.name;
  }
  const isUturn = (o) => nameKey(o.name) === nameKey(g.street) && !(g.node === g.start && !g.moves);

  // ---- Turn-by-turn ---------------------------------------------------------
  // The intersections ahead on the road you're on: drive forward quietly, note
  // each stop and the turns it offers, then put everything back.
  let ahead = null; // { key, list }
  function lookAhead() {
    const key = `${g.node}|${g.moves}|${!!g.pending}|${Math.round(g.heading)}`;
    if (ahead?.key === key) return ahead.list;
    const saved = { ...g, trail: g.trail.slice() };
    const list = [];
    const opt = (side) => { const o = chooseTurn(side); return o && !isUturn(o) ? { label: turnLabel(o), name: o.name } : null; };
    // Where you are now (in the bay, or stopped at a corner).
    if (!g.pending) {
      const left = opt('left');
      const right = opt('right');
      if (left || right) list.push({ steps: 0, here: true, dist: g.dist - g.turnDist, street: g.street, cross: streetsAt(g.node).filter((n) => nameKey(n) !== nameKey(g.street)), left, right });
    }
    quiet = true;
    try {
      for (let k = 1; k <= 30 && !g.done; k++) {
        const before = g.node;
        const wasPending = !!g.pending;
        forward();
        const dist = g.dist - saved.turnDist;
        if (g.done) { list.push({ steps: k, dist, arrive: true }); break; }
        if (g.node === before && !wasPending) break;
        const left = opt('left');
        const right = opt('right');
        const cross = streetsAt(g.node).filter((n) => nameKey(n) !== nameKey(g.street));
        if (left || right) list.push({ steps: k, dist, street: g.street, cross, left, right });
        if (dist > 8000) break;
      }
    } finally {
      g = saved;
      quiet = false;
    }
    ahead = { key, list };
    return list;
  }

  /** Drive to the k-th stop ahead in one move, then turn (side) or just stop there. */
  function driveAhead(entry, side) {
    if (g.done) return;
    quiet = true;
    for (let k = 0; k < entry.steps && !g.done; k++) forward();
    quiet = false;
    if (g.done) return arrive();
    if (side) turn(side); else render();
  }

  let tbtKey = '';
  let tbtArrived = false; // just used "Drive to it": keep that corner selected
  function renderTurnByTurn() {
    tbt.hidden = g.done;
    if (g.done) { tbtKey = ''; return; }
    const list = lookAhead();
    if (ahead.key === tbtKey) return;
    tbtKey = ahead.key;
    const mi = (m) => `${(m / 1609.344).toFixed(2)} mi`;
    const names = (a) => (a.arrive ? '🏁 Destination' : [...new Set([a.left?.label, a.right?.label, ...a.cross].filter(Boolean))].join(' / '));
    const sel = el('select', { class: 'tbt-select', 'aria-label': 'Upcoming intersections' },
      el('option', { value: '' }, list.length ? 'Pick an intersection' : 'No intersections ahead on this road'),
      list.map((a, i) => el('option', { value: String(i) }, `${a.here ? 'Here' : mi(a.dist)} · ${names(a)}`)));
    const dl = el('datalist', { id: 'tbt-streets' },
      [...new Set(list.flatMap((a) => [a.left?.name, a.right?.name, ...(a.cross || [])]).filter(Boolean))].map((n) => el('option', { value: n })));
    const input = el('input', { class: 'tbt-input', type: 'text', list: 'tbt-streets', placeholder: 'Type the next street, e.g. W 92nd Ave', autocomplete: 'off', 'aria-label': 'Next street' });
    const note = el('small', { class: 'muted tbt-note' });
    const bLeft = el('button', { type: 'button', class: 'btn' });
    const bRight = el('button', { type: 'button', class: 'btn' });
    const bGo = el('button', { type: 'button', class: 'btn' });
    let cur = null; // the chosen intersection
    const matches = (o, typed) => o && (!typed || streetMatches(typed, o.name) || streetMatches(typed, o.label));
    function update() {
      const typed = input.value.trim();
      const okL = cur && matches(cur.left, typed);
      const okR = cur && matches(cur.right, typed);
      bLeft.disabled = !okL;
      bRight.disabled = !okR;
      bGo.disabled = !cur || cur.here;
      bLeft.textContent = okL ? `◀ Left onto ${cur.left.label}` : '◀ Turn left';
      bRight.textContent = okR ? `Right onto ${cur.right.label} ▶` : 'Turn right ▶';
      bGo.textContent = cur?.arrive ? 'Drive to the destination' : 'Drive to it';
      note.textContent = !cur
        ? (typed ? `${typed} isn't one of the intersections ahead on ${g.street || 'this road'}.` : `Distances count from your last turn. You're ${mi(g.dist - g.turnDist)} along ${g.street || 'this road'}.`)
        : cur.arrive ? `The destination is ${mi(cur.dist)} ahead.` : cur.here ? 'You\'re at this corner now: turn here.' : `${mi(cur.dist)} from your last turn${cur.cross.length ? `, at ${cur.cross.slice(0, 2).join(' & ')}` : ''}.`;
    }
    sel.onchange = () => {
      cur = sel.value === '' ? null : list[+sel.value];
      input.value = cur && !cur.arrive ? (cur.left && cur.right && cur.left.name !== cur.right.name ? '' : (cur.left || cur.right)?.name || cur.cross[0] || '') : '';
      update();
    };
    input.oninput = () => {
      const typed = input.value.trim();
      const i = typed ? list.findIndex((a) => matches(a.left, typed) && a.left || matches(a.right, typed) && a.right || (a.cross || []).some((c) => streetMatches(typed, c))) : -1;
      cur = i >= 0 ? list[i] : null;
      sel.value = i >= 0 ? String(i) : '';
      update();
    };
    input.onkeydown = (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (!bLeft.disabled && bRight.disabled) bLeft.click();
      else if (!bRight.disabled && bLeft.disabled) bRight.click();
      else if (cur) note.textContent = 'Both ways are open here: pick Left or Right.';
    };
    bLeft.onclick = () => cur && driveAhead(cur, 'left');
    bRight.onclick = () => cur && driveAhead(cur, 'right');
    bGo.onclick = () => { if (!cur) return; tbtArrived = true; driveAhead(cur, null); };
    tbt.replaceChildren(
      el('h3', {}, 'Turn-by-turn'),
      el('div', { class: 'map-dest tbt-dest' },
        el('span', { class: 'map-dest-label' }, isT ? 'Transport to' : 'Responding to'),
        el('b', {}, isT ? g.to.name : ctx.addressLabel(g.to)),
        isT && g.to.city ? el('span', { class: 'muted' }, ` · ${g.to.city}`) : null),
      el('p', { class: 'muted small' }, `On ${g.pending ? `your turn onto ${g.pending.name}` : g.street || 'an unnamed road'}, heading ${CARDINAL_NAMES[toCardinal(g.heading)]}. Pick an intersection ahead, or type the street you'll turn onto.`),
      el('div', { class: 'tbt-grid' },
        el('label', {}, el('span', { class: 'deck-label' }, 'Upcoming intersections'), sel),
        el('label', {}, el('span', { class: 'deck-label' }, 'Next street'), input, dl)),
      el('div', { class: 'row tbt-actions' }, bLeft, bGo, bRight),
      note);
    // After "Drive to it", the intersection you drove to is "Here": leave it
    // picked so Turn left / Turn right are one tap away.
    if (tbtArrived && list[0]?.here) {
      sel.value = '0';
      cur = list[0];
      update();
      const ready = [bLeft, bRight].filter((b) => !b.disabled);
      if (ready.length) ready[0].focus({ preventScroll: true });
      note.textContent = `You're at ${list[0].cross?.length ? list[0].cross.join(' & ') : 'the intersection'}: turn ${ready.length === 2 ? 'left or right' : ready[0] === bLeft ? 'left' : ready[0] === bRight ? 'right' : 'here'}.`;
    } else update();
    tbtArrived = false;
  }

  function render() {
    if (!g || quiet) return;
    syncView();
    stage.replaceChildren();
    const p = g.done ? null : preview();
    const cross = streetsAt(g.node).filter((n) => nameKey(n) !== nameKey(g.street));
    // Freeway exits: name them by number and street, on the buttons and the trip line.
    const exitHere = (freewayExits(ctx).get(g.node) || []).filter((x) => Math.abs(angleDiff(g.heading, x.along)) <= 40);
    const at = exitHere.length
      ? ` · At ${exitHere.map((x) => `${exitTab(x)} (${x.names.join(', ') || x.dest})`).join(' & ')}`
      : cross.length ? ` · At ${cross.slice(0, 2).join(' & ')}` : '';
    const elapsed = (performance.now() - g.t0) / 1000;
    const pad = (dir, arrow, label, sub, enabled, fn) => el('button', {
      type: 'button', class: `edge-pad edge-${dir}`, disabled: !enabled, onclick: fn, title: `${label}: ${sub}`, 'aria-label': `${label}: ${sub}`,
    }, el('span', { class: 'pad-arrow', 'aria-hidden': 'true' }, arrow), enabled ? el('span', { class: 'pad-sub' }, sub) : null);
    const pads = () => (g.done ? [] : [
      pad('up', '▲', 'Forward', p.ahead ? p.ahead.name : 'no road', !!p.ahead, forward),
      pad('left', '◀', 'Left', p.left ? turnLabel(p.left) : '—', !!p.left, () => turn('left')),
      pad('right', '▶', 'Right', p.right ? turnLabel(p.right) : '—', !!p.right, () => turn('right')),
      pad('down', '▼', 'Back up', p.back ? 'Back up' : '—', p.back, backward),
    ]);
    wsPads.replaceChildren(...pads());
    mapPads.replaceChildren(...pads());

    stage.append(...[
      el('div', { class: 'prompt drive-prompt' },
        isT
          ? el('div', { class: 'patient' }, el('span', { class: 'face-sub' }, 'Patient loaded at'), el('div', { class: 'patient-addr' }, ctx.addressLabel(g.from)),
            el('div', { class: 'patient-need' }, el('b', {}, g.call.complaint), ` · ${g.call.fallback ? 'no hospital that fits is switched on, so the closest one' : g.call.need.rule}`))
          : stationCard(g.station),
        el('div', { class: 'face-sub' }, isT ? 'Transport to' : 'Responding to'),
        el('div', { class: 'face-big addr' }, isT ? g.to.name : ctx.addressLabel(g.to)),
        isT ? el('small', { class: 'muted' }, g.to.city) : null,
        prefs.hints ? el('small', { class: 'hint' }, `Destination: ${gridNote(ctx, g.to.p)}. It's ${CARDINAL_NAMES[toCardinal(bearing(G.pt(g.node), g.to.p))]} of you, ${(distance(G.pt(g.node), g.to.p) / 1609.344).toFixed(1)} mi straight-line.`) : null),
      views,
      el('div', { class: 'trip-line' }, `${g.moves} moves · ${fmtTime(elapsed)}`, at),
      g.msg ? el('div', { class: 'drive-msg', role: 'status' }, g.msg) : null,
      g.done ? null : el('div', { class: 'row end' },
        el('small', { class: 'muted' }, 'Keys: ↑ forward · ↓ back · ← → turn'),
        el('button', { class: 'btn', onclick: giveUp }, 'Show me the route')),
      g.result || null,
    ].filter(Boolean));
    // Call over (arrived or "Show me the route"): drop the windshield, enlarge the map.
    views.classList.toggle('done', g.done);
    drawMap();
    renderTurnByTurn();
  }

  // Where the truck is drawn on the map: follows the windshield animation.
  let truck = null; // { p: [lat, lon], h }
  let lastFollow = 0;
  const FOLLOW_WIDTH = 2400; // meters across when the map first opens

  function mapMarkers(at) {
    return [
      isT ? { p: G.pt(g.start), color: COLORS.dest, r: 7, label: ctx.addressLabel(g.from) } : { p: [g.station.lat, g.station.lon], color: COLORS.station, text: g.station.id, r: 9, label: g.station.name },
      { p: g.done || prefs.hints ? g.to.p : null, color: isT ? COLORS.poi : COLORS.dest, r: 8, shape: isT ? 'square' : null, label: g.done || prefs.hints ? (isT ? g.to.name : ctx.addressLabel(g.to)) : '' },
      { p: at.p, color: COLORS.user, r: 8, heading: at.h },
    ].filter((m) => m.p);
  }

  // Each windshield frame: move the truck marker and keep the map centered on it.
  ws.onMove = (p, h) => {
    truck = { p, h };
    if (!g || g.done || quiet) return;
    const now = performance.now();
    if (now - lastFollow < 30) return;
    lastFollow = now;
    map.set({ markers: mapMarkers(truck) });
    map.follow(p, null, h);
  };

  function drawMap() {
    mapDest.replaceChildren(
      el('span', { class: 'map-dest-label' }, isT ? 'Transport to' : 'Responding to'),
      el('b', {}, isT ? g.to.name : ctx.addressLabel(g.to)),
      isT && g.to.city ? el('span', { class: 'muted' }, ` · ${g.to.city}`) : null);
    const at = !g.done && truck ? truck : { p: G.pt(g.node), h: g.heading };
    const routes = [{ pts: g.trail, color: COLORS.user, width: 4 }];
    if (g.done) routes.unshift({ pts: G.pathPoints(g.best.path), color: COLORS.best, width: 6, alpha: 0.5 });
    map.set({ routes, markers: mapMarkers(at) });
    // Heading-up while driving, with the truck low on the map so you see what's ahead.
    // The finished call fits the whole drive, north up.
    if (g.done) map.fit([...g.trail, ...G.pathPoints(g.best.path)]);
    else if (!g.fitted) { map.orient({ anchorY: 0.66 }); map.follow(at.p, FOLLOW_WIDTH, at.h); g.fitted = true; } else map.follow(at.p, null, at.h);
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
      isT ? el('p', { class: 'why-hospital' },
        `${g.call.complaint}: ${g.call.fallback ? 'no hospital that fits was switched on, so the closest one' : g.call.need.rule}. `,
        `Closest from the scene: ${g.call.options.map((o) => `${o.h.name} ${driveTime(o.t)}`).join(', ')}.`) : null,
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
      ahead: () => lookAhead(),
      peek(seq) {
        const saved = { ...g, trail: g.trail.slice() };
        quiet = true;
        try {
          for (const a of seq) { if (!g.done) acts[a](); }
          return { node: g.node, street: g.street, pending: !!g.pending, done: g.done, cost: g.cost, heading: g.heading, moved: g.node !== saved.node || !!g.pending !== !!saved.pending || Math.abs(angleDiff(g.heading, saved.heading)) > 1 };
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
