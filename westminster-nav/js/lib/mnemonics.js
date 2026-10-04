// Memory aids for the street rotations.
//
// Each card has two aids, following what memory research says works:
//  1. RULE (understanding, not rote): the block can be worked out from the
//     street's letter. In rotations 1-3, block = rotation start + letter
//     position x 100 (L is the 12th letter, so Lowell = 2400 + 1200 = 3600).
//     Rotation 4 uses two names per letter.
//  2. MNEMONIC (keyword method + peg system): the street name becomes a
//     concrete keyword by sound or meaning (Lowell -> a low well), and the
//     hundreds are spelled with one fixed set of rhyming pegs (3 tree, 6 sticks).
//     One vivid scene makes the keyword act on the pegs, in digit order.
//     No pop-culture references: just wordplay and pictures.
// The app then drills them with retrieval practice in small chunks and
// Leitner spaced repetition.

import { ROTATIONS, STREETS } from './rotations.js';
import { ordinal } from './names.js';

/** Rhyming number pegs: the same picture always means the same digit. */
export const PEGS = ['hero', 'bun', 'shoe', 'tree', 'door', 'hive', 'sticks', 'heaven', 'gate', 'vine'];
export const PEG_ART = ['🦸', '🍞', '👟', '🌳', '🚪', '🐝', '🥢', '😇', '⛩️', '🍇'];

