// Denver-metro address grid: house numbers <-> coordinates.
//   west number  = hundred block west of Broadway (Sheridan = 5200)
//   north number = avenue * 100 (W 92nd Ave = 9200)
// Anchors are piecewise-linear calibration points. The defaults are
// approximate; tools/build-data.mjs re-fits them from OpenStreetMap by
// locating the real anchor streets and avenues.

import { bracketWest } from './rotations.js';
import { ordinal } from './names.js';

export const DEFAULT_GRID = {
  west: [
    [0, -104.9876], [800, -104.9997], [1600, -105.0070], [2400, -105.0157],
    [3000, -105.0250], [3600, -105.0343], [4400, -105.0437], [5200, -105.0532],
    [6000, -105.0625], [6800, -105.0718], [7600, -105.0812], [8400, -105.0906],
    [9200, -105.1000], [10000, -105.1093], [10800, -105.1187], [11600, -105.1281],
    [12400, -105.1375], [13200, -105.1468],
  ],
  north: [
    [6400, 39.8138], [7200, 39.8283], [8000, 39.8428], [8800, 39.8574],
    [9600, 39.8719], [10400, 39.8864], [11200, 39.9010], [12000, 39.9153],
    [12800, 39.9298], [13600, 39.9443], [14400, 39.9588], [15200, 39.9733],
    [16000, 39.9878],
  ],
};

function interp(pairs, v, fromIdx, toIdx) {
  const pts = [...pairs].sort((a, b) => a[fromIdx] - b[fromIdx]);
  let i = 1;
  while (i < pts.length - 1 && v > pts[i][fromIdx]) i++;
  const a = pts[i - 1];
  const b = pts[i];
  const t = (v - a[fromIdx]) / (b[fromIdx] - a[fromIdx]);
  return a[toIdx] + t * (b[toIdx] - a[toIdx]);
}

export function makeGrid(anchors = DEFAULT_GRID) {
  return {
    anchors,
    westNumber: (lon) => interp(anchors.west, lon, 1, 0),
    northNumber: (lat) => interp(anchors.north, lat, 1, 0),
    lonForWest: (n) => interp(anchors.west, n, 0, 1),
    latForNorth: (n) => interp(anchors.north, n, 0, 1),
    /** [lat, lon] for a grid position */
    toLatLon: (west, north) => [interp(anchors.north, north, 0, 1), interp(anchors.west, west, 0, 1)],
  };
}

/** House number on a street from a grid value, snapped to the street's side parity. */
export function houseNumber(gridValue, odd) {
  let n = Math.max(1, Math.round(gridValue));
  if ((n % 2 === 1) !== odd) n += 1;
  return n;
}

/** "Between Fenton (5800) and Gray (5900)" for a west number. */
export function describeWest(num) {
  const { lo, hi } = bracketWest(num);
  if (!lo) return 'east of Broadway';
  if (!hi) return `west of ${lo.name} (${lo.block})`;
  return `between ${lo.name} (${lo.block}) and ${hi.name} (${hi.block})`;
}

/** "Between W 87th Ave and W 88th Ave" for a north number. */
export function describeNorth(num) {
  const ave = Math.floor(num / 100);
  return `between ${ordinal(ave)} Ave and ${ordinal(ave + 1)} Ave`;
}

/** Classify a street name as an east-west numbered avenue/place/etc. */
export function avenueNumber(name) {
  const m = /(?:^|\s)(\d{2,3})(?:st|nd|rd|th)?\s+(ave|avenue|pl|place|dr|drive|cir|circle|way|ct|court|ln|lane|pkwy|parkway)\b/i.exec(name || '');
  return m ? Number(m[1]) : null;
}
