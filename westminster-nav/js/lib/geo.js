// Small geodesy helpers. Points are [lat, lon] in degrees unless noted.

const R = 6371008.8;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

export function distance(a, b) {
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Initial bearing a -> b, degrees clockwise from north in [0, 360). */
export function bearing(a, b) {
  const y = Math.sin(rad(b[1] - a[1])) * Math.cos(rad(b[0]));
  const x = Math.cos(rad(a[0])) * Math.sin(rad(b[0])) - Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(rad(b[1] - a[1]));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Signed difference to - from, in (-180, 180]. Positive means clockwise (a right turn). */
export function angleDiff(from, to) {
  let d = ((to - from) % 360 + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

export const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export const CARDINAL_NAMES = {
  N: 'north', NE: 'northeast', E: 'east', SE: 'southeast',
  S: 'south', SW: 'southwest', W: 'west', NW: 'northwest',
};
export const CARDINAL_DEG = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };

export function toCardinal(b) {
  return CARDINALS[Math.round((((b % 360) + 360) % 360) / 45) % 8];
}

/** Equirectangular projection to local meters (x east, y north) around an origin. */
export function makeProjection(origin) {
  const k = Math.cos(rad(origin[0]));
  const m = (Math.PI / 180) * R;
  return {
    fwd: (p) => [(p[1] - origin[1]) * m * k, (p[0] - origin[0]) * m],
    inv: (xy) => [origin[0] + xy[1] / m, origin[1] + xy[0] / (m * k)],
  };
}

/** Even-odd point-in-polygon test against a list of rings of [lat, lon]. */
export function pointInRings(p, rings) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [yi, xi] = ring[i];
      const [yj, xj] = ring[j];
      if ((yi > p[0]) !== (yj > p[0]) && p[1] < ((xj - xi) * (p[0] - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}