/** One mnemonic per street: [scene sentence, keyword art]. Pegs come from the number. */
export const MNEMONICS = {
  // Rotation 1: Broadway to Zuni
  0: ['A broad way (Broadway) stretches empty to the horizon, with one lone hero at the starting line: zero.', '🛣️'],
  100: ['An acorn in a coma (A-coma) sleeps curled up inside a bun.', '🌰😴'],
  200: ['A giant banner knocks (Ban-nock) the shoe right off your foot.', '🚩'],
  300: ['A cherry key (Chero-kee) hangs from a tree and unlocks its trunk.', '🍒🔑'],
  400: ['A deli wears (Dela-ware) a door like a sandwich board.', '🥪'],
  500: ['An elephant sips a latte (E-lati) while a beehive buzzes inside the cup.', '🐘☕'],
  600: ['A fox trots off with a bundle of sticks clamped in its jaws.', '🦊'],
  700: ['A giant Galápagos tortoise floats up to heaven on a cloud.', '🐢'],
  800: ['A huge run (Hu-ron) of sprinters crashes straight through a gate. First anchor.', '🏃'],
  900: ['Ink (Inca) spills over a grape vine and dyes every grape black.', '🖋️'],
  1000: ['A jay in the sun (Jay-son) steals a bun from a hero. Santa Fe Dr runs here too.', '🐦☀️'],
  1100: ['A calculator does the math (Kala-math) by adding bun plus bun.', '🧮'],
  1200: ['Big red lips on a frying pan (Li-pan) kiss a bun, then a shoe.', '💋🍳'],
  1300: ['A butterfly (mariposa in Spanish) lands on a bun under a tree.', '🦋'],
  1400: ['A navy ship\'s jaws (Nava-jo) chomp a bun and slam a door.', '🚢🦷'],
  1500: ['"Oh, sage!" (O-sage): a sprig of sage tucked in a bun lures a whole beehive.', '🌿'],
  1600: ['A chicken pecks (Pecos) a bun full of sticks. Anchor.', '🐔'],
  1700: ['A quiver (Quivas) fires arrows from a bun straight up to heaven.', '🏹'],
  1800: ['A rare tan (Rari-tan): a sunburned bun sprawls across the gate.', '🏖️'],
  1900: ['A shoe show (Sho-shone): a bun struts the runway down a grape vine.', '👠✨'],
  2000: ['Tea on (Te-jon) a shoe: a hero spills hot tea right into his sneaker.', '🍵'],
  2100: ['An umbrella wrapped in a tortilla (Uma-tilla) shelters a shoe and a bun.', '☂️🌮'],
  2200: ['A valley (Vallejo) where two shoes are stuck in the mud.', '🏞️'],
  2300: ['"Why and dot?" (Wyan-dot): a giant question mark stamps a shoe onto a tree.', '❓'],
  2400: ['A zebra\'s knee (Zu-ni) kicks a shoe through a door. Anchor; end of rotation 1.', '🦓'],

  // Rotation 2: Alcott to Sheridan
  2500: ['An owl on a cot (Al-cott) wears one shoe and guards a beehive.', '🦉🛏️'],
  2600: ['A briar ant (Bry-ant) marches inside a shoe, hauling a load of sticks.', '🐜'],
  2700: ['A clay pot shaped like a shoe floats up to heaven.', '🏺'],
  2800: ['A deck of cards (Deca-tur) is dealt into a shoe at the gate.', '🃏'],
  2900: ['A lot full of eels (Eli-ot) slithers out of a shoe and up a grape vine.', '🐍'],
  3000: ['The Feds (Federal) raid a tree house and haul out the hero inside. Anchor.', '🏛️🚔'],
  3100: ['A grove of trees where every tree grows a bun instead of fruit.', '🌲'],
  3200: ['A fishing hook (Hook-er) snags a tree and reels a shoe out of its branches.', '🎣'],
  3300: ['Ironing (Irv-ing) two trees flat as shirts on a giant ironing board.', '👔'],
  3400: ['Jewels (Jul-ian) dangle from a tree and stud a door.', '💎'],
  3500: ['A king\'s crown sits on a tree buried under a beehive.', '👑'],
  3600: ['A low well (Lowell): a tree grows out of it, dropping sticks into the water. Anchor.', '🪣'],
  3700: ['A horn of honey mead (Meade) poured on a tree makes it float up to heaven.', '🍯'],
  3800: ['A newt (Newt-on) climbs a tree and squeezes through a gate.', '🦎'],
  3900: ['"Oh, see the cola!" (Osce-ola): a cola fountain sprays a tree tangled in vines.', '🥤'],
  4000: ['A giant pear (Per-ry) props a door open for a hero.', '🍐'],
  4100: ['A quitter man (Quit-man) throws down a door and walks off eating a bun.', '🏳️'],
  4200: ['A rally car (Raleigh) smashes through a door and loses a shoe.', '🏎️'],
  4300: ['A steward (Stuart) serves stew through a door into a tree house.', '🍲'],
  4400: ['A tennis ball (Tenny-son) ricochets off door after door. Anchor.', '🎾'],
  4500: ['You tickle (U-tica) a door with a feather until a beehive drops on you.', '🪶'],
  4600: ['Rain (V-rain) pours through an open door onto a pile of sticks.', '🌧️'],
  4700: ['A wine owner (Win-ona) opens a door to heaven: a wine cellar in the clouds.', '🍷'],
  4800: ['A wolf (Wolff) howls at a door behind a locked gate.', '🐺'],
  4900: ['A lifesaver (Xa-vier, "savior") bursts through a door to rescue a drowning grape vine.', '🛟'],
  5000: ['A yacht (Yates) rams a beehive and knocks its hero captain overboard.', '⛵'],
  5100: ['A zen boa (Zen-obia) coils around a beehive, meditating on a bun.', '🐍🧘'],
  5200: ['Shears (Sheri-dan) snip a beehive in half and out drops a shoe. Anchor; end of rotation 2.', '✂️'],

  // Rotation 3: Ames to Zephyr
  5300: ['Aim (Ames) an arrow at a beehive hanging from a tree.', '🎯'],
  5400: ['A bent ton weight (Ben-ton) crushes a beehive against a door.', '🏋️'],
  5500: ['A chase: you sprint away from two angry beehives.', '🏃‍♂️'],
  5600: ['A church pew (De-pew) swarming with a beehive and piled high with sticks.', '⛪'],
  5700: ['Eatin\' (Eaton) honey straight from a beehive up in heaven.', '🍽️'],
  5800: ['A ton of fencing (Fen-ton) piled around a beehive at the gate.', '🚧'],
  5900: ['Gray paint (Gray) drips over a beehive and a grape vine.', '🎨'],
  6000: ['Hollerin\' (Harlan) through a megaphone at a pile of sticks guarded by a hero. Anchor.', '📣'],
  6100: ['Gulls splattered with ink (In-galls) fight over sticks and a bun.', '🕊️🖋️'],
  6200: ['A blue jay builds its nest from sticks and an old shoe.', '🐦'],
  6300: ['A candle (Ken-dall) sets a pile of sticks under a tree on fire.', '🕯️'],
  6400: ['A llama (La-mar) kicks through a stack of sticks and a door.', '🦙'],
  6500: ['A marshal\'s badge pinned on a pile of sticks and a beehive.', '⭐'],
  6600: ['New land (Newland): plant two sticks in fresh ground, and they sprout. Pierce lands here too.', '🌱'],
  6700: ['Oats (O-tis) spilled on sticks float up to heaven.', '🌾'],
  6800: ['A spear pierces (Pierce) a bundle of sticks and pins them to the gate. Anchor; sometimes on 66.', '🗡️'],
  6900: ['A key (Quay) unlocks a bundle of sticks chained to a grape vine.', '🗝️'],
  7000: ['A reed (Reed) pipe played up in heaven by a hero.', '🎋'],
  7100: ['Salt pours down from heaven and buries (Sauls-bury) a bun.', '🧂'],
  7200: ['A bank teller (Teller) up in heaven slides a shoe out through the window.', '🏦'],
  7300: ['Up, ham! (Up-ham): a ham flies up to heaven and lands in a tree.', '🍖'],
  7400: ['A van (Vance) drives up to heaven and parks at a door.', '🚐'],
  7500: ['A spider web (Web-ster) spun from heaven down to a beehive.', '🕸️'],
  7600: ['Wads of cash (Wads-worth) stuffed in heaven, tied with sticks. Anchor.', '💵'],
  7700: ['You con (Yu-kon): a con artist sells the same patch of heaven twice: heaven, then heaven again.', '🎟️'],
  7800: ['A yarrow flower shot like an arrow (Y-arrow) from heaven through a gate.', '🌼🏹'],
  7900: ['A zephyr, the west wind, blows from heaven and shakes a grape vine. End of rotation 3.', '🌬️'],

  // Rotation 4: Allison to Alkire (two names per letter)
  8000: ['"All is on!" (Alli-son): a gate lit up like a stage with a hero standing in it.', '💡'],
  8100: ['Ammo (Ammons): a firecracker in the gate blasts out a bun.', '🧨'],
  8200: ['A balsam fir tied to a gate with a shoelace from a shoe.', '🎄'],
  8300: ['Burnt wood (Brent-wood) smolders at the gate beside a charred tree.', '🔥🪵'],
  8400: ['A car (Carr) crashes through a gate and a door. Anchor.', '🚗'],
  8500: ['A code (Cody) lock on a gate keeps out a beehive.', '🔐'],
  8600: ['A dove flies over (Dov-er) a gate carrying sticks for its nest.', '🕊️'],
  8700: ['A dud (Dud-ley) firework fizzles at the gate and drifts up to heaven.', '🎆'],
  8800: ['A nest (Estes) balanced on two gates side by side.', '🪺'],
  8900: ['Ever wet (Ever-ett): a gate always dripping from the grape vine above it.', '💧'],
  9000: ['A field of grape vines to the horizon, with a hero standing in the middle.', '🌾🍇'],
  9100: ['A flower blooms on a grape vine growing out of a bun.', '🌸'],
  9200: ['A garrison of soldiers climbs a grape vine to rescue a stranded shoe. Anchor.', '🏰'],
  9300: ['A garland of grape vines wrapped around a tree.', '🎀'],
  9400: ['Holland: a windmill with a grape vine growing over its door, tulips all around.', '🌷'],
  9500: ['Hoist (Hoyt) a grape vine up with a crane to a beehive.', '🏗️'],
  9600: ['Independence Day fireworks burst out of grape vines and sticks.', '🎇'],
  9700: ['A purple iris flower climbs a grape vine to heaven.', '💜'],
  9800: ['Jelly\'s on (Jelli-son): grape jelly from the vine smeared all over the gate.', '🫙'],
  9900: ['A jar in the sun (John-son) with two grape vines bursting out of it.', '🫙☀️'],
  10000: ['A kipper fish (Kip-ling) in a bun, guarded by two heroes. Anchor.', '🐟'],
  10100: ['A climb (Kline): scale a bun, pass a hero, top out on another bun.', '🧗'],
  10200: ['A leaf (Lee-f) wraps up a bun, a hero and a shoe.', '🍃'],
  10300: ['A loose (Lew-is) bun rolls past a hero and up a tree.', '🌀'],
  10400: ['A miller\'s stone grinds a bun, a hero and a door into flour.', '⚙️🌾'],
  10500: ['Moor (Moore) a boat to a bun, a hero and a beehive.', '⚓'],
  10600: ['Kneel in the sun (Nel-son) before a bun, a hero and a pile of sticks.', '🧎☀️'],
  10700: ['A new comb (Newcombe) combs a bun, a hero and a cloud in heaven.', '🪮'],
  10800: ['An oak with a bun, a hero and a gate carved into its trunk. Anchor.', '🌳🪓'],
  10900: ['Ovens (Owens) baking a bun, a hero and grapes from the vine.', '♨️'],
  11000: ['A parfait (Parfet) layered with two buns and a hero on top.', '🍨'],
  11100: ['A pier (Pier-son) built on three buns in a row.', '🌉'],
  11200: ['A quail nests on two buns and a shoe.', '🐦'],
  11300: ['A queen crowns two buns and a tree.', '👸'],
  11400: ['A robber (Robb) sneaks off with two buns and a door.', '🦹'],
  11500: ['A route (Routt) sign points past two buns to a beehive.', '🪧'],
  11600: ['Swim (Simms) across Standley Lake on two buns and a raft of sticks. Anchor.', '🏊'],
  11700: ['Swaddle (Swad-ley) a baby between two buns and float it up to heaven.', '👶'],
  11800: ['A tabor drum (Tabor) beaten with two buns at the gate.', '🥁'],
  11900: ['Taffy (Taft) stretched between two buns and a grape vine.', '🍬'],
  12000: ['An onion (Union) stacked with a bun, a shoe and a hero.', '🧅'],
  12100: ['An urban skyline built from a bun, a shoe and another bun.', '🏙️'],
  12200: ['A van full of gourds (Van Gord-on) carrying a bun and two shoes.', '🚐🎃'],
  12300: ['Vivid (Viv-ian) colors on a count of 1-2-3: bun, shoe, tree.', '🌈'],
  12400: ['A welder (Wel-ch) fuses a bun, a shoe and a door together. Anchor.', '👨‍🏭'],
  12500: ['Write (Wright) with a quill on a bun, a shoe and a beehive.', '✍️'],
  12600: ['A xenon headlight shines on a bun, a shoe and a pile of sticks.', '🔦'],
  12700: ['A xylophone (Xeno-phon) played on a bun, a shoe and a cloud in heaven.', '🎹'],
  12800: ['Yank a rope tied to a bun, a shoe and the gate. There is no 12900.', '🪢'],
  13000: ['Zang! A gong struck with a bun, a tree and a hero.', '🔔'],
  13100: ['A zinnia flower sprouts from a bun, a tree and another bun.', '🌺'],
  13200: ['All fire (Al-kire): a bun, a tree and a shoe all ablaze. Anchor; end of the sheet.', '🔥'],
};

