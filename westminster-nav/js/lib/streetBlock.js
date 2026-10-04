// The number on a street-name blade: the street's own place on the grid, the
// way Westminster's signs read. "Lowell Blvd 3600" (its rotation block, west of
// Broadway) and "W 91st Ave 9100" (its avenue number), not the address block
// along the street at that corner.

import { streetByName } from './rotations.js';
import { avenueNumber } from './grid.js';

const MAIN_TYPE = /\b(st|street|blvd|boulevard|pkwy|parkway)\b\.?$/i;

/**
 * Block number for street `name` at [lat, lon]. `brg` is the street's bearing
 * there, used only for streets that are on neither the rotation sheet nor the
 * avenue numbers. Returns '' when there's no sensible number.
 */
export function streetBlock(name, lat, lon, brg, grid) {
  if (!name) return '';
  const ave = avenueNumber(name);
  if (ave) {
    const base = ave * 100;
    if (/\b(ave|avenue)\b\.?$/i.test(name)) return String(base);
    if (/\b(pl|place)\b\.?$/i.test(name)) return String(base + 50);
    // Ways, drives and courts sit somewhere inside their hundred.
    return String(clamp(round(grid.northNumber(lat), 25), base, base + 75));
  }
  const west = grid.westNumber(lon);
  const s = streetByName(name);
  if (s) {
    // Pierce also runs on the 6600 line: pick whichever line this piece is on.
    const lines = [s.block, ...s.also];
    const block = lines.reduce((a, b) => (Math.abs(b - west) < Math.abs(a - west) ? b : a));
    if (MAIN_TYPE.test(name) || !/\s/.test(name)) return String(block);
    // Courts, ways and drives named after the rotation street sit beside it.
    return String(clamp(round(west, 50), block - 50, block + 50));
  }
  // Off the sheet: a north-south street gets its west number, an east-west
  // street its north number, from where it actually is.
  const ns = Math.abs(Math.cos((brg * Math.PI) / 180)) >= Math.abs(Math.sin((brg * Math.PI) / 180));
  const n = ns ? west : grid.northNumber(lat);
  if (!(n > 0 && n < 20000)) return '';
  return String(round(n, 50));
}

const round = (n, step) => Math.round(n / step) * step;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
