# Mnemonic art brief

One illustration per street for the Rotations flash cards. Each picture shows the scene in that street's mnemonic. The app frames it in a poster that already adds the street name, the peg row and the hundred block, so the drawing itself carries **no words or numbers**.

## Deliverable

- One file per street: `data/mnemonic-art/<block>.svg` (for example `3600.svg` for Lowell). 132 files.
- Hand-written SVG: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">` as the very first thing in the file.
- No `<text>`, no scripts, no event handlers, no `<foreignObject>`, no embedded or external images (`href` only to `#ids` inside the file). Under 16 KB each.
- After adding or changing drawings run `node tools/build-art.mjs`. It checks every file and packs them into `js/lib/mnemonicArtData.js`, which the app uses. Fix anything it reports.
- `data/mnemonic-art/3600.svg` (Lowell) is the reference drawing for style and quality.

## Style (identical for all 132)

- Bold, flat cartoon illustration, like a children's picture book or a road-safety poster.
- Thick, dark outlines on everything: stroke `#14110f`, width 7-9. Rounded line joins and caps.
- Flat fills with at most one simple gradient (the sky or water). No photo-realism, no fine detail that disappears at thumbnail size (the card shows it at 56 px).
- Background: a simple light scene filling the square (pale sky `#bfe3ff` fading to cream `#fff8e1`, with a grass or ground strip) so it reads on the dark poster.
- Colors: natural colors for objects, with WFD accents where they fit: red `#c1121f`, gold `#f2b705`, black `#14110f`.
- Composition: the **keyword object is big, central and doing something**. The pegs are clearly visible and arranged **left to right, or top to bottom, in digit order**. Action, motion lines and exaggerated size make images memorable; use them.
- No people who look like any real or famous person, no logos, no brands, no pop-culture characters. Generic cartoon people are fine.

## The pegs (draw them the same way every time)

| Digit | Peg | How to draw it |
|---|---|---|
| 0 | hero | a generic cartoon firefighter-style hero: gold helmet, red cape, fists on hips (no logo on the chest) |
| 1 | bun | a round golden bread roll with white sesame seeds |
| 2 | shoe | a red high-top sneaker with white laces and sole |
| 3 | tree | a round green leafy tree with a brown trunk |
| 4 | door | a brown wooden door with a gold round knob, standing in its frame |
| 5 | hive | a gold dome-shaped beehive with dark stripes and two small bees |
| 6 | sticks | a bundle of light-brown sticks tied with red twine |
| 7 | heaven | a fluffy white cloud with a gold halo floating above it |
| 8 | gate | a black iron garden gate with pointed tops |
| 9 | vine | a green climbing vine hung with purple grape bunches |

When a digit repeats (55 = two hives), draw that peg twice. When a picture has three pegs, three objects must be visible.

## The 132 scenes