/** The pegs that spell a block's hundreds, e.g. 3600 -> [tree, sticks]. */
export function pegsFor(block) {
  return String(block / 100).split('').map((d) => ({ digit: d, word: PEGS[+d], art: PEG_ART[+d] }));
}

/** Tips for the major (bold) streets deck. */
export const MAJOR_TIP = 'The bold anchors come every 800 (about half a mile): 0 · 800 · 1600 · 2400, then Federal at 3000, then 3600 · 4400 · 5200 · 6000 · 6800 · 7600 · 8400 · 9200 · 10000 · 10800 · 11600 · 12400 · 13200. Federal is the one exception. Pierce (6800) also runs on the 6600 line in some areas.';

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

/** The mnemonic sentence and keyword art for a street. */
export function mnemonic(s) {
  const m = MNEMONICS[s.block];
  return m ? { text: m[0], art: m[1], pegs: pegsFor(s.block) } : null;
}

/** Extra note for streets that sit on more than one block line. */
export function alsoNote(s) {
  if (s.also?.length) return `${s.name} is ${s.block} on the sheet, but also runs on the ${s.also.join(' and ')} line in some parts of the city.`;
  const sharers = STREETS.filter((x) => x.also?.includes(s.block));
  if (sharers.length) return `${sharers.map((x) => x.name).join(' and ')} also runs on the ${s.block} line in some areas, so ${s.block} can be ${[s.name, ...sharers.map((x) => x.name)].join(' or ')}.`;
  return '';
}
