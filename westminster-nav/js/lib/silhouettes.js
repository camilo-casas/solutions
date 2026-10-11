// Reference landmarks for the windshield: simple 3D models of two Westminster
// landmarks you can see from across town. Shapes are approximated from photos
// and published descriptions; sizes are in meters. Local axes: x east, y north,
// up. `rot` turns the model clockwise (degrees) from that grid alignment.

// Westminster City Hall bell tower, 4800 W 92nd Ave (1988). A 14-story
// beige-brick tower with red brick bands and clock faces, topped by an open
// pyramid of steel mesh (the shape in the city's logo); about 130-136 ft tall,
// rising from the three-story beige brick City Hall.
const BELL_TOWER = {
  name: 'Bell Tower',
  label: 'Westminster Bell Tower',
  p: [39.86252, -105.04878],
  rot: 0,
  parts: [
    { type: 'box', x: 0, y: -14, w: 62, d: 32, h: 13, color: '#c8b48e' }, // City Hall
    { type: 'box', x: 0, y: -14, w: 62.4, d: 32.4, z0: 6, h: 1, color: '#9b4a37' }, // red brick band
    { type: 'box', x: 0, y: 6, w: 7.5, d: 7.5, h: 30, color: '#d3c19c' }, // tower shaft
    ...[9, 17, 24].map((z0) => ({ type: 'box', x: 0, y: 6, w: 7.9, d: 7.9, z0, h: 0.9, color: '#9b4a37' })),
    { type: 'clocks', x: 0, y: 6, w: 7.9, z: 27.2, r: 2.1 },
    { type: 'pyramid', x: 0, y: 6, w: 8.6, d: 8.6, z0: 30, h: 10.5, color: '#4b5763', mesh: true },
    { type: 'box', x: 0, y: 6, w: 0.5, d: 0.5, z0: 40.5, h: 1.5, color: '#4b5763' }, // finial
  ],
};

// Westminster Castle (Westminster University, now the Pillar of Fire),
// 3455 W 83rd Ave (1892). Richardsonian Romanesque in rock-faced red sandstone
// on the hilltop west of Federal: a 160 x 80 ft main block, long side facing
// south toward Denver, with a hipped red roof and a six-story tower over the
// main entrance on the south side, a round drum at its base, a second south
// tower and a projection on the east.
const CASTLE = {
  name: 'Castle',
  label: 'Westminster Castle',
  p: [39.8482, -105.0320],
  rot: 0,
  parts: [
    { type: 'box', x: 0, y: 0, w: 49, d: 24, h: 16, color: '#9a4e3b' }, // main block
    { type: 'hip', x: 0, y: 0, w: 50, d: 25, z0: 16, h: 8, color: '#7e2b23' },
    { type: 'box', x: -4, y: -13, w: 9, d: 9, h: 28, color: '#a05440' }, // main tower
    { type: 'pyramid', x: -4, y: -13, w: 10, d: 10, z0: 28, h: 12, color: '#7e2b23' },
    { type: 'box', x: -4, y: -13, w: 0.4, d: 0.4, z0: 40, h: 2.5, color: '#3d3d3d' }, // finial
    { type: 'cyl', x: -11, y: -13.5, r: 3.4, h: 21, color: '#9a4e3b' }, // round drum
    { type: 'cone', x: -11, y: -13.5, r: 3.8, z0: 21, h: 7, color: '#7e2b23' },
    { type: 'box', x: 14, y: -13, w: 7, d: 7, h: 21, color: '#a05440' }, // second south tower
    { type: 'pyramid', x: 14, y: -13, w: 8, d: 8, z0: 21, h: 8, color: '#7e2b23' },
    { type: 'box', x: 27, y: 2, w: 6, d: 12, h: 14, color: '#9a4e3b' }, // east projection
    { type: 'hip', x: 27, y: 2, w: 6.6, d: 12.6, z0: 14, h: 4.5, color: '#7e2b23' },
  ],
};

export const SILHOUETTES = [BELL_TOWER, CASTLE];

// ---- Faces --------------------------------------------------------------------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };
const mean = (pts) => [0, 1, 2].map((k) => pts.reduce((s, p) => s + p[k], 0) / pts.length);

