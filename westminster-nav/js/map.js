// Canvas street map drawn straight from city.json (no tiles, no labels
// unless asked) so it can't give away answers mid-question.

import { makeProjection } from './lib/geo.js';
import { shortName } from './lib/names.js';

const WIDTH = { trunk: 3, primary: 3, secondary: 2.4, tertiary: 1.8, link: 1.2, motorway: 3.4, residential: 1, unclassified: 1, service: 0.6 };
const MAJOR = new Set(['motorway', 'trunk', 'primary', 'secondary']);

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
    this.view = { cx: 0, cy: 0, scale: 0.05 };
    this.onclick = null;
    this.bind();
    this.ro = new ResizeObserver(() => {
      if (this.pending) this.fitXY(...this.pending);
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
    const w = Math.max(r.width, 100) - 2 * padPx;
    const h = Math.max(r.height, 100) - 2 * padPx;
    this.view.cx = (x0 + x1) / 2;
    this.view.cy = (y0 + y1) / 2;
    this.view.scale = Math.min(w / Math.max(x1 - x0, 300), h / Math.max(y1 - y0, 300));
    this.draw();
  }

  toScreen(x, y) {
    const r = this.size;
    return [r.w / 2 + (x - this.view.cx) * this.view.scale, r.h / 2 - (y - this.view.cy) * this.view.scale];
  }

  toWorld(sx, sy) {
    const r = this.size;
    return [this.view.cx + (sx - r.w / 2) / this.view.scale, this.view.cy - (sy - r.h / 2) / this.view.scale];
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
        const dx = e.offsetX - prev[0];
        const dy = e.offsetY - prev[1];
        moved += Math.abs(dx) + Math.abs(dy);
        this.view.cx -= dx / this.view.scale;
        this.view.cy += dy / this.view.scale;
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

    // Markers.
    g.font = '600 12px system-ui, sans-serif';
    for (const m of this.layers.markers) {
      const [x, y] = this.proj.fwd(m.p);
      const [sx, sy] = this.toScreen(x, y);
      const r = m.r || 7;
      if (m.heading != null) {
        const a = ((m.heading - 90) * Math.PI) / 180;
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

  paintLabels(g, fg, bg) {
    const placed = [];
    g.font = '11px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const seenNear = (x, y, name) => placed.some((p) => (p.name === name ? Math.hypot(p.x - x, p.y - y) < 220 : Math.hypot(p.x - x, p.y - y) < 40));
    for (let k = this.order.length - 1; k >= 0; k--) {
      const w = this.ways[this.order[k]];
      if (!w.name || w.nodes.length < 2) continue;
      // Longest screen segment of the way.
      let best = null;
      for (let i = 0; i + 1 < w.nodes.length; i++) {
        const [ax, ay] = this.toScreen(this.xs[w.nodes[i]], this.ys[w.nodes[i]]);
        const [bx, by] = this.toScreen(this.xs[w.nodes[i + 1]], this.ys[w.nodes[i + 1]]);
        const L = Math.hypot(bx - ax, by - ay);
        if (!best || L > best.L) best = { ax, ay, bx, by, L };
      }
      const tw = g.measureText(w.name).width;
      if (best.L < tw + 16) continue;
      const x = (best.ax + best.bx) / 2;
      const y = (best.ay + best.by) / 2;
      if (x < 0 || y < 0 || x > this.size.w || y > this.size.h || seenNear(x, y, w.name)) continue;
      let a = Math.atan2(best.by - best.ay, best.bx - best.ax);
      if (a > Math.PI / 2) a -= Math.PI;
      if (a < -Math.PI / 2) a += Math.PI;
      placed.push({ x, y, name: w.name });
      g.save();
      g.translate(x, y);
      g.rotate(a);
      g.lineWidth = 3;
      g.strokeStyle = bg;
      g.strokeText(w.name, 0, 0);
      g.fillStyle = fg;
      g.fillText(w.name, 0, 0);
      g.restore();
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
  const lb = btn('Aa', 'Toggle street names', () => {
    map.set({ labels: !map.layers.labels });
    lb.classList.toggle('on', map.layers.labels);
  });
  lb.classList.toggle('on', labels);
  wrap.append(bar);
  return { el: wrap, map };
}
