// Memory aids for the street rotations.
//
// Two layers per card, following what memory research says works:
//  1. RULE (understanding, not rote): the block can be worked out from the
//     street's letter. In rotations 1-3, block = rotation start + letter
//     position x 100 (L is the 12th letter, so Lowell = 2400 + 1200 = 3600).
//     Rotation 4 uses two names per letter.
//  2. HOOK (elaborative encoding): a vivid image that ties the sound of the
//     name to the number, via a familiar number (Route 66, Heinz 57) or the
//     rhyming pegs below.
// The app then drills them with retrieval practice in small chunks and
// Leitner spaced repetition.

import { ROTATIONS, STREETS } from './rotations.js';
import { ordinal } from './names.js';

/** Rhyming number pegs used in hooks: 4 = door, 6 = sticks, ... */
export const PEGS = ['hero', 'bun', 'shoe', 'tree', 'door', 'hive', 'sticks', 'heaven', 'gate', 'vine'];

/** Hooks keyed by block number. */
export const HOOKS = {
  // Rotation 1: tribes and places. Letter position = hundreds.
  0: 'Broadway is ground zero. Every west address counts out from here.',
  100: 'A = 1. Acoma is the first step off Broadway.',
  200: 'B = 2. "Ban-KNOCK": knock twice on the door.',
  300: 'C = 3. A Cherokee Jeep with 3 kids in the back seat.',
  400: 'D = 4. Washington crossing the Delaware, 4 oars in the water.',
  500: 'E = 5. "Elated!" Give me a high five.',
  600: 'F = 6. A fox carrying 6 sticks in its mouth.',
  700: 'G = 7. Sail all 7 seas to reach the Galápagos.',
  800: 'H = 8. Lake Huron: an 8 is two lakes stacked. First anchor, about ½ mile out.',
  900: 'I = 9. Inca gold puts you on cloud 9.',
  1000: 'J = 10. Jason and the Argonauts, a perfect 10. Santa Fe Dr runs here too.',
  1100: 'K = 11. "Calc-a-math": the 11 looks like two pencils.',
  1200: 'L = 12. "Lip-pan": a dozen eggs sizzling in a pan.',
  1300: 'M = 13. Mariposa means butterfly: an unlucky 13 black butterflies.',
  1400: 'N = 14. A Navajo blanket for Valentine\'s Day, Feb 14.',
  1500: 'O = 15. Osage oranges racked like the 15 balls in pool.',
  1600: 'P = 16. Pecos Bill moves into 1600 Pennsylvania Ave. Anchor: 2 × 800.',
  1700: 'Q = 17. A quiver holding 17 arrows.',
  1800: 'R = 18. At 18 you can vote, a rare right ("Rare-itan").',
  1900: 'S = 19. "Show\'s on!" The show starts at 19:00.',
  2000: 'T = 20. Tejon has 20/20 vision.',
  2100: 'U = 21. "U-matter!" Blackjack, 21.',
  2200: 'V = 22. Vallejo: a valley with two swans, 2-2.',
  2300: 'W = 23. "Why-and-dot?" asks Michael Jordan, #23.',
  2400: 'Z closes rotation 1 (no X or Y here). Zuni ends the day: 24 hours. Anchor.',

  // Rotation 2: great Americans. Start at 2400, add the letter.
  2500: 'A starts rotation 2. Alcott\'s Little Women opens on Christmas, the 25th.',
  2600: 'B. Bryant, a "bright ant", marches all 26 letters of the alphabet.',
  2700: 'C. Mold the 27 Club out of clay.',
  2800: 'D. "Deck-a-tour": tour the deck for the 28 days of February.',
  2900: 'E. Eliot only throws a party on Feb 29.',
  3000: 'F. The Feds round it off: 3000. Anchor (US-287).',
  3100: 'G. A grove of 31 ice-cream flavors.',
  3200: 'H. Ice fishing with a hook: water freezes at 32°F.',
  3300: 'I. Irving\'s headless horseman spins a 33 rpm record.',
  3400: 'J. Julian\'s jewel box: 3 diamonds, 4 rubies.',
  3500: 'K. The King shot on 35 mm film.',
  3600: 'L. Lowell: a "low well" with a 360° view. Anchor.',
  3700: 'M. A mug of mead at 37°C body temperature.',
  3800: 'N. The apple hits Newton at 38.',
  3900: 'O. Osceola: "39 and holding."',
  4000: 'P. Perry turns 40.',
  4100: 'Q. Quitman quits at 41.',
  4200: 'R. Raleigh rides a bike to 42, the answer to everything.',
  4300: 'S. Stuart\'s stew simmers 43 minutes.',
  4400: 'T. Tennyson: "tennis son" plays at 40-40, so 44. Anchor.',
  4500: 'U. Utica spins a 45 rpm record.',
  4600: 'V. Vrain sounds like "brain": 46 chromosomes.',
  4700: 'W. Winona rides with the 47 Ronin.',
  4800: 'Second W. A wolf (Wolff) roams the lower 48.',
  4900: 'X. Xavier signs with the 49ers.',
  5000: 'Y. Yates sails yachts worth 50 grand.',
  5100: 'Z. Zenobia, queen of Area 51.',
  5200: 'Sheridan closes rotation 2. "Sheri deals" all 52 cards. Anchor.',

  // Rotation 3: senators, justices, politicians. Start at 5200, add the letter.
  5300: 'A starts rotation 3 just past Sheridan. Aim at Herbie, the Love Bug #53.',
  5400: 'B. Benton is bent on dancing at Studio 54.',
  5500: 'C. A car chase at 55 mph.',
  5600: 'D. Sit in the pew (De-PEW) with the 56 signers of the Declaration.',
  5700: 'E. Eaton has eaten all the Heinz 57.',
  5800: 'F. Fenton fences in a \'58 Chevy.',
  5900: 'G. Gray hair at 59.',
  6000: 'H. Harlan\'s Harley hits 60. Anchor.',
  6100: 'I. Ingalls hits 61 homers like Roger Maris.',
  6200: 'J. A jaywalker at 6:20.',
  6300: 'K. A Ken doll (Kendall) in a treehouse of sticks: sticks 6, tree 3.',
  6400: 'L. Lamar sings "When I\'m 64."',
  6500: 'M. The marshal retires at 65.',
  6600: 'N. New land on Route 66.',
  6700: 'O. An Otis elevator to floor 67.',
  6800: 'P. Pierce pierces a sticks-and-gate fence: 6, 8. Anchor.',
  6900: 'Q. Quay is said "key": the key to room 69.',
  7000: 'R. Reed reads the 7:00 news.',
  7100: 'S. Saulsbury ("salt\'s bury"): salt water covers 71% of Earth.',
  7200: 'T. The bank teller works 72 hours straight.',
  7300: 'U. "Up \'em!" Hands up for 73 seconds.',
  7400: 'V. Vance advances 74 yards for a touchdown.',
  7500: 'W. Webster\'s dictionary: 75 thousand words.',
  7600: 'Second W. Wadsworth: 76 trombones led the big parade. Anchor.',
  7700: 'Y (no X in rotation 3). The Yukon at minus 77.',
  7800: 'Second Y. Yarrow spins a 78 rpm record.',
  7900: 'Z. Zephyr, the west wind, blows rotation 3 shut at 79.',

  // Rotation 4: governors, Jefferson County pioneers, flora. Two names per letter.
  8000: 'A, 1st of the pair. Allison\'s big 80s hair.',
  8100: 'A, 2nd. Ammons props an ammo box against a gate with a bun on top: gate 8, bun 1.',
  8200: 'B, 1st. A balsam fir for Christmas \'82.',
  8300: 'B, 2nd. Brentwood\'s rent: a gate and a tree, 8-3.',
  8400: 'C, 1st. The car (Carr) hits 84 on the highway. Anchor.',
  8500: 'C, 2nd. Buffalo Bill Cody\'s herd of 85.',
  8600: 'D, 1st. Dover is "over": bartenders "86" you.',
  8700: 'D, 2nd. "Four score and seven" (87) years ago, Dudley read.',
  8800: 'E, 1st. Estes Park\'s Stanley Hotel piano: 88 keys.',
  8900: 'E, 2nd. Everett lives forever, to 89.',
  9000: 'F, 1st. "It\'s over 9000!" shouted across the field.',
  9100: 'F, 2nd. Flowers delivered on 9/1.',
  9200: 'G, 1st. The garrison\'s gate is a vine and a shoe, 9-2. Anchor.',
  9300: 'G, 2nd. A garland of 93 lights.',
  9400: 'H, 1st. Holland\'s windmills: vine on the door, 9-4.',
  9500: 'H, 2nd. Hoyt climbs a vine to hoist a beehive: vine 9, hive 5.',
  9600: 'I, 1st. Independence Day, the 1996 movie.',
  9700: 'I, 2nd. An iris climbs a vine to heaven, 9-7.',
  9800: 'J, 1st. Jelly at 98.6°F body temperature.',
  9900: 'J, 2nd. Mr. Johnson has 99 problems.',
  10000: 'K, 1st. Kipling\'s "If—": score 100%. Anchor.',
  10100: 'K, 2nd. Kline 101, the intro course.',
  10200: 'L, 1st. Lee runs a 102° fever.',
  10300: 'L, 2nd. Lewis & Clark paddle 103 miles.',
  10400: 'M, 1st. Miller Time at 10:40.',
  10500: 'M, 2nd. "More!" Moore is one more than Miller: 105.',
  10600: 'N, 1st. Nelson\'s sandwich: a bun, a hero, and sticks: 1-0-6.',
  10700: 'N, 2nd. A new comb with 107 teeth.',
  10800: 'O, 1st. An oak bat and a baseball\'s 108 stitches. Anchor.',
  10900: 'O, 2nd. Owens owes 109 bucks.',
  11000: 'P, 1st. Parfet is "perfect": 110% effort.',
  11100: 'P, 2nd. Pierson\'s pier stands on three posts: 1-1-1.',
  11200: 'Q, 1st. A quail calls 112, Europe\'s emergency number.',
  11300: 'Q, 2nd. The Queen\'s lucky 13: 113.',
  11400: 'R, 1st. Robb robs a bun, a bun and a door: 1-1-4.',
  11500: 'R, 2nd. Routt\'s route: bun, bun, beehive, 1-1-5.',
  11600: 'S, 1st. Simms, near Standley Lake: sweet 16 plus 100. Anchor.',
  11700: 'S, 2nd. A baby swaddled (Swadley) between two buns, floating to heaven: 1-1-7.',
  11800: 'T, 1st. Run a tab (Tabor) for two buns at the gate: 1-1-8.',
  11900: 'T, 2nd. Big President Taft carries two buns up a vine: 1-1-9.',
  12000: 'U, 1st. A union 120 strong.',
  12100: 'U, 2nd. Urban bus #121.',
  12200: 'V, 1st. A van (Van Gordon) carrying a bun and two shoes: 1-2-2.',
  12300: 'V, 2nd. Vivian: easy as 1-2-3.',
  12400: 'W, 1st. Welch\'s grape juice, 24 hours a day at 124. Anchor.',
  12500: 'W, 2nd. The Wright brothers flew 120 ft; land them at 125.',
  12600: 'X, 1st. A xenon headlight shines on a bun, a shoe and sticks: 1-2-6.',
  12700: 'X, 2nd. Xenophon eats a bun, ties a shoe and marches to heaven: 1-2-7.',
  12800: 'Y (only one). Yank out the 128 GB thumb drive. There is no 12900.',
  13000: 'Z, 1st. "Zang!" A gong at 130.',
  13100: 'Z, 2nd. A zinnia on a bun: 13-1.',
  13200: 'A again. Alkire restarts the alphabet and caps the sheet at 132. Anchor.',
};