function boxFaces({ x, y, w, d, z0 = 0, h }) {
  const [x0, x1, y0, y1, z1] = [x - w / 2, x + w / 2, y - d / 2, y + d / 2, z0 + h];
  return [
    [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]],
    [[x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]],
    [[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]],
    [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]],
    [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]],
  ];
}
function pyramidFaces({ x, y, w, d, z0 = 0, h }) {
  const c = [[x - w / 2, y - d / 2, z0], [x + w / 2, y - d / 2, z0], [x + w / 2, y + d / 2, z0], [x - w / 2, y + d / 2, z0]];
  const top = [x, y, z0 + h];
  return c.map((p, i) => [p, c[(i + 1) % 4], top]);
}
function hipFaces({ x, y, w, d, z0 = 0, h }) {
  const r = Math.max(0, (w - d) / 2);
  const [x0, x1, y0, y1, z1] = [x - w / 2, x + w / 2, y - d / 2, y + d / 2, z0 + h];
  const a = [x - r, y, z1];
  const b = [x + r, y, z1];
  return [
    [[x0, y0, z0], [x1, y0, z0], b, a],
    [[x1, y1, z0], [x0, y1, z0], a, b],
    [[x0, y1, z0], [x0, y0, z0], a],
    [[x1, y0, z0], [x1, y1, z0], b],
  ];
}
function ring(x, y, r, z, n) { return Array.from({ length: n }, (_, i) => [x + r * Math.sin((i * 2 * Math.PI) / n), y + r * Math.cos((i * 2 * Math.PI) / n), z]); }
function cylFaces({ x, y, r, z0 = 0, h, n = 12 }) {
  const lo = ring(x, y, r, z0, n);
  const hi = ring(x, y, r, z0 + h, n);
  return [...lo.map((p, i) => [p, lo[(i + 1) % n], hi[(i + 1) % n], hi[i]]), hi];
}
function coneFaces({ x, y, r, z0 = 0, h, n = 12 }) {
  const lo = ring(x, y, r, z0, n);
  return lo.map((p, i) => [p, lo[(i + 1) % n], [x, y, z0 + h]]);
}
// Round clock faces on the four sides of a square tower.
function clockFaces({ x, y, w, z, r }) {
  const out = [];
  const n = 12;
  for (const [nx, ny] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const cx = x + nx * (w / 2 + 0.05);
    const cy = y + ny * (w / 2 + 0.05);
    out.push(Array.from({ length: n }, (_, i) => {
      const t = (i * 2 * Math.PI) / n;
      const s = r * Math.cos(t);
      return [cx + -ny * s, cy + nx * s, z + r * Math.sin(t)];
    }));
  }
  return out;
}

const BUILD = { box: boxFaces, pyramid: pyramidFaces, hip: hipFaces, cyl: cylFaces, cone: coneFaces, clocks: clockFaces };

/**
 * A model's faces, turned by `rot`: { pts, normal, color, mesh } with points
 * as [east, north, up] meters from the model's center, normals pointing out.
 */
export function facesOf(model) {
  const r = (model.rot || 0) * (Math.PI / 180);
  const turn = ([e, n, u]) => [e * Math.cos(r) + n * Math.sin(r), -e * Math.sin(r) + n * Math.cos(r), u];
  const faces = [];
  for (const part of model.parts) {
    const center = [part.x, part.y, (part.z0 || 0) + (part.h || 0) / 2];
    const color = part.type === 'clocks' ? '#f4f1e6' : part.color;
    for (const pts of BUILD[part.type](part)) {
      let normal = unit(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])));
      // Clock faces point out from the tower; everything else away from its part's middle.
      const c = mean(pts);
      const out = part.type === 'clocks' ? [c[0] - part.x, c[1] - part.y, 0] : sub(c, center);
      if (dot(normal, out) < 0) normal = normal.map((v) => -v);
      faces.push({ pts: pts.map(turn), normal: turn(normal), color, mesh: !!part.mesh, flat: part.type === 'clocks' });
    }
  }
  const top = Math.max(...faces.flatMap((f) => f.pts.map((p) => p[2])));
  return { faces, top };
}
