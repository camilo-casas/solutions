// Windshield view for Responder and Transporter: a driver's-eye perspective
// of the real road network drawn on a 2D canvas (no 3D library), with
// green street-name blades at intersections, the Front Range on the western
// horizon, a small compass and a trip odometer.

import { makeProjection, bearing, angleDiff, toCardinal } from './lib/geo.js';
import { shortName } from './lib/names.js';
import { el } from './ui.js';

const RAD = Math.PI / 180;
const FAR = 750; // meters drawn
const NEAR = 0.6;
const CAM_H = 2.7; // fire-engine seat height, meters
const BACK = 16; // camera sits this far behind the truck's position (at the stop line)
const CELL = 200;
const WIDTH = { motorway: 15, trunk: 13, primary: 13, secondary: 11, tertiary: 9.5, link: 6.5, unclassified: 7.5, residential: 7.5 };
const MAJOR = new Set(['motorway', 'trunk', 'primary', 'secondary']);
const WALLS = ['#cdbca3', '#b9927a', '#a9aba5', '#d8ccb7', '#9a8875', '#c4b39a', '#b5a58f'];
const ROOFS = ['#5d4c44', '#4f5358', '#6e5241', '#5a4f4a'];

// ---- Scene data, built once per city and cached on the shared context ------
function buildScene(ctx) {
  const G = ctx.graph;
  const proj = makeProjection(ctx.city.meta.origin);
  const xy = (n) => proj.fwd(G.pt(n));
  const cells = new Map();
  const put = (x, y, item, key) => {
    const k = `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
    let c = cells.get(k);
    if (!c) { c = { segs: [], houses: [], signs: [] }; cells.set(k, c); }
    c[key].push(item);
  };
  const segs = [];
  const houses = [];
  let seed = 1;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (const [ni, cls, , nodes] of ctx.city.ways) {
    const w = WIDTH[cls] || 7;
    for (let i = 0; i + 1 < nodes.length; i++) {
      const [ax, ay] = xy(nodes[i]);
      const [bx, by] = xy(nodes[i + 1]);
      const len = Math.hypot(bx - ax, by - ay);
      if (len < 0.5) continue;
      const s = { ax, ay, bx, by, w, cls, major: MAJOR.has(cls), len };
      segs.push(s);
      // Index the segment in every cell it passes through (sampled every half cell).
      const steps = Math.ceil(len / (CELL / 2));
      const seen = new Set();
      for (let k = 0; k <= steps; k++) {
        const x = ax + ((bx - ax) * k) / steps;
        const y = ay + ((by - ay) * k) / steps;
        const key = `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
        if (!seen.has(key)) { seen.add(key); put(x, y, s, 'segs'); }
      }
      // Simple houses along residential streets, for depth.
      if ((cls === 'residential' || cls === 'unclassified') && len > 40 && ni >= 0) {
        const ux = (bx - ax) / len;
        const uy = (by - ay) / len;
        for (let d = 18; d < len - 18; d += 24 + rnd() * 8) {
          for (const side of [-1, 1]) {
            if (rnd() < 0.18) continue;
            const off = w / 2 + 11 + rnd() * 5;
            const cx = ax + ux * d - uy * off * side;
            const cy = ay + uy * d + ux * off * side;
            const h = { cx, cy, ux, uy, hw: 6 + rnd() * 3, hd: 5 + rnd() * 2.5, ht: 4 + rnd() * 3.5, wall: WALLS[Math.floor(rnd() * WALLS.length)], roof: ROOFS[Math.floor(rnd() * ROOFS.length)] };
            houses.push(h);
            put(cx, cy, h, 'houses');
          }
        }
      }
    }
  }
  // Drop houses that would sit on top of another road (near intersections).
  for (const c of cells.values()) {
    c.houses = c.houses.filter((h) => !c.segs.some((sg) => {
      const dx = sg.bx - sg.ax;
      const dy = sg.by - sg.ay;
      const t = Math.max(0, Math.min(1, ((h.cx - sg.ax) * dx + (h.cy - sg.ay) * dy) / (sg.len * sg.len)));
      return Math.hypot(sg.ax + dx * t - h.cx, sg.ay + dy * t - h.cy) < sg.w / 2 + Math.max(h.hw, h.hd) + 1;
    }));
  }

  // Street-sign corners: base nodes where two or more named streets meet.
  for (let n = 0; n < G.base; n++) {
    const names = new Map();
    for (const e of [...G.out[n], ...G.inc[n]]) {
      const ed = G.edges[e];
      if (!ed.name) continue;
      const nm = shortName(ed.name);
      if (!names.has(nm)) names.set(nm, bearing(G.pt(ed.from), G.pt(ed.to)));
    }
    if (names.size < 2) continue;
    const [x, y] = xy(n);
    put(x, y, { x, y, n, names }, 'signs');
  }
  return { proj, cells, xy, segs, houses };
}