/** Tips for the major (bold) streets deck. */
export const MAJOR_TIP = 'The bold anchors come every 800 (about half a mile): 0 · 800 · 1600 · 2400, then Federal at 3000, then 3600 · 4400 · 5200 · 6000 · 6800 · 7600 · 8400 · 9200 · 10000 · 10800 · 11600 · 12400 · 13200. Federal is the one exception.';

const LETTER = (name) => name[0].toUpperCase().charCodeAt(0) - 64;

/** The worked-out "letter math" for a street. */
export function rule(s) {
  if (s.block === 0) return 'Broadway is 0. Everything west counts up from here.';
  const rot = ROTATIONS.find((r) => r.id === s.rotation);
  const names = rot.streets.filter((x) => x[1] !== 'Broadway');
  const base = names[0][0] - 100;
  const startName = base === 0 ? 'Broadway' : STREETS.find((x) => x.block === base).name;
  const start = `${startName} (${base})`;
  const L = LETTER(s.name);
  const letter = s.name[0].toUpperCase();
  const idx = names.findIndex((x) => x[1] === s.name);
  const prev = idx > 0 ? names[idx - 1][1] : null;
  const steps = (s.block - base) / 100;

  // A street that breaks alphabetical order is the boundary that closes the sheet or rotation.
  if (prev && LETTER(prev) > L) {
    return `${s.name} breaks the alphabet: it's the boundary street that closes ${s.rotation === 4 ? 'the sheet' : `rotation ${s.rotation}`}, ${steps} names after ${start}.`;
  }
  if (s.rotation === 4) {
    const pairStart = base + (2 * (L - 1) + 1) * 100;
    const second = s.block === pairStart + 100;
    return `Rotation 4 has two names per letter, starting after ${start}. ${letter} is letter ${L}, so its pair is ${pairStart} and ${pairStart + 100}; ${s.name} is the ${second ? 'second' : 'first'}.${letter === 'Y' ? ' (There is no second Y, so 12900 is empty.)' : ''}`;
  }
  if (L === steps) return `Start at ${start}. ${letter} is letter ${L}, so ${base} + ${L * 100} = ${s.block}.`;
  if (prev && LETTER(prev) === L) return `The second ${letter} street: one past ${prev} (${s.block - 100}).`;
  const diff = steps - L;
  const used = new Set(names.slice(0, idx).map((x) => x[1][0].toUpperCase()));
  const skipped = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, L - 1)].filter((c) => !used.has(c));
  const doubled = [...new Set(names.slice(0, idx).map((x) => x[1][0].toUpperCase()).filter((c, i, a) => a.indexOf(c) !== i))];
  const parts = [];
  if (doubled.length) parts.push(`the doubled ${doubled.join(' and ')} street${doubled.length > 1 ? 's' : ''} push${doubled.length > 1 ? '' : 'es'} it ${doubled.length} later`);
  if (skipped.length) parts.push(`skipping ${skipped.join(' and ')} pulls it ${skipped.length} earlier`);
  const why = parts.join(' and ') || `it sits ${Math.abs(diff)} ${diff > 0 ? 'later' : 'earlier'}`;
  return `${letter} is letter ${L}, but ${why}: ${base} + ${steps * 100} = ${s.block}.`;
}

export const hook = (s) => HOOKS[s.block] || '';
