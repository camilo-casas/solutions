// Canvas street map drawn straight from city.json (no tiles, no labels
// unless asked) so it can't give away answers mid-question.

import { makeProjection } from './lib/geo.js';
import { shortName } from './lib/names.js';

const WIDTH = { trunk: 3, primary: 3, secondary: 2.4, tertiary: 1.8, link: 1.2, motorway: 3.4, residential: 1, unclassified: 1, service: 0.6 };
const MAJOR = new Set(['motorway', 'trunk', 'primary', 'secondary']);
// Streets labeled in "major names only" mode: freeways, highways and arterials.
const LABEL_MAJOR = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary']);

export class CityMap {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.city = ctx.city;
    this.proj = makeProjection(ctx.city.meta.origin);
    const n = ctx.city.nodes.length / 2;
    this.xs = new Float64Array(n);
    this.ys = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const [x, y] = this.proj.fwd([ctx.city.nodes[2 * i], ctx.city.nodes[2 * i + 1]]);
      this.xs[i] = x; this.ys[i] = y;
    }
    this.ways = ctx.city.ways.map(([ni, cls, , nodes]) => ({ name: ni >= 0 ? shortName(ctx.city.names[ni]) : '', cls, nodes }));
    this.order = [...this.ways.keys()].sort((a, b) => (MAJOR.has(this.ways[a].cls) ? 1 : 0) - (MAJOR.has(this.ways[b].cls) ? 1 : 0));
    this.boundary = ctx.city.boundary.map((r) => r.map((p) => this.proj.fwd(p)));
    this.layers = { markers: [], routes: [], labels: false };
    // rot: the compass heading that points up the screen (0 = north up).
    // anchorY: where the followed point sits, as a fraction of the height.
    this.view = { cx: 0, cy: 0, scale: 0.05, rot: 0, anchorY: 0.5 };
    this.onclick = null;
    this.bind();
    this.ro = new ResizeObserver(() => {
      // A follow request made while hidden wins over the initial fit-to-city.
      if (this.pendingFollow && this.canvas.getBoundingClientRect().width) {
        const f = this.pendingFollow;
        this.pendingFollow = null;
        this.pending = null;
        this.follow(...f);
      } else if (this.pending) this.fitXY(...this.pending);
      else this.draw();
    });
    this.ro.observe(canvas);
    this.fitBoundary();
  }

  destroy() { this.ro.disconnect(); }

  set(layers) {
    this.layers = { ...this.layers, ...layers };
    this.draw();
  }

  fitBoundary() {
    const pts = this.boundary.flat();
    this.fitXY(pts, 10);
  }

  /**
   * Center on [lat, lon]; optionally set the zoom so the map spans `widthM` meters
   * across, and turn it so `heading` (degrees) points up.
   */
  follow(latlon, widthM = null, heading = null) {
    if (heading != null) this.view.rot = heading;
    const r = this.canvas.getBoundingClientRect();
    if (!r.width) { this.pendingFollow = [latlon, widthM ?? this.pendingFollow?.[1] ?? null]; this.pending = null; return; }
    this.pending = null;
    const [x, y] = this.proj.fwd(latlon);
    this.view.cx = x;
    this.view.cy = y;
    if (widthM) this.view.scale = r.width / widthM;
    this.draw();
  }

  /** Heading-up or north-up, and where the followed point sits (0.5 = middle). */
  orient({ heading = this.view.rot, anchorY = this.view.anchorY } = {}) {
    this.view.rot = heading;
    this.view.anchorY = anchorY;
    this.draw();
  }

  /** Zoom to show [lat, lon] points. */
  fit(latlons, padPx = 40) {
    if (!latlons.length) return this.fitBoundary();
    this.fitXY(latlons.map((p) => this.proj.fwd(p)), padPx);
  }

  fitXY(pts, padPx) {
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const r = this.canvas.getBoundingClientRect();
    if (!r.width) { this.pending = [pts, padPx]; return; }
    this.pending = null;
    this.pendingFollow = null;
    const w = Math.max(r.width, 100) - 2 * padPx;
    const h = Math.max(r.height, 100) - 2 * padPx;
    if (this.view.rot || this.view.anchorY !== 0.5) {
      // Fitting shows the whole picture: north up, centered.
      this.view.rot = 0;
      this.view.anchorY = 0.5;
    }
    this.view.cx = (x0 + x1) / 2;
    this.view.cy = (y0 + y1) / 2;
    this.view.scale = Math.min(w / Math.max(x1 - x0, 300), h / Math.max(y1 - y0, 300));
    this.draw();
  }

  toScreen(x, y) {
    const r = this.size;
    const v = this.view;
    const dx = x - v.cx;
    const dy = y - v.cy;
    const a = (v.rot * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    return [r.w / 2 + (dx * c - dy * s) * v.scale, r.h * v.anchorY - (dx * s + dy * c) * v.scale];
  }

  toWorld(sx, sy) {
    const r = this.size;
    const v = this.view;
    const u = (sx - r.w / 2) / v.scale;
    const f = -(sy - r.h * v.anchorY) / v.scale;
    const a = (v.rot * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    return [v.cx + u * c + f * s, v.cy - u * s + f * c];
  }

  bind() {
    const c = this.canvas;
    const pts = new Map();
    let moved = 0;
    let pinch = null;
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, [e.offsetX, e.offsetY]);
      moved = 0;
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: this.view.scale };
      }
    });
    c.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId);
      pts.set(e.pointerId, [e.offsetX, e.offsetY]);
      if (pts.size === 2 && pinch) {
        const [a, b] = [...pts.values()];
        this.view.scale = pinch.s * (Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d);
        moved += 10;
      } else if (pts.size === 1) {
        moved += Math.abs(e.offsetX - prev[0]) + Math.abs(e.offsetY - prev[1]);
        const a = this.toWorld(...prev);
        const b = this.toWorld(e.offsetX, e.offsetY);
        this.view.cx += a[0] - b[0];
        this.view.cy += a[1] - b[1];
      }
      this.draw();
    });
    const end = (e) => {
      if (pts.size === 1 && moved < 6 && this.onclick) {
        const [x, y] = this.toWorld(e.offsetX, e.offsetY);
        this.onclick(this.proj.inv([x, y]));
      }
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', (e) => { pts.delete(e.pointerId); pinch = null; });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });
  }

  zoomAt(sx, sy, f) {
    const before = this.toWorld(sx, sy);
    this.view.scale *= f;
    const after = this.toWorld(sx, sy);
    this.view.cx += before[0] - after[0];
    this.view.cy += before[1] - after[1];
    this.draw();
  }

  zoom(f) {
    const r = this.size;
    this.zoomAt(r.w / 2, r.h / 2, f);
  }

  draw() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.paint(); });
  }

  paint() {
    const c = this.canvas;
    const rect = c.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = window.devicePixelRatio || 1;
    this.size = { w: rect.width, h: rect.height };
    if (c.width !== Math.round(rect.width * dpr) || c.height !== Math.round(rect.height * dpr)) {
      c.width = Math.round(rect.width * dpr);
      c.height = Math.round(rect.height * dpr);
    }
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(c);
    const col = (v) => css.getPropertyValue(v).trim();
    g.fillStyle = col('--map-bg');
    g.fillRect(0, 0, rect.width, rect.height);

    // City boundary.
    g.beginPath();
    for (const ring of this.boundary) {
      ring.forEach(([x, y], i) => {
        const [sx, sy] = this.toScreen(x, y);
        if (i) g.lineTo(sx, sy); else g.moveTo(sx, sy);
      });
      g.closePath();
    }
    g.fillStyle = col('--map-city');
    g.fill('evenodd');
    g.strokeStyle = col('--map-boundary');
    g.lineWidth = 1.5;
    g.setLineDash([6, 4]);
    g.stroke();
    g.setLineDash([]);

    // Roads.
    const zoomW = Math.min(2.2, Math.max(0.6, this.view.scale * 12));
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const roadCol = col('--map-road');
    const majorCol = col('--map-road-major');
    for (const wi of this.order) {
      const w = this.ways[wi];
      if (w.cls === 'residential' && this.view.scale < 0.03) continue;
      g.beginPath();
      w.nodes.forEach((n, i) => {
        const [sx, sy] = this.toScreen(this.xs[n], this.ys[n]);
        if (i) g.lineTo(sx, sy); else g.moveTo(sx, sy);
      });
      g.strokeStyle = MAJOR.has(w.cls) ? majorCol : roadCol;
      g.lineWidth = (WIDTH[w.cls] || 1) * zoomW;
      g.stroke();
    }

    // Routes.
    for (const r of this.layers.routes) {
      if (!r.pts || r.pts.length < 2) continue;
      g.beginPath();
      r.pts.forEach((p, i) => {
        const [x, y] = this.proj.fwd(p);
        const [sx, sy] = this.toScreen(x, y);
        if (i) g.lineTo(sx, sy); else g.moveTo(sx, sy);
      });
      g.strokeStyle = r.color;
      g.lineWidth = r.width || 5;
      g.globalAlpha = r.alpha ?? 0.9;
      g.setLineDash(r.dash || []);
      g.stroke();
      g.setLineDash([]);
      g.globalAlpha = 1;
    }

    if (this.layers.labels) this.paintLabels(g, col('--map-label'), col('--map-bg'));
    if (this.view.rot) this.paintNorth(g, col('--map-label'), col('--map-bg'));

    // Markers.
    g.font = '600 12px system-ui, sans-serif';
    for (const m of this.layers.markers) {
      const [x, y] = this.proj.fwd(m.p);
      const [sx, sy] = this.toScreen(x, y);
      const r = m.r || 7;
      if (m.heading != null) {
        const a = ((m.heading - this.view.rot - 90) * Math.PI) / 180;
        g.beginPath();
        g.moveTo(sx + Math.cos(a) * (r + 12), sy + Math.sin(a) * (r + 12));
        g.lineTo(sx + Math.cos(a + 2.6) * (r + 2), sy + Math.sin(a + 2.6) * (r + 2));
        g.lineTo(sx + Math.cos(a - 2.6) * (r + 2), sy + Math.sin(a - 2.6) * (r + 2));
        g.closePath();
        g.fillStyle = m.color;
        g.fill();
      }
      g.beginPath();
      if (m.shape === 'square') g.rect(sx - r, sy - r, 2 * r, 2 * r);
      else g.arc(sx, sy, r, 0, Math.PI * 2);
      g.fillStyle = m.color;
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = col('--map-bg');
      g.stroke();
      if (m.text) {
        g.fillStyle = '#fff';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(m.text, sx, sy + 0.5);
      }
      if (m.label) {
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        g.lineWidth = 3;
        g.strokeStyle = col('--map-bg');
        g.strokeText(m.label, sx + r + 5, sy);
        g.fillStyle = col('--map-label');
        g.fillText(m.label, sx + r + 5, sy);
      }
    }
  }

  /** Turned map: a small north arrow in the upper left. */
  paintNorth(g, fg, bg) {
    const x = 26;
    const y = 26;
    const a = (-this.view.rot * Math.PI) / 180;
    g.save();
    g.beginPath();
    g.arc(x, y, 17, 0, Math.PI * 2);
    g.fillStyle = bg;
    g.globalAlpha = 0.85;
    g.fill();
    g.globalAlpha = 1;
    g.strokeStyle = fg;
    g.lineWidth = 1;
    g.stroke();
    g.translate(x, y);
    g.rotate(a);
    g.beginPath();
    g.moveTo(0, -13);
    g.lineTo(5, 1);
    g.lineTo(-5, 1);
    g.closePath();
    g.fillStyle = '#c1121f';
    g.fill();
    g.font = '700 10px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = fg;
    g.fillText('N', 0, 8);
    g.restore();
  }

  /** Join each street's way pieces end to end so labels can span many short pieces. */
  labelChains() {
    if (this.chains) return this.chains;
    const RANK = { motorway: 6, trunk: 5, primary: 4, secondary: 3, tertiary: 2 };
    const byName = new Map();
    for (const w of this.ways) {
      if (!w.name || w.nodes.length < 2) continue;
      if (!byName.has(w.name)) byName.set(w.name, []);
      byName.get(w.name).push(w);
    }
    const chains = [];
    for (const [name, ws] of byName) {
      const pool = ws.map((w) => ({ nodes: w.nodes.slice(), cls: w.cls }));
      while (pool.length) {
        const c = pool.pop();
        let grew = true;
        while (grew) {
          grew = false;
          for (let i = 0; i < pool.length; i++) {
            const o = pool[i].nodes;
            const head = c.nodes[0];
            const tail = c.nodes[c.nodes.length - 1];
            if (o[0] === tail) c.nodes.push(...o.slice(1));
            else if (o[o.length - 1] === tail) c.nodes.push(...o.slice(0, -1).reverse());
            else if (o[o.length - 1] === head) c.nodes.unshift(...o.slice(0, -1));
            else if (o[0] === head) c.nodes.unshift(...o.slice(1).reverse());
            else continue;
            if ((RANK[pool[i].cls] || 0) > (RANK[c.cls] || 0)) c.cls = pool[i].cls;
            pool.splice(i, 1);
            grew = true;
            break;
          }
        }
        chains.push({ name, cls: c.cls, rank: RANK[c.cls] || 0, nodes: c.nodes });
      }
    }
    chains.sort((a, b) => b.rank - a.rank);
    this.chains = chains;
    return chains;
  }

  paintLabels(g, fg, bg) {
    const placed = [];
    const majorOnly = this.layers.labels === 'major';
    g.font = majorOnly ? '600 12px system-ui, sans-serif' : '11px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const { w: W, h: H } = this.size;
    const seenNear = (x, y, name) => placed.some((p) => (p.name === name ? Math.hypot(p.x - x, p.y - y) < 260 : Math.hypot(p.x - x, p.y - y) < 36));
    for (const c of this.labelChains()) {
      if (majorOnly && !LABEL_MAJOR.has(c.cls)) continue;
      const pts = c.nodes.map((n) => this.toScreen(this.xs[n], this.ys[n]));
      const need = g.measureText(c.name).width + 18;
      // Find stretches that are straight enough and long enough to hold the name.
      for (let i = 0; i < pts.length - 1;) {
        let j = i + 1;
        while (j < pts.length && Math.hypot(pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]) < need) j++;
        if (j >= pts.length) break;
        const [ax, ay] = pts[i];
        const [bx, by] = pts[j];
        const L = Math.hypot(bx - ax, by - ay);
        let straight = true;
        for (let k = i + 1; k < j && straight; k++) {
          const d = Math.abs((bx - ax) * (ay - pts[k][1]) - (ax - pts[k][0]) * (by - ay)) / L;
          if (d > 4) straight = false;
        }
        const x = (ax + bx) / 2;
        const y = (ay + by) / 2;
        if (!straight || x < 20 || y < 12 || x > W - 20 || y > H - 12 || seenNear(x, y, c.name)) { i++; continue; }
        let a = Math.atan2(by - ay, bx - ax);
        if (a > Math.PI / 2) a -= Math.PI;
        if (a < -Math.PI / 2) a += Math.PI;
        placed.push({ x, y, name: c.name });
        g.save();
        g.translate(x, y);
        g.rotate(a);
        g.lineWidth = 3.5;
        g.strokeStyle = bg;
        g.strokeText(c.name, 0, 0);
        g.fillStyle = fg;
        g.fillText(c.name, 0, 0);
        g.restore();
        i = j;
      }
    }
  }

}