Draw what the mnemonic sentence says: the keyword (the street's sound-alike, in parentheses) acting on the pegs in order. Anchors are the bold streets on the rotation sheet.

| Block | Street | Pegs in order | Mnemonic |
|---|---|---|---|
| 0 | Broadway (anchor) | 0 hero | A broad way (Broadway) stretches empty to the horizon, with one lone hero at the starting line: zero. |
| 100 | Acoma | 1 bun | An acorn in a coma (A-coma) sleeps curled up inside a bun. |
| 200 | Bannock | 2 shoe | A giant banner knocks (Ban-nock) the shoe right off your foot. |
| 300 | Cherokee | 3 tree | A cherry key (Chero-kee) hangs from a tree and unlocks its trunk. |
| 400 | Delaware | 4 door | A deli wears (Dela-ware) a door like a sandwich board. |
| 500 | Elati | 5 hive | An elephant sips a latte (E-lati) while a beehive buzzes inside the cup. |
| 600 | Fox | 6 sticks | A fox trots off with a bundle of sticks clamped in its jaws. |
| 700 | Galapago | 7 heaven | A giant Galápagos tortoise floats up to heaven on a cloud. |
| 800 | Huron (anchor) | 8 gate | A huge run (Hu-ron) of sprinters crashes straight through a gate. First anchor. |
| 900 | Inca | 9 vine | Ink (Inca) spills over a grape vine and dyes every grape black. |
| 1000 | Jason | 1 bun → 0 hero | A jay in the sun (Jay-son) steals a bun from a hero. Santa Fe Dr runs here too. |
| 1100 | Kalamath | 1 bun → 1 bun | A calculator does the math (Kala-math) by adding bun plus bun. |
| 1200 | Lipan | 1 bun → 2 shoe | Big red lips on a frying pan (Li-pan) kiss a bun, then a shoe. |
| 1300 | Mariposa | 1 bun → 3 tree | A butterfly (mariposa in Spanish) lands on a bun under a tree. |
| 1400 | Navajo | 1 bun → 4 door | A navy ship's jaws (Nava-jo) chomp a bun and slam a door. |
| 1500 | Osage | 1 bun → 5 hive | "Oh, sage!" (O-sage): a sprig of sage tucked in a bun lures a whole beehive. |
| 1600 | Pecos (anchor) | 1 bun → 6 sticks | A chicken pecks (Pecos) a bun full of sticks. Anchor. |
| 1700 | Quivas | 1 bun → 7 heaven | A quiver (Quivas) fires arrows from a bun straight up to heaven. |
| 1800 | Raritan | 1 bun → 8 gate | A rare tan (Rari-tan): a sunburned bun sprawls across the gate. |
| 1900 | Shoshone | 1 bun → 9 vine | A shoe show (Sho-shone): a bun struts the runway down a grape vine. |
| 2000 | Tejon | 2 shoe → 0 hero | Tea on (Te-jon) a shoe: a hero spills hot tea right into his sneaker. |
| 2100 | Umatilla | 2 shoe → 1 bun | An umbrella wrapped in a tortilla (Uma-tilla) shelters a shoe and a bun. |
| 2200 | Vallejo | 2 shoe → 2 shoe | A valley (Vallejo) where two shoes are stuck in the mud. |
| 2300 | Wyandot | 2 shoe → 3 tree | "Why and dot?" (Wyan-dot): a giant question mark stamps a shoe onto a tree. |
| 2400 | Zuni (anchor) | 2 shoe → 4 door | A zebra's knee (Zu-ni) kicks a shoe through a door. Anchor; end of rotation 1. |
| 2500 | Alcott | 2 shoe → 5 hive | An owl on a cot (Al-cott) wears one shoe and guards a beehive. |
| 2600 | Bryant | 2 shoe → 6 sticks | A briar ant (Bry-ant) marches inside a shoe, hauling a load of sticks. |
| 2700 | Clay | 2 shoe → 7 heaven | A clay pot shaped like a shoe floats up to heaven. |
| 2800 | Decatur | 2 shoe → 8 gate | A deck of cards (Deca-tur) is dealt into a shoe at the gate. |
| 2900 | Eliot | 2 shoe → 9 vine | A lot full of eels (Eli-ot) slithers out of a shoe and up a grape vine. |
| 3000 | Federal (anchor) | 3 tree → 0 hero | The Feds (Federal) raid a tree house and haul out the hero inside. Anchor. |
| 3100 | Grove | 3 tree → 1 bun | A grove of trees where every tree grows a bun instead of fruit. |
| 3200 | Hooker | 3 tree → 2 shoe | A fishing hook (Hook-er) snags a tree and reels a shoe out of its branches. |
| 3300 | Irving | 3 tree → 3 tree | Ironing (Irv-ing) two trees flat as shirts on a giant ironing board. |
| 3400 | Julian | 3 tree → 4 door | Jewels (Jul-ian) dangle from a tree and stud a door. |
| 3500 | King | 3 tree → 5 hive | A king's crown sits on a tree buried under a beehive. |
| 3600 | Lowell (anchor) | 3 tree → 6 sticks | A low well (Lowell): a tree grows out of it, dropping sticks into the water. Anchor. |
| 3700 | Meade | 3 tree → 7 heaven | A horn of honey mead (Meade) poured on a tree makes it float up to heaven. |
| 3800 | Newton | 3 tree → 8 gate | A newt (Newt-on) climbs a tree and squeezes through a gate. |
| 3900 | Osceola | 3 tree → 9 vine | "Oh, see the cola!" (Osce-ola): a cola fountain sprays a tree tangled in vines. |
| 4000 | Perry | 4 door → 0 hero | A giant pear (Per-ry) props a door open for a hero. |
| 4100 | Quitman | 4 door → 1 bun | A quitter man (Quit-man) throws down a door and walks off eating a bun. |
| 4200 | Raleigh | 4 door → 2 shoe | A rally car (Raleigh) smashes through a door and loses a shoe. |
| 4300 | Stuart | 4 door → 3 tree | A steward (Stuart) serves stew through a door into a tree house. |
| 4400 | Tennyson (anchor) | 4 door → 4 door | A tennis ball (Tenny-son) ricochets off door after door. Anchor. |
| 4500 | Utica | 4 door → 5 hive | You tickle (U-tica) a door with a feather until a beehive drops on you. |
| 4600 | Vrain | 4 door → 6 sticks | Rain (V-rain) pours through an open door onto a pile of sticks. |
| 4700 | Winona | 4 door → 7 heaven | A wine owner (Win-ona) opens a door to heaven: a wine cellar in the clouds. |
| 4800 | Wolff | 4 door → 8 gate | A wolf (Wolff) howls at a door behind a locked gate. |
| 4900 | Xavier | 4 door → 9 vine | A lifesaver (Xa-vier, "savior") bursts through a door to rescue a drowning grape vine. |
| 5000 | Yates | 5 hive → 0 hero | A yacht (Yates) rams a beehive and knocks its hero captain overboard. |
| 5100 | Zenobia | 5 hive → 1 bun | A zen boa (Zen-obia) coils around a beehive, meditating on a bun. |
| 5200 | Sheridan (anchor) | 5 hive → 2 shoe | Shears (Sheri-dan) snip a beehive in half and out drops a shoe. Anchor; end of rotation 2. |
| 5300 | Ames | 5 hive → 3 tree | Aim (Ames) an arrow at a beehive hanging from a tree. |
| 5400 | Benton | 5 hive → 4 door | A bent ton weight (Ben-ton) crushes a beehive against a door. |
| 5500 | Chase | 5 hive → 5 hive | A chase: you sprint away from two angry beehives. |
| 5600 | Depew | 5 hive → 6 sticks | A church pew (De-pew) swarming with a beehive and piled high with sticks. |
| 5700 | Eaton | 5 hive → 7 heaven | Eatin' (Eaton) honey straight from a beehive up in heaven. |
| 5800 | Fenton | 5 hive → 8 gate | A ton of fencing (Fen-ton) piled around a beehive at the gate. |
| 5900 | Gray | 5 hive → 9 vine | Gray paint (Gray) drips over a beehive and a grape vine. |
| 6000 | Harlan (anchor) | 6 sticks → 0 hero | Hollerin' (Harlan) through a megaphone at a pile of sticks guarded by a hero. Anchor. |
| 6100 | Ingalls | 6 sticks → 1 bun | Gulls splattered with ink (In-galls) fight over sticks and a bun. |
| 6200 | Jay | 6 sticks → 2 shoe | A blue jay builds its nest from sticks and an old shoe. |
| 6300 | Kendall | 6 sticks → 3 tree | A candle (Ken-dall) sets a pile of sticks under a tree on fire. |
| 6400 | Lamar | 6 sticks → 4 door | A llama (La-mar) kicks through a stack of sticks and a door. |
| 6500 | Marshall | 6 sticks → 5 hive | A marshal's badge pinned on a pile of sticks and a beehive. |
| 6600 | Newland | 6 sticks → 6 sticks | New land (Newland): plant two sticks in fresh ground, and they sprout. Pierce lands here too. |
| 6700 | Otis | 6 sticks → 7 heaven | Oats (O-tis) spilled on sticks float up to heaven. |
| 6800 | Pierce (anchor) | 6 sticks → 8 gate | A spear pierces (Pierce) a bundle of sticks and pins them to the gate. Anchor; sometimes on 66. |
| 6900 | Quay | 6 sticks → 9 vine | A key (Quay) unlocks a bundle of sticks chained to a grape vine. |
| 7000 | Reed | 7 heaven → 0 hero | A reed (Reed) pipe played up in heaven by a hero. |
| 7100 | Saulsbury | 7 heaven → 1 bun | Salt pours down from heaven and buries (Sauls-bury) a bun. |
| 7200 | Teller | 7 heaven → 2 shoe | A bank teller (Teller) up in heaven slides a shoe out through the window. |
| 7300 | Upham | 7 heaven → 3 tree | Up, ham! (Up-ham): a ham flies up to heaven and lands in a tree. |
| 7400 | Vance | 7 heaven → 4 door | A van (Vance) drives up to heaven and parks at a door. |
| 7500 | Webster | 7 heaven → 5 hive | A spider web (Web-ster) spun from heaven down to a beehive. |
| 7600 | Wadsworth (anchor) | 7 heaven → 6 sticks | Wads of cash (Wads-worth) stuffed in heaven, tied with sticks. Anchor. |
| 7700 | Yukon | 7 heaven → 7 heaven | You con (Yu-kon): a con artist sells the same patch of heaven twice: heaven, then heaven again. |
| 7800 | Yarrow | 7 heaven → 8 gate | A yarrow flower shot like an arrow (Y-arrow) from heaven through a gate. |
| 7900 | Zephyr | 7 heaven → 9 vine | A zephyr, the west wind, blows from heaven and shakes a grape vine. End of rotation 3. |
| 8000 | Allison | 8 gate → 0 hero | "All is on!" (Alli-son): a gate lit up like a stage with a hero standing in it. |
| 8100 | Ammons | 8 gate → 1 bun | Ammo (Ammons): a firecracker in the gate blasts out a bun. |
| 8200 | Balsam | 8 gate → 2 shoe | A balsam fir tied to a gate with a shoelace from a shoe. |
| 8300 | Brentwood | 8 gate → 3 tree | Burnt wood (Brent-wood) smolders at the gate beside a charred tree. |
| 8400 | Carr (anchor) | 8 gate → 4 door | A car (Carr) crashes through a gate and a door. Anchor. |
| 8500 | Cody | 8 gate → 5 hive | A code (Cody) lock on a gate keeps out a beehive. |
| 8600 | Dover | 8 gate → 6 sticks | A dove flies over (Dov-er) a gate carrying sticks for its nest. |
| 8700 | Dudley | 8 gate → 7 heaven | A dud (Dud-ley) firework fizzles at the gate and drifts up to heaven. |
| 8800 | Estes | 8 gate → 8 gate | A nest (Estes) balanced on two gates side by side. |
| 8900 | Everett | 8 gate → 9 vine | Ever wet (Ever-ett): a gate always dripping from the grape vine above it. |
| 9000 | Field | 9 vine → 0 hero | A field of grape vines to the horizon, with a hero standing in the middle. |
| 9100 | Flower | 9 vine → 1 bun | A flower blooms on a grape vine growing out of a bun. |
| 9200 | Garrison (anchor) | 9 vine → 2 shoe | A garrison of soldiers climbs a grape vine to rescue a stranded shoe. Anchor. |
| 9300 | Garland | 9 vine → 3 tree | A garland of grape vines wrapped around a tree. |
| 9400 | Holland | 9 vine → 4 door | Holland: a windmill with a grape vine growing over its door, tulips all around. |
| 9500 | Hoyt | 9 vine → 5 hive | Hoist (Hoyt) a grape vine up with a crane to a beehive. |
| 9600 | Independence | 9 vine → 6 sticks | Independence Day fireworks burst out of grape vines and sticks. |
| 9700 | Iris | 9 vine → 7 heaven | A purple iris flower climbs a grape vine to heaven. |
| 9800 | Jellison | 9 vine → 8 gate | Jelly's on (Jelli-son): grape jelly from the vine smeared all over the gate. |
| 9900 | Johnson | 9 vine → 9 vine | A jar in the sun (John-son) with two grape vines bursting out of it. |
| 10000 | Kipling (anchor) | 1 bun → 0 hero → 0 hero | A kipper fish (Kip-ling) in a bun, guarded by two heroes. Anchor. |
| 10100 | Kline | 1 bun → 0 hero → 1 bun | A climb (Kline): scale a bun, pass a hero, top out on another bun. |
| 10200 | Lee | 1 bun → 0 hero → 2 shoe | A leaf (Lee-f) wraps up a bun, a hero and a shoe. |
| 10300 | Lewis | 1 bun → 0 hero → 3 tree | A loose (Lew-is) bun rolls past a hero and up a tree. |
| 10400 | Miller | 1 bun → 0 hero → 4 door | A miller's stone grinds a bun, a hero and a door into flour. |
| 10500 | Moore | 1 bun → 0 hero → 5 hive | Moor (Moore) a boat to a bun, a hero and a beehive. |
| 10600 | Nelson | 1 bun → 0 hero → 6 sticks | Kneel in the sun (Nel-son) before a bun, a hero and a pile of sticks. |
| 10700 | Newcombe | 1 bun → 0 hero → 7 heaven | A new comb (Newcombe) combs a bun, a hero and a cloud in heaven. |
| 10800 | Oak (anchor) | 1 bun → 0 hero → 8 gate | An oak with a bun, a hero and a gate carved into its trunk. Anchor. |
| 10900 | Owens | 1 bun → 0 hero → 9 vine | Ovens (Owens) baking a bun, a hero and grapes from the vine. |
| 11000 | Parfet | 1 bun → 1 bun → 0 hero | A parfait (Parfet) layered with two buns and a hero on top. |
| 11100 | Pierson | 1 bun → 1 bun → 1 bun | A pier (Pier-son) built on three buns in a row. |
| 11200 | Quail | 1 bun → 1 bun → 2 shoe | A quail nests on two buns and a shoe. |
| 11300 | Queen | 1 bun → 1 bun → 3 tree | A queen crowns two buns and a tree. |
| 11400 | Robb | 1 bun → 1 bun → 4 door | A robber (Robb) sneaks off with two buns and a door. |
| 11500 | Routt | 1 bun → 1 bun → 5 hive | A route (Routt) sign points past two buns to a beehive. |
| 11600 | Simms (anchor) | 1 bun → 1 bun → 6 sticks | Swim (Simms) across Standley Lake on two buns and a raft of sticks. Anchor. |
| 11700 | Swadley | 1 bun → 1 bun → 7 heaven | Swaddle (Swad-ley) a baby between two buns and float it up to heaven. |
| 11800 | Tabor | 1 bun → 1 bun → 8 gate | A tabor drum (Tabor) beaten with two buns at the gate. |
| 11900 | Taft | 1 bun → 1 bun → 9 vine | Taffy (Taft) stretched between two buns and a grape vine. |
| 12000 | Union | 1 bun → 2 shoe → 0 hero | An onion (Union) stacked with a bun, a shoe and a hero. |
| 12100 | Urban | 1 bun → 2 shoe → 1 bun | An urban skyline built from a bun, a shoe and another bun. |
| 12200 | Van Gordon | 1 bun → 2 shoe → 2 shoe | A van full of gourds (Van Gord-on) carrying a bun and two shoes. |
| 12300 | Vivian | 1 bun → 2 shoe → 3 tree | Vivid (Viv-ian) colors on a count of 1-2-3: bun, shoe, tree. |
| 12400 | Welch (anchor) | 1 bun → 2 shoe → 4 door | A welder (Wel-ch) fuses a bun, a shoe and a door together. Anchor. |
| 12500 | Wright | 1 bun → 2 shoe → 5 hive | Write (Wright) with a quill on a bun, a shoe and a beehive. |
| 12600 | Xenon | 1 bun → 2 shoe → 6 sticks | A xenon headlight shines on a bun, a shoe and a pile of sticks. |
| 12700 | Xenophon | 1 bun → 2 shoe → 7 heaven | A xylophone (Xeno-phon) played on a bun, a shoe and a cloud in heaven. |
| 12800 | Yank | 1 bun → 2 shoe → 8 gate | Yank a rope tied to a bun, a shoe and the gate. There is no 12900. |
| 13000 | Zang | 1 bun → 3 tree → 0 hero | Zang! A gong struck with a bun, a tree and a hero. |
| 13100 | Zinnia | 1 bun → 3 tree → 1 bun | A zinnia flower sprouts from a bun, a tree and another bun. |
| 13200 | Alkire (anchor) | 1 bun → 3 tree → 2 shoe | All fire (Al-kire): a bun, a tree and a shoe all ablaze. Anchor; end of the sheet. |
