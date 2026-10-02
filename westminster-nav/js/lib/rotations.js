// Westminster / Denver-grid street rotations (west of Broadway).
// Transcribed from the WFD street rotation sheet. Each number is the
// "hundred block" west of Broadway where that north-south street sits.
// `major: true` marks the bold anchor streets on the sheet (every 800 = ~1/2 mile).

export const ROTATIONS = [
  {
    id: 1,
    title: 'Rotation 1: Broadway to Zuni',
    theme: 'The "alphabet" of tribes, with connections and a few changes',
    streets: [
      [0, 'Broadway', true],
      [100, 'Acoma'], [200, 'Bannock'], [300, 'Cherokee'], [400, 'Delaware'],
      [500, 'Elati'], [600, 'Fox'], [700, 'Galapago'], [800, 'Huron', true],
      [900, 'Inca'], [1000, 'Jason', false, 'Santa Fe'], [1100, 'Kalamath'],
      [1200, 'Lipan'], [1300, 'Mariposa'], [1400, 'Navajo'], [1500, 'Osage'],
      [1600, 'Pecos', true], [1700, 'Quivas'], [1800, 'Raritan'],
      [1900, 'Shoshone'], [2000, 'Tejon'], [2100, 'Umatilla'], [2200, 'Vallejo'],
      [2300, 'Wyandot'], [2400, 'Zuni', true],
    ],
  },
  {
    id: 2,
    title: 'Rotation 2: Alcott to Sheridan',
    theme: 'Great Americans: authors, military figures, scientists, politicians and explorers',
    streets: [
      [2500, 'Alcott'], [2600, 'Bryant'], [2700, 'Clay'], [2800, 'Decatur'],
      [2900, 'Eliot'], [3000, 'Federal', true], [3100, 'Grove'], [3200, 'Hooker'],
      [3300, 'Irving'], [3400, 'Julian'], [3500, 'King'], [3600, 'Lowell', true],
      [3700, 'Meade'], [3800, 'Newton'], [3900, 'Osceola'], [4000, 'Perry'],
      [4100, 'Quitman'], [4200, 'Raleigh'], [4300, 'Stuart'],
      [4400, 'Tennyson', true], [4500, 'Utica'], [4600, 'Vrain'], [4700, 'Winona'],
      [4800, 'Wolff'], [4900, 'Xavier'], [5000, 'Yates'], [5100, 'Zenobia'],
      [5200, 'Sheridan', true],
    ],
  },
  {
    id: 3,
    title: 'Rotation 3: Ames to Zephyr',
    theme: 'U.S. senators, Supreme Court justices and other politicians',
    streets: [
      [5300, 'Ames'], [5400, 'Benton'], [5500, 'Chase'], [5600, 'Depew'],
      [5700, 'Eaton'], [5800, 'Fenton'], [5900, 'Gray'], [6000, 'Harlan', true],
      [6100, 'Ingalls'], [6200, 'Jay'], [6300, 'Kendall'], [6400, 'Lamar'],
      [6500, 'Marshall'], [6600, 'Newland'], [6700, 'Otis'], [6800, 'Pierce', true],
      [6900, 'Quay'], [7000, 'Reed'], [7100, 'Saulsbury'], [7200, 'Teller'],
      [7300, 'Upham'], [7400, 'Vance'], [7500, 'Webster'],
      [7600, 'Wadsworth', true], [7700, 'Yukon'], [7800, 'Yarrow'], [7900, 'Zephyr'],
    ],
  },
  {
    id: 4,
    title: 'Rotation 4: Allison to Alkire',
    theme: 'Colorado governors, Jefferson County pioneers and flora (two names per letter)',
    streets: [
      [8000, 'Allison'], [8100, 'Ammons'], [8200, 'Balsam'], [8300, 'Brentwood'],
      [8400, 'Carr', true], [8500, 'Cody'], [8600, 'Dover'], [8700, 'Dudley'],
      [8800, 'Estes'], [8900, 'Everett'], [9000, 'Field'], [9100, 'Flower'],
      [9200, 'Garrison', true], [9300, 'Garland'], [9400, 'Holland'], [9500, 'Hoyt'],
      [9600, 'Independence'], [9700, 'Iris'], [9800, 'Jellison'], [9900, 'Johnson'],
      [10000, 'Kipling', true], [10100, 'Kline'], [10200, 'Lee'], [10300, 'Lewis'],
      [10400, 'Miller'], [10500, 'Moore'], [10600, 'Nelson'], [10700, 'Newcombe'],
      [10800, 'Oak', true], [10900, 'Owens'], [11000, 'Parfet'], [11100, 'Pierson'],
      [11200, 'Quail'], [11300, 'Queen'], [11400, 'Robb'], [11500, 'Routt'],
      [11600, 'Simms', true], [11700, 'Swadley'], [11800, 'Tabor'], [11900, 'Taft'],
      [12000, 'Union'], [12100, 'Urban'], [12200, 'Van Gordon'], [12300, 'Vivian'],
      [12400, 'Welch', true], [12500, 'Wright'], [12600, 'Xenon'], [12700, 'Xenophon'],
      [12800, 'Yank'], [13000, 'Zang'], [13100, 'Zinnia'], [13200, 'Alkire', true],
    ],
  },
];

// Streets that also run on a second block line in parts of the city.
// Pierce is 6800 on the sheet but sits on the 6600 line (Newland's) in some areas.
export const ALSO_AT = { Pierce: [6600] };

// Flat list: { block, name, major, alias, rotation, also }
export const STREETS = ROTATIONS.flatMap((r) =>
  r.streets.map(([block, name, major = false, alias = null]) => ({
    block, name, major: !!major, alias, rotation: r.id, also: ALSO_AT[name] || [],
  })),
);

/** Other streets that can also sit on this street's block (6600 -> Pierce). */
export const sharesBlock = (s) => STREETS.filter((x) => x !== s && x.also.includes(s.block));

/** True when a and b could both be right for the same block, so neither may be a distractor for the other. */
export const conflicts = (a, b) => a.also.includes(b.block) || b.also.includes(a.block);

const byName = new Map();
for (const s of STREETS) {
  byName.set(s.name.toLowerCase(), s);
  if (s.alias) byName.set(s.alias.toLowerCase(), s);
}

/** Look up a rotation street by its base name ("Lowell", "lowell blvd" -> Lowell). */
export function streetByName(name) {
  if (!name) return null;
  const n = name.toLowerCase().replace(/\b(st|street|blvd|boulevard|ct|court|dr|drive|way|pkwy|parkway|pl|place|cir|circle|ln|lane|rd|road)\b\.?/g, '').trim();
  return byName.get(n) || null;
}

/** The two rotation streets that bracket a west block number (e.g. 5850 -> Fenton & Gray). */
export function bracketWest(num) {
  let lo = null;
  let hi = null;
  for (const s of STREETS) {
    if (s.block <= num) lo = s;
    if (s.block > num && !hi) hi = s;
  }
  return { lo, hi };
}