export class Windshield {
  constructor(ctx, { vehicle = 'engine' } = {}) {
    this.ctx = ctx;
    this.G = ctx.graph;
    ctx.scene ??= buildScene(ctx);
    this.scene = ctx.scene;
    this.vehicle = vehicle;
    this.canvas = el('canvas', { class: 'ws-canvas', 'aria-label': 'Windshield view' });
    this.needle = null;
    this.compassEl = el('div', { class: 'ws-compass' });
    this.compassEl.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29" class="wsc-ring"/>
      <text x="32" y="15" class="wsc-l n">N</text><text x="52" y="36" class="wsc-l">E</text><text x="32" y="56" class="wsc-l">S</text><text x="12" y="36" class="wsc-l">W</text>
      <g class="wsc-needle"><path d="M32 9 L37 33 L32 30 L27 33 Z" class="wsc-n"/><path d="M32 55 L36 33 L32 35 L28 33 Z" class="wsc-s"/></g><circle cx="32" cy="32" r="3" class="wsc-hub"/></svg>
      <span class="wsc-text"></span>`;
    this.needle = this.compassEl.querySelector('.wsc-needle');
    this.compassText = this.compassEl.querySelector('.wsc-text');
    this.odoDigits = el('span', { class: 'ws-odo-digits' });
    this.odoEl = el('div', { class: 'ws-odo' }, el('span', { class: 'ws-odo-label' }, 'Trip'), this.odoDigits, el('span', { class: 'ws-odo-unit' }, 'mi'));
    this.chip = el('div', { class: 'ws-chip' });
    this.el = el('div', { class: `windshield ${vehicle}` }, this.canvas, this.chip, this.compassEl, this.odoEl);
    this.cam = { x: 0, y: 0, h: 0 };
    this.anchor = [0, 0];
    this.heading = 0;
    this.dist = 0;
    this.shownDist = 0;
    this.anim = null;
    this.target = null;
    this.ro = new ResizeObserver(() => this.draw());
    this.ro.observe(this.canvas);
  }

  destroy() {
    this.ro.disconnect();
    cancelAnimationFrame(this.raf);
  }

  /** Jump to a position without animating (start of a call). */
  reset({ node, heading, street, dist = 0, target = null, targetLabel = '' }) {
    this.anim = null;
    this.anchor = this.scene.xy(node);
    this.heading = heading;
    this.dist = dist;
    this.shownDist = dist;
    this.target = target != null ? { p: this.scene.proj.fwd(target), label: targetLabel } : null;
    this.setStreet(street, false);
    this.place(this.anchor, heading);
    this.draw();
  }

  setStreet(street, turning) {
    this.chip.replaceChildren(el('small', {}, turning ? 'Turning onto' : 'On'), el('b', {}, street || 'unnamed road'));
  }

  place([x, y], h) {
    this.cam = { x: x - BACK * Math.sin(h * RAD), y: y - BACK * Math.cos(h * RAD), h };
  }

  /**
   * Animate to the game's new state.
   * kind: 'forward' | 'back' | 'turn'. pts: [lat, lon] points driven, starting at the old position.
   */
  go({ kind, pts = [], heading, street, turning = false, dist }) {
    this.finishAnim();
    this.setStreet(street, turning);
    const from = { anchor: this.anchor, heading: this.heading, dist: this.shownDist };
    const path = pts.map((p) => this.scene.proj.fwd(p));
    if (kind === 'turn' || path.length < 2) {
      const delta = angleDiff(this.heading, heading);
      if (path.length >= 2) this.anchor = path[path.length - 1];
      this.anim = { kind: 'turn', t0: performance.now(), dur: 380 + Math.abs(delta) * 2, from, delta, toHeading: heading, toAnchor: this.anchor, toDist: dist };
    } else {
      const cum = [0];
      for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
      const total = cum[cum.length - 1];
      this.anim = { kind, t0: performance.now(), dur: Math.min(2600, Math.max(450, total / 0.028)), from, path, cum, total, toHeading: heading, toAnchor: path[path.length - 1], toDist: dist };
    }
    this.heading = heading;
    this.anchor = this.anim.toAnchor;
    this.dist = dist;
    this.loop();
  }

  finishAnim() {
    if (!this.anim) return;
    const a = this.anim;
    this.anim = null;
    this.shownDist = a.toDist;
    this.place(a.toAnchor, a.toHeading);
  }

  loop() {
    cancelAnimationFrame(this.raf);
    const step = (now) => {
      const a = this.anim;
      if (!a) { this.draw(); return; }
      let t = Math.min(1, (now - a.t0) / a.dur);
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; // ease in-out
      if (a.kind === 'turn') {
        this.place(a.toAnchor ?? a.from.anchor, a.from.heading + a.delta * e);
      } else {
        const s = a.total * e;
        const at = (d) => {
          d = Math.max(0, Math.min(a.total, d));
          let i = 1;
          while (i < a.cum.length - 1 && a.cum[i] < d) i++;
          const k = (d - a.cum[i - 1]) / Math.max(1e-6, a.cum[i] - a.cum[i - 1]);
          return [a.path[i - 1][0] + (a.path[i][0] - a.path[i - 1][0]) * k, a.path[i - 1][1] + (a.path[i][1] - a.path[i - 1][1]) * k];
        };
        const p = at(s);
        let h;
        if (a.kind === 'back') h = a.from.heading;
        else {
          // Look a little down the road so curves and corners turn smoothly.
          const q = at(s + 10);
          const travel = Math.hypot(q[0] - p[0], q[1] - p[1]) > 1 ? (Math.atan2(q[0] - p[0], q[1] - p[1]) / RAD + 360) % 360 : a.toHeading;
          h = t > 0.85 ? travel + angleDiff(travel, a.toHeading) * ((t - 0.85) / 0.15) : travel;
        }
        this.place(p, h);
      }
      this.shownDist = a.from.dist + (a.toDist - a.from.dist) * e;
      this.draw(true);
      if (t >= 1) { this.anim = null; this.shownDist = a.toDist; this.draw(true); return; }
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  draw(now = false) {
    if (now) { this.paint(); return; }
    cancelAnimationFrame(this.raf2);
    this.raf2 = requestAnimationFrame(() => this.paint());
  }

  // ---- Rendering ----------------------------------------------------------
  paint() {
    const c = this.canvas;
    const rect = c.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(rect.width * dpr) || c.height !== Math.round(rect.height * dpr)) {
      c.width = Math.round(rect.width * dpr);
      c.height = Math.round(rect.height * dpr);
    }
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = rect.width;
    const H = rect.height;
    const HZ = H * 0.42; // horizon line
    const F = (W / 2) / Math.tan(35 * RAD); // 70° horizontal field of view
    const { x: cx, y: cy, h } = this.cam;
    const sn = Math.sin(h * RAD);
    const cs = Math.cos(h * RAD);
    const cam = (x, y, up = 0) => { const dx = x - cx; const dy = y - cy; return [dx * cs - dy * sn, up, dx * sn + dy * cs]; };
    const scr = ([xr, up, z]) => [W / 2 + (F * xr) / z, HZ - (F * (up - CAM_H)) / z];

    // Sky, mountains, ground.
    const sky = g.createLinearGradient(0, 0, 0, HZ);
    sky.addColorStop(0, '#5f9fd8');
    sky.addColorStop(1, '#cfe1ef');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, HZ + 1);
    this.paintMountains(g, W, HZ, F, h);
    const ground = g.createLinearGradient(0, HZ, 0, H);
    ground.addColorStop(0, '#b9bfa6');
    ground.addColorStop(0.25, '#9fa982');
    ground.addColorStop(1, '#7f8f5e');
    g.fillStyle = ground;
    g.fillRect(0, HZ, W, H - HZ);

    // Gather nearby items from the grid.
    const segs = new Set();
    const houses = [];
    const signs = [];
    const r = Math.ceil(FAR / CELL);
    const gx = Math.floor(cx / CELL);
    const gy = Math.floor(cy / CELL);
    for (let i = -r; i <= r; i++) {
      for (let j = -r; j <= r; j++) {
        const cell = this.scene.cells.get(`${gx + i},${gy + j}`);
        if (!cell) continue;
        for (const s of cell.segs) segs.add(s);
        for (const hs of cell.houses) houses.push(hs);
        for (const sg of cell.signs) signs.push(sg);
      }
    }

    const fog = (z) => Math.min(1, Math.max(0, (z - 120) / (FAR - 120)));
    const mix = (hex, t, to = [205, 214, 206]) => {
      const n = parseInt(hex.slice(1), 16);
      const cr = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v, k) => Math.round(v + (to[k] - v) * t));
      return `rgb(${cr[0]},${cr[1]},${cr[2]})`;
    };
    const poly = (pts3, fill) => {
      const clipped = clip(pts3);
      if (clipped.length < 3) return false;
      g.beginPath();
      clipped.forEach((p, i) => { const [sx, sy] = scr(p); if (i) g.lineTo(sx, sy); else g.moveTo(sx, sy); });
      g.closePath();
      g.fillStyle = fill;
      g.fill();
      return true;
    };

    // Roads, far to near.
    const roadPolys = [];
    for (const s of segs) {
      const A = cam(s.ax, s.ay);
      const B = cam(s.bx, s.by);
      if (A[2] < NEAR && B[2] < NEAR) continue;
      const zMid = (A[2] + B[2]) / 2;
      if (Math.min(A[2], B[2]) > FAR) continue;
      roadPolys.push({ s, A, B, z: zMid });
    }
    roadPolys.sort((a, b) => b.z - a.z);
    for (const { s, z } of roadPolys) {
      const ux = (s.bx - s.ax) / s.len;
      const uy = (s.by - s.ay) / s.len;
      const nx = -uy * (s.w / 2);
      const ny = ux * (s.w / 2);
      // Extend each piece a little so joints between pieces don't show gaps.
      const ex = ux * 1.5;
      const ey = uy * 1.5;
      const pts = [cam(s.ax + nx - ex, s.ay + ny - ey), cam(s.bx + nx + ex, s.by + ny + ey), cam(s.bx - nx + ex, s.by - ny + ey), cam(s.ax - nx - ex, s.ay - ny - ey)];
      poly(pts, mix(s.major ? '#3c3f44' : '#55585d', fog(z)));
    }
    // Center line on main roads: a thin painted stripe on the road surface.
    for (const { s, z } of roadPolys) {
      if (!s.major || z > 450) continue;
      const ux = (s.bx - s.ax) / s.len;
      const uy = (s.by - s.ay) / s.len;
      const nx = -uy * 0.18;
      const ny = ux * 0.18;
      poly([cam(s.ax + nx, s.ay + ny, 0.02), cam(s.bx + nx, s.by + ny, 0.02), cam(s.bx - nx, s.by - ny, 0.02), cam(s.ax - nx, s.ay - ny, 0.02)], mix('#e0b83a', fog(z)));
    }

    // Destination beacon.
    if (this.target) {
      const [tx, ty] = this.target.p;
      const base = cam(tx, ty, 0);
      if (base[2] > NEAR && base[2] < 900) {
        const top = cam(tx, ty, 14);
        const [bx, by] = scr(base);
        const [, ty2] = scr(top);
        const wpx = Math.max(2, (F * 0.6) / base[2]);
        g.fillStyle = '#c1121f';
        g.fillRect(bx - wpx / 2, ty2, wpx, by - ty2);
        g.beginPath();
        g.arc(bx, ty2, wpx * 1.6, 0, Math.PI * 2);
        g.fillStyle = '#f2b705';
        g.fill();
        if (base[2] < 600) this.blade(g, bx, ty2 - wpx * 2 - 4, Math.max(10, Math.min(18, (F * 1.4) / base[2])), this.target.label, '#c1121f', '#fff');
      }
    }

    // Houses, far to near.
    const visHouses = [];
    for (const hs of houses) {
      const c0 = cam(hs.cx, hs.cy);
      if (c0[2] < 2 || c0[2] > 420 || Math.abs(c0[0]) > c0[2] * 1.4 + 20) continue;
      visHouses.push({ hs, z: c0[2] });
    }
    visHouses.sort((a, b) => b.z - a.z);
    for (const { hs, z } of visHouses) this.paintHouse(g, hs, cam, poly, mix, fog(z), cx, cy);

    // Street signs at intersections ahead, far to near.
    const visSigns = [];
    for (const sg of signs) {
      // Sign stands on the near right corner as seen from the truck.
      const px = sg.x + 7.5 * cs - 6 * sn;
      const py = sg.y - 7.5 * sn - 6 * cs;
      const c0 = cam(px, py);
      if (c0[2] < 3 || c0[2] > 320 || Math.abs(c0[0]) > c0[2] * 1.3) continue;
      visSigns.push({ sg, px, py, z: c0[2] });
    }
    visSigns.sort((a, b) => b.z - a.z);
    for (const v of visSigns) this.paintSign(g, v, cam, scr, F, h);

    this.paintHood(g, W, H);

    // Overlays: compass and odometer.
    this.needle.setAttribute('transform', `rotate(${h.toFixed(1)} 32 32)`);
    this.compassText.textContent = toCardinal(h);
    const miles = Math.max(0, this.shownDist / 1609.344);
    this.odoDigits.replaceChildren(...miles.toFixed(2).padStart(6, '0').split('').map((ch) => el('span', { class: ch === '.' ? 'dot' : 'dig' }, ch)));
  }

  paintMountains(g, W, HZ, F, h) {
    // The Front Range sits to the west: draw it wherever west is in view.
    g.beginPath();
    g.moveTo(0, HZ + 1);
    let any = false;
    for (let x = 0; x <= W; x += 3) {
      const brg = (h + Math.atan((x - W / 2) / F) / RAD + 360) % 360;
      const west = Math.cos((brg - 270) * RAD); // 1 due west, 0 north/south
      let ht = 0;
      if (west > 0) {
        any = true;
        const ridge = 0.55 + 0.25 * Math.sin(brg * 0.37) + 0.15 * Math.sin(brg * 1.31 + 1) + 0.08 * Math.sin(brg * 3.7);
        ht = Math.max(0, west ** 0.6 * ridge) * HZ * 0.16;
      }
      g.lineTo(x, HZ - ht);
    }
    g.lineTo(W, HZ + 1);
    g.closePath();
    if (!any) return;
    const m = g.createLinearGradient(0, HZ - HZ * 0.16, 0, HZ);
    m.addColorStop(0, '#8b9bb3');
    m.addColorStop(1, '#a9b6c6');
    g.fillStyle = m;
    g.fill();
  }

  paintHouse(g, hs, cam, poly, mix, f, cx, cy) {
    const { cx: x, cy: y, ux, uy, hw, hd, ht } = hs;
    // Footprint corners (along-street ux,uy; across -uy,ux).
    const corners = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([a, b]) => [x + ux * a - uy * b, y + uy * a + ux * b]);
    // Walls whose outward normal faces the camera.
    for (let i = 0; i < 4; i++) {
      const p = corners[i];
      const q = corners[(i + 1) % 4];
      const mx = (p[0] + q[0]) / 2;
      const my = (p[1] + q[1]) / 2;
      const nx = mx - x;
      const ny = my - y;
      if (nx * (cx - mx) + ny * (cy - my) <= 0) continue;
      const shade = i % 2 ? 0.0 : 0.12;
      poly([cam(p[0], p[1], 0), cam(q[0], q[1], 0), cam(q[0], q[1], ht), cam(p[0], p[1], ht)], mix(darken(hs.wall, shade), f));
    }
    // Pitched roof: two slopes meeting at a ridge along the street direction.
    const r1 = [x - ux * hw, y - uy * hw];
    const r2 = [x + ux * hw, y + uy * hw];
    const rt = ht + 2.6;
    const halves = [[corners[0], corners[1]], [corners[3], corners[2]]];
    for (const [a, b] of halves) {
      const mx = (a[0] + b[0]) / 2;
      const my = (a[1] + b[1]) / 2;
      const nx = mx - x;
      const ny = my - y;
      const facing = nx * (cx - mx) + ny * (cy - my) > 0;
      poly([cam(a[0], a[1], ht), cam(b[0], b[1], ht), cam(r2[0], r2[1], rt), cam(r1[0], r1[1], rt)], mix(darken(hs.roof, facing ? 0 : 0.15), f));
    }
  }

  paintSign(g, { sg, px, py, z }, cam, scr, F, h) {
    const base = cam(px, py, 0);
    const top = cam(px, py, 3.6);
    const [bx, by] = scr(base);
    const [tx, ty] = scr(top);
    const poleW = Math.max(1, (F * 0.09) / z);
    g.fillStyle = '#8d9196';
    g.fillRect(bx - poleW / 2, ty, poleW, by - ty);
    // The blade facing us names the cross street; the one along our road names ours.
    let cross = null;
    let along = null;
    for (const [nm, brg] of sg.names) {
      const rel = Math.abs(angleDiff(h, brg)) % 180;
      const perp = Math.abs(90 - rel);
      if (!cross || perp < cross.perp) cross = { nm, brg, perp };
    }
    for (const [nm] of sg.names) if (nm !== cross.nm) { along = nm; break; }
    const px1 = (F * 1) / z; // pixels per meter at this depth
    const size = Math.max(4, Math.min(22, px1 * 0.42));
    if (size < 5) {
      g.fillStyle = '#0f6b3a';
      g.fillRect(tx - px1 * 1.2, ty, px1 * 2.4, Math.max(1.5, px1 * 0.3));
      return;
    }
    const block = this.blockNumber(sg, cross.brg);
    this.blade(g, tx, ty, size, cross.nm, '#0f6b3a', '#fff', block);
    if (along) this.blade(g, tx, ty + size * 1.45, size * 0.8, along, '#0f6b3a', '#fff', this.blockNumber(sg, sg.names.get(along)));
  }

  /** Hundred block shown on a blade, like Westminster's signs (E-W streets show W numbers). */
  blockNumber(sg, brg) {
    const grid = this.ctx.grid;
    const [lat, lon] = this.scene.proj.inv([sg.x, sg.y]);
    const ew = Math.abs(Math.sin(brg * RAD)) > Math.abs(Math.cos(brg * RAD));
    const n = ew ? grid.westNumber(lon) : grid.northNumber(lat);
    if (!(n > 0 && n < 20000)) return '';
    return String(Math.floor(n / 100) * 100);
  }

  blade(g, cx, top, size, text, bg, fg, small = '') {
    g.font = `700 ${size}px "Barlow Semi Condensed", "Arial Narrow", system-ui, sans-serif`;
    const tw = g.measureText(text).width;
    g.font = `600 ${size * 0.55}px "Barlow", system-ui, sans-serif`;
    const sw = small ? g.measureText(small).width + size * 0.5 : 0;
    const w = tw + sw + size * 0.9;
    const hgt = size * 1.3;
    // Keep the blade inside the windshield.
    const x = Math.max(this.canvas.clientWidth * 0.06, Math.min(cx - w / 2, this.canvas.clientWidth * 0.94 - w));
    g.fillStyle = bg;
    g.strokeStyle = fg;
    g.lineWidth = Math.max(1, size * 0.08);
    roundRect(g, x, top, w, hgt, size * 0.18);
    g.fill();
    roundRect(g, x + size * 0.1, top + size * 0.1, w - size * 0.2, hgt - size * 0.2, size * 0.12);
    g.stroke();
    g.fillStyle = fg;
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.font = `700 ${size}px "Barlow Semi Condensed", "Arial Narrow", system-ui, sans-serif`;
    g.fillText(text, x + size * 0.45, top + hgt / 2 + size * 0.04);
    if (small) {
      g.font = `600 ${size * 0.55}px "Barlow", system-ui, sans-serif`;
      g.fillText(small, x + size * 0.45 + tw + size * 0.35, top + hgt / 2 + size * 0.06);
    }
  }

  paintHood(g, W, H) {
    // WFD apparatus are white, black and gold: white hood, black band, gold pinstripe.
    const top = H * 0.885;
    const grad = g.createLinearGradient(0, top, 0, H);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.55, '#ecebe8');
    grad.addColorStop(1, '#c9c6c0');
    g.beginPath();
    g.moveTo(0, H);
    g.lineTo(0, top + H * 0.05);
    g.quadraticCurveTo(W / 2, top - H * 0.035, W, top + H * 0.05);
    g.lineTo(W, H);
    g.closePath();
    g.fillStyle = grad;
    g.fill();
    const band = (dy, color, width) => {
      g.beginPath();
      g.moveTo(0, top + H * 0.05 + dy);
      g.quadraticCurveTo(W / 2, top - H * 0.035 + dy, W, top + H * 0.05 + dy);
      g.strokeStyle = color;
      g.lineWidth = width;
      g.stroke();
    };
    band(H * 0.045, '#14110f', Math.max(5, H * 0.03));
    band(H * 0.024, '#f2b705', Math.max(1.5, H * 0.006));
    // Windshield frame.
    g.fillStyle = '#16120f';
    g.beginPath();
    g.moveTo(0, 0); g.lineTo(W * 0.045, 0); g.lineTo(0, H * 0.75); g.closePath(); g.fill();
    g.beginPath();
    g.moveTo(W, 0); g.lineTo(W * 0.955, 0); g.lineTo(W, H * 0.75); g.closePath(); g.fill();
    g.fillRect(0, 0, W, Math.max(6, H * 0.025));
  }
}

function darken(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * (1 - t)));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Clip a camera-space polygon to the near plane (z >= NEAR). */
function clip(pts) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const ain = a[2] >= NEAR;
    const bin = b[2] >= NEAR;
    if (ain) out.push(a);
    if (ain !== bin) {
      const t = (NEAR - a[2]) / (b[2] - a[2]);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]);
    }
  }
  return out;
}

function clipLine(a, b) {
  if (a[2] < NEAR && b[2] < NEAR) return null;
  if (a[2] >= NEAR && b[2] >= NEAR) return [a, b];
  const t = (NEAR - a[2]) / (b[2] - a[2]);
  const m = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR];
  return a[2] < NEAR ? [m, b] : [a, m];
}
