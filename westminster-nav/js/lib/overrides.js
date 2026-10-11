// Local exceptions to the map data, applied when the map loads (so they survive
// map-data rebuilds). Add an entry when crews are allowed to do something the
// street signs don't allow.

// One-way streets fire apparatus may drive in both directions. A way is
// opened up when it has this name and every point lies within the box around
// `between` (plus `pad` meters).
export const APPARATUS_TWO_WAY = [
  {
    name: 'West 72nd Place',
    between: [[39.82788, -105.03904], [39.82729, -105.03790]],
    pad: 25,
    why: 'Station 1: 72nd Way is one-way west from 72nd Ave to Osceola, but apparatus may run east on it to reach 72nd Ave.',
  },
];

/** Apply the exceptions to the raw map data (before the road graph is built). */
export function applyOverrides(city) {
  const pt = (i) => [city.nodes[2 * i], city.nodes[2 * i + 1]];
  let opened = 0;
  for (const rule of APPARATUS_TWO_WAY) {
    const lats = rule.between.map((p) => p[0]);
    const lons = rule.between.map((p) => p[1]);
    const dLat = rule.pad / 111320;
    const dLon = rule.pad / (111320 * Math.cos((lats[0] * Math.PI) / 180));
    const inBox = ([la, lo]) => la >= Math.min(...lats) - dLat && la <= Math.max(...lats) + dLat
      && lo >= Math.min(...lons) - dLon && lo <= Math.max(...lons) + dLon;
    for (const w of city.ways) {
      if (!w[2] || city.names[w[0]] !== rule.name) continue;
      if (w[3].every((n) => inBox(pt(n)))) { w[2] = 0; opened++; }
    }
  }
  return opened;
}