/** Map panel with zoom buttons and a labels toggle. */
export function mapPanel(ctx, { labels = false, height } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'map-canvas';
  if (height) canvas.style.height = height;
  const wrap = document.createElement('div');
  wrap.className = 'map-wrap';
  wrap.append(canvas);
  const map = new CityMap(canvas, ctx);
  map.layers.labels = labels;
  const bar = document.createElement('div');
  bar.className = 'map-tools';
  const btn = (txt, title, fn) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = txt;
    b.title = title;
    b.setAttribute('aria-label', title);
    b.onclick = fn;
    bar.append(b);
    return b;
  };
  btn('+', 'Zoom in', () => map.zoom(1.5));
  btn('−', 'Zoom out', () => map.zoom(1 / 1.5));
  // Street names: maps that start with major names cycle major -> all -> off.
  const states = labels === 'major' ? ['major', true, false] : [false, true];
  const titles = { major: 'Street names: major streets (tap for all)', true: 'Street names: all (tap to hide)', false: 'Street names: off (tap to show)' };
  const lb = btn('Aa', titles[labels], () => {
    const next = states[(states.indexOf(map.layers.labels) + 1) % states.length];
    map.set({ labels: next });
    lb.classList.toggle('on', !!next);
    lb.title = titles[next];
    lb.setAttribute('aria-label', titles[next]);
  });
  lb.classList.toggle('on', !!labels);
  wrap.append(bar);
  return { el: wrap, map };
}
