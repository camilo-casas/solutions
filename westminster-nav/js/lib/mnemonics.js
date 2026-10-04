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

/** Three hooks per block: [Picture it, Say it, Link it]. */
export const HOOKS = {
  // Rotation 1: tribes and places. Letter position = hundreds.
  0: [
    'Broadway is ground zero. Every west address counts out from here.',
    "Broadway is zero, where every count starts.",
    "Broadway is the starting line. Every rotation runs west from here.",
  ],
  100: [
    'A = 1. Acoma is the first step off Broadway.',
    "One hundred, Acoma: first in line, no drama.",
    "Step off Broadway and here a-come-a Acoma, the first street west.",
  ],
  200: [
    'B = 2. "Ban-KNOCK": knock twice on the door.',
    "Two hundred, Bannock: knock, knock.",
    "Acoma came, then Bannock banged on the door.",
  ],
  300: [
    'C = 3. A Cherokee Jeep with 3 kids in the back seat.',
    "Three hundred, Cherokee: easy as A-B-C.",
    "Bannock knocked, and a Cherokee Jeep pulled up.",
  ],
  400: [
    'D = 4. Washington crossing the Delaware, 4 oars in the water.',
    "Four hundred, Delaware: D is four, I swear.",
    "The Cherokee Jeep drives all the way to Delaware.",
  ],
  500: [
    'E = 5. "Elated!" Give me a high five.',
    "Five hundred, Elati: high five, party!",
    "Delaware's done, so Elati is elated.",
  ],
  600: [
    'F = 6. A fox carrying 6 sticks in its mouth.',
    "Six hundred, Fox: a fox in a box.",
    "Elati's party gets crashed by a fox.",
  ],
  700: [
    'G = 7. Sail all 7 seas to reach the Galápagos.',
    "Seven hundred, Galápago: seven seas to go.",
    "The fox stows away on a ship to the Galápagos.",
  ],
  800: [
    'H = 8. Lake Huron: an 8 is two lakes stacked. First anchor, about ½ mile out.',
    "Eight hundred, Huron: the first anchor's on.",
    "From the Galápagos, sail north to Lake Huron.",
  ],
  900: [
    'I = 9. Inca gold puts you on cloud 9.',
    "Nine hundred, Inca: gold in the sink-a.",
    "Lake Huron washes up Inca gold.",
  ],
  1000: [
    'J = 10. Jason and the Argonauts, a perfect 10. Santa Fe Dr runs here too.',
    "Ten hundred, Jason: Santa Fe's in the station.",
    "Jason (Santa Fe) steals the Inca gold.",
  ],
  1100: [
    'K = 11. "Calc-a-math": the 11 looks like two pencils.',
    "Eleven hundred, Kalamath: do the math.",
    "Jason hires Kalamath to count the gold.",
  ],
  1200: [
    'L = 12. "Lip-pan": a dozen eggs sizzling in a pan.',
    "Twelve hundred, Lipan: a dozen in the pan.",
    "Kalamath counts a dozen eggs into the Lipan.",
  ],
  1300: [
    'M = 13. Mariposa means butterfly: an unlucky 13 black butterflies.',
    "Thirteen hundred, Mariposa: flutter closer.",
    "Smoke from the Lipan drives out a mariposa (butterfly).",
  ],
  1400: [
    'N = 14. A Navajo blanket for Valentine\'s Day, Feb 14.',
    "Fourteen hundred, Navajo: a Valentine's glow.",
    "The butterfly lands on a Navajo blanket.",
  ],
  1500: [
    'O = 15. Osage oranges racked like the 15 balls in pool.',
    "Fifteen hundred, Osage: rack 'em on the stage.",
    "Roll Osage oranges up in the Navajo blanket.",
  ],
  1600: [
    'P = 16. Pecos Bill moves into 1600 Pennsylvania Ave. Anchor: 2 × 800.',
    "Sixteen hundred, Pecos: the second anchor goes.",
    "Osage oranges feed Pecos Bill's horse.",
  ],
  1700: [
    'Q = 17. A quiver holding 17 arrows.',
    "Seventeen hundred, Quivas: arrows in the quiver.",
    "Pecos Bill grabs his Quivas quiver.",
  ],
  1800: [
    'R = 18. At 18 you can vote, a rare right ("Rare-itan").',
    "Eighteen hundred, Raritan: vote when you can.",
    "An arrow from the quiver hits a rare Raritan.",
  ],
  1900: [
    'S = 19. "Show\'s on!" The show starts at 19:00.',
    "Nineteen hundred, Shoshone: the show goes on.",
    "The Raritan stars in the Shoshone show.",
  ],
  2000: [
    'T = 20. Tejon has 20/20 vision.',
    "Two thousand, Tejon: tee it up, game on.",
    "After the show, tee off at Tejon.",
  ],
  2100: [
    'U = 21. "U-matter!" Blackjack, 21.',
    "Twenty-one hundred, Umatilla: a blackjack thriller.",
    "Tejon's golfers gamble at Umatilla.",
  ],
  2200: [
    'V = 22. Vallejo: a valley with two swans, 2-2.',
    "Twenty-two hundred, Vallejo: two swans in a row.",
    "Win at Umatilla, then rest in the Vallejo valley.",
  ],
  2300: [
    'W = 23. "Why-and-dot?" asks Michael Jordan, #23.',
    "Twenty-three hundred, Wyandot: Jordan's spot.",
    "Leaving the Vallejo valley, ask \"why and dot?\" (Wyandot).",
  ],
  2400: [
    'Z closes rotation 1 (no X or Y here). Zuni ends the day: 24 hours. Anchor.',
    "Twenty-four hundred, Zuni: rotation one is done-y.",
    "No X or Y here: jump from Wyandot straight to Zuni, the end of the line.",
  ],

  // Rotation 2: great Americans. Start at 2400, add the letter.
  2500: [
    'A starts rotation 2. Alcott\'s Little Women opens on Christmas, the 25th.',
    "Twenty-five hundred, Alcott: Christmas on the spot.",
    "Past Zuni the alphabet starts over with Louisa May Alcott.",
  ],
  2600: [
    'B. Bryant, a "bright ant", marches all 26 letters of the alphabet.',
    "Twenty-six hundred, Bryant: the alphabet giant.",
    "Alcott hands her book to Bryant.",
  ],
  2700: [
    'C. Mold the 27 Club out of clay.',
    "Twenty-seven hundred, Clay: molded today.",
    "Bryant sculpts the book out of clay.",
  ],
  2800: [
    'D. "Deck-a-tour": tour the deck for the 28 days of February.',
    "Twenty-eight hundred, Decatur: February's later.",
    "Load the clay onto the Decatur deck.",
  ],
  2900: [
    'E. Eliot only throws a party on Feb 29.',
    "Twenty-nine hundred, Eliot: leap year, I'll tell it.",
    "Eliot climbs aboard Decatur's deck.",
  ],
  3000: [
    'F. The Feds round it off: 3000. Anchor (US-287).',
    "Three thousand, Federal: round and general.",
    "Eliot gets picked up by the Feds (Federal).",
  ],
  3100: [
    'G. A grove of 31 ice-cream flavors.',
    "Thirty-one hundred, Grove: flavors by the drove.",
    "The Feds raid an ice-cream grove.",
  ],
  3200: [
    'H. Ice fishing with a hook: water freezes at 32°F.',
    "Thirty-two hundred, Hooker: an ice-cold looker.",
    "The grove has a frozen pond: drop a hook (Hooker).",
  ],
  3300: [
    'I. Irving\'s headless horseman spins a 33 rpm record.',
    "Thirty-three hundred, Irving: the record's swerving.",
    "Hook a headless horseman, Washington Irving's.",
  ],
  3400: [
    'J. Julian\'s jewel box: 3 diamonds, 4 rubies.',
    "Thirty-four hundred, Julian: jewels by the million.",
    "The horseman's missing head is a Julian jewel.",
  ],
  3500: [
    'K. The King shot on 35 mm film.',
    "Thirty-five hundred, King: film everything.",
    "The jewel goes in the King's crown.",
  ],
  3600: [
    'L. Lowell: a "low well" with a 360° view. Anchor.',
    "Thirty-six hundred, Lowell: the anchor's in the well.",
    "The King drops his crown down the low well (Lowell).",
  ],
  3700: [
    'M. A mug of mead at 37°C body temperature.',
    "Thirty-seven hundred, Meade: warm as you need.",
    "Pour mead (Meade) down the low well.",
  ],
  3800: [
    'N. The apple hits Newton at 38.',
    "Thirty-eight hundred, Newton: the apple's shootin'.",
    "The mead ferments the apple that falls on Newton.",
  ],
  3900: [
    'O. Osceola: "39 and holding."',
    "Thirty-nine hundred, Osceola: holding steady, hola.",
    "Newton's apple rolls over to Osceola.",
  ],
  4000: [
    'P. Perry turns 40.',
    "Four thousand, Perry: forty and merry.",
    "Osceola sails with Commodore Perry.",
  ],
  4100: [
    'Q. Quitman quits at 41.',
    "Forty-one hundred, Quitman: quit it, man.",
    "Perry's crew mutinies and quits (Quitman).",
  ],
  4200: [
    'R. Raleigh rides a bike to 42, the answer to everything.',
    "Forty-two hundred, Raleigh: the answer's jolly.",
    "The quitter rides off on a Raleigh bike.",
  ],
  4300: [
    'S. Stuart\'s stew simmers 43 minutes.',
    "Forty-three hundred, Stuart: stew in the cart.",
    "The Raleigh bike delivers Stuart's stew.",
  ],
  4400: [
    'T. Tennyson: "tennis son" plays at 40-40, so 44. Anchor.',
    "Forty-four hundred, Tennyson: love-forty, game's on.",
    "Spill the stew on the tennis court (Tennyson).",
  ],
  4500: [
    'U. Utica spins a 45 rpm record.',
    "Forty-five hundred, Utica: spin the record, you pick-a.",
    "Tennyson's tennis ball bounces into Utica.",
  ],
  4600: [
    'V. Vrain sounds like "brain": 46 chromosomes.',
    "Forty-six hundred, Vrain: chromosomes on the brain.",
    "Utica's record skips and rattles Vrain's brain.",
  ],
  4700: [
    'W. Winona rides with the 47 Ronin.',
    "Forty-seven hundred, Winona: Ronin on the corner.",
    "Vrain's brain dreams of Winona.",
  ],
  4800: [
    'Second W. A wolf (Wolff) roams the lower 48.',
    "Forty-eight hundred, Wolff: the lower states howl.",
    "Winona hears a wolf (Wolff) howl: two W's in a row.",
  ],
  4900: [
    'X. Xavier signs with the 49ers.',
    "Forty-nine hundred, Xavier: a gold-rush savior.",
    "The wolf chases Xavier.",
  ],
  5000: [
    'Y. Yates sails yachts worth 50 grand.',
    "Five thousand, Yates: a yacht that waits.",
    "Xavier escapes on Yates's yacht.",
  ],
  5100: [
    'Z. Zenobia, queen of Area 51.',
    "Fifty-one hundred, Zenobia: Area 51 phobia.",
    "The yacht lands at Zenobia's Area 51.",
  ],
  5200: [
    'Sheridan closes rotation 2. "Sheri deals" all 52 cards. Anchor.',
    "Fifty-two hundred, Sheridan: deal the deck again.",
    "Zenobia's aliens play 52-card pickup with Sheridan.",
  ],

  // Rotation 3: senators, justices, politicians. Start at 5200, add the letter.
  5300: [
    'A starts rotation 3 just past Sheridan. Aim at Herbie, the Love Bug #53.',
    "Fifty-three hundred, Ames: Herbie's game.",
    "Past Sheridan the alphabet starts over: take aim (Ames) again.",
  ],
  5400: [
    'B. Benton is bent on dancing at Studio 54.',
    "Fifty-four hundred, Benton: the Studio door's open.",
    "Ames's arrow is bent (Benton).",
  ],
  5500: [
    'C. A car chase at 55 mph.',
    "Fifty-five hundred, Chase: a double-nickel race.",
    "Benton bends the rules and starts a chase.",
  ],
  5600: [
    'D. Sit in the pew (De-PEW) with the 56 signers of the Declaration.',
    "Fifty-six hundred, Depew: signers in the pew.",
    "The chase ends in church (Depew).",
  ],
  5700: [
    'E. Eaton has eaten all the Heinz 57.',
    "Fifty-seven hundred, Eaton: the ketchup's been eaten.",
    "After church, Eaton eats lunch.",
  ],
  5800: [
    'F. Fenton fences in a \'58 Chevy.',
    "Fifty-eight hundred, Fenton: fence it in.",
    "Eaton's leftovers get fenced in by Fenton.",
  ],
  5900: [
    'G. Gray hair at 59.',
    "Fifty-nine hundred, Gray: almost sixty, hey.",
    "Fenton's fence is painted gray.",
  ],
  6000: [
    'H. Harlan\'s Harley hits 60. Anchor.',
    "Six thousand, Harlan: the Harley's startin'.",
    "A gray Harley pulls out: Harlan.",
  ],
  6100: [
    'I. Ingalls hits 61 homers like Roger Maris.',
    "Sixty-one hundred, Ingalls: home-run balls.",
    "Harlan rides out to the Ingalls prairie.",
  ],
  6200: [
    'J. A jaywalker at 6:20.',
    "Sixty-two hundred, Jay: jaywalk away.",
    "A blue jay lands on the Ingalls' house.",
  ],
  6300: [
    'K. A Ken doll (Kendall) in a treehouse of sticks: sticks 6, tree 3.',
    "Sixty-three hundred, Kendall: Ken's a doll.",
    "The jay pecks at a Ken doll (Kendall).",
  ],
  6400: [
    'L. Lamar sings "When I\'m 64."',
    "Sixty-four hundred, Lamar: Beatles on guitar.",
    "Ken drives off in Lamar's car.",
  ],
  6500: [
    'M. The marshal retires at 65.',
    "Sixty-five hundred, Marshall: retires, badge and all.",
    "Lamar gets pulled over by a marshal.",
  ],
  6600: [
    'N. New land on Route 66. Heads up: Pierce jumps onto this 6600 line in some parts of town.',
    "Sixty-six hundred, Newland: Route 66 is grand (and Pierce lands here too).",
    "The marshal heads west to new land (Newland).",
  ],
  6700: [
    'O. An Otis elevator to floor 67.',
    "Sixty-seven hundred, Otis: ride up and notice.",
    "Newland's first building gets an Otis elevator.",
  ],
  6800: [
    'P. Pierce pierces a sticks-and-gate fence: 6, 8. Anchor. But in some areas Pierce cuts back two blocks to Route 66 (6600): picture the arrow piercing the Route 66 sign.',
    "Sixty-eight hundred, Pierce: the anchor's fierce (but sometimes 66, so don't be fooled).",
    "The Otis elevator pierces the roof (Pierce).",
  ],
  6900: [
    'Q. Quay is said "key": the key to room 69.',
    "Sixty-nine hundred, Quay: turn the key.",
    "Pierce the lock with a key (Quay).",
  ],
  7000: [
    'R. Reed reads the 7:00 news.',
    "Seven thousand, Reed: the news you read.",
    "The key opens a box of reeds.",
  ],
  7100: [
    'S. Saulsbury ("salt\'s bury"): salt water covers 71% of Earth.',
    "Seventy-one hundred, Saulsbury: in salty sea, bury.",
    "Bury the reeds in salt (Saulsbury).",
  ],
  7200: [
    'T. The bank teller works 72 hours straight.',
    "Seventy-two hundred, Teller: the bank's best seller.",
    "Take the salt money to a teller.",
  ],
  7300: [
    'U. "Up \'em!" Hands up for 73 seconds.',
    "Seventy-three hundred, Upham: hands up, ma'am.",
    "A robber tells the teller \"Up 'em!\" (Upham).",
  ],
  7400: [
    'V. Vance advances 74 yards for a touchdown.',
    "Seventy-four hundred, Vance: advance the chance.",
    "Hands up, then advance (Vance).",
  ],
  7500: [
    'W. Webster\'s dictionary: 75 thousand words.',
    "Seventy-five hundred, Webster: look it up, mister.",
    "Vance looks up \"advance\" in Webster's.",
  ],
  7600: [
    'Second W. Wadsworth: 76 trombones led the big parade. Anchor.',
    "Seventy-six hundred, Wadsworth: trombones march forth.",
    "The next word in Webster's is Wadsworth: two W's in a row.",
  ],
  7700: [
    'Y (no X in rotation 3). The Yukon at minus 77.',
    "Seventy-seven hundred, Yukon: lucky sevens frozen on.",
    "No X here: Wadsworth marches straight to the Yukon.",
  ],
  7800: [
    'Second Y. Yarrow spins a 78 rpm record.',
    "Seventy-eight hundred, Yarrow: the record spins narrow.",
    "Yarrow flowers bloom in the Yukon: two Y's.",
  ],
  7900: [
    'Z. Zephyr, the west wind, blows rotation 3 shut at 79.',
    "Seventy-nine hundred, Zephyr: the west wind forever.",
    "A zephyr scatters the yarrow.",
  ],

  // Rotation 4: governors, Jefferson County pioneers, flora. Two names per letter.
  8000: [
    'A, 1st of the pair. Allison\'s big 80s hair.',
    "Eight thousand, Allison: rotation four's begun.",
    "Past Zephyr the double alphabet starts with Allison.",
  ],
  8100: [
    'A, 2nd. Ammons props an ammo box against a gate with a bun on top: gate 8, bun 1.',
    "Eighty-one hundred, Ammons: the ammo's on.",
    "Allison loads Ammons' ammo.",
  ],
  8200: [
    'B, 1st. A balsam fir for Christmas \'82.',
    "Eighty-two hundred, Balsam: the fir is awesome.",
    "Ammons hunts in a balsam forest.",
  ],
  8300: [
    'B, 2nd. Brentwood\'s rent: a gate and a tree, 8-3.',
    "Eighty-three hundred, Brentwood: the rent's good.",
    "The balsam firs become Brentwood lumber.",
  ],
  8400: [
    'C, 1st. The car (Carr) hits 84 on the highway. Anchor.',
    "Eighty-four hundred, Carr: the anchor car.",
    "The Brentwood lumber goes in a car (Carr).",
  ],
  8500: [
    'C, 2nd. Buffalo Bill Cody\'s herd of 85.',
    "Eighty-five hundred, Cody: buffalo, slowly.",
    "The car drives to Cody, Wyoming.",
  ],
  8600: [
    'D, 1st. Dover is "over": bartenders "86" you.',
    "Eighty-six hundred, Dover: eighty-six, it's over.",
    "Buffalo Bill Cody gets 86'd from a Dover bar.",
  ],
  8700: [
    'D, 2nd. "Four score and seven" (87) years ago, Dudley read.',
    "Eighty-seven hundred, Dudley: four score, truly.",
    "Dover's bouncer is Dudley.",
  ],
  8800: [
    'E, 1st. Estes Park\'s Stanley Hotel piano: 88 keys.',
    "Eighty-eight hundred, Estes: eighty-eight keys at the Stanley.",
    "Dudley takes a vacation in Estes Park.",
  ],
  8900: [
    'E, 2nd. Everett lives forever, to 89.',
    "Eighty-nine hundred, Everett: never forget it.",
    "From Estes Park, hike up Mount Everett.",
  ],
  9000: [
    'F, 1st. "It\'s over 9000!" shouted across the field.',
    "Nine thousand, Field: the score's revealed.",
    "From the peak you see a wide field.",
  ],
  9100: [
    'F, 2nd. Flowers delivered on 9/1.',
    "Ninety-one hundred, Flower: a September shower.",
    "The field bursts into flower.",
  ],
  9200: [
    'G, 1st. The garrison\'s gate is a vine and a shoe, 9-2. Anchor.',
    "Ninety-two hundred, Garrison: the anchor's guardian.",
    "Soldiers from the garrison pick the flowers.",
  ],
  9300: [
    'G, 2nd. A garland of 93 lights.',
    "Ninety-three hundred, Garland: decked out and grand.",
    "The garrison hangs a garland.",
  ],
  9400: [
    'H, 1st. Holland\'s windmills: vine on the door, 9-4.',
    "Ninety-four hundred, Holland: windmills rollin'.",
    "The garland comes from Holland.",
  ],
  9500: [
    'H, 2nd. Hoyt climbs a vine to hoist a beehive: vine 9, hive 5.',
    "Ninety-five hundred, Hoyt: hoist it, boy.",
    "Hoist (Hoyt) the Holland windmill blades.",
  ],
  9600: [
    'I, 1st. Independence Day, the 1996 movie.',
    "Ninety-six hundred, Independence: the fireworks commence.",
    "Hoyt hoists the flag on Independence Day.",
  ],
  9700: [
    'I, 2nd. An iris climbs a vine to heaven, 9-7.',
    "Ninety-seven hundred, Iris: eyes on the prize, sir.",
    "The fireworks reflect in your iris.",
  ],
  9800: [
    'J, 1st. Jelly at 98.6°F body temperature.',
    "Ninety-eight hundred, Jellison: jelly at 98.6.",
    "Something in your iris? Wipe it with Jellison jelly.",
  ],
  9900: [
    'J, 2nd. Mr. Johnson has 99 problems.',
    "Ninety-nine hundred, Johnson: problems by the ton, son.",
    "The jelly sticks to Mr. Johnson.",
  ],
  10000: [
    'K, 1st. Kipling\'s "If—": score 100%. Anchor.',
    "Ten thousand, Kipling: a perfect score, no slipping.",
    "Johnson reads Kipling's poem \"If—\".",
  ],
  10100: [
    'K, 2nd. Kline 101, the intro course.',
    "Ten-one hundred, Kline: intro's on the line.",
    "Kipling teaches Kline 101.",
  ],
  10200: [
    'L, 1st. Lee runs a 102° fever.',
    "Ten-two hundred, Lee: a fever of one-oh-two degrees.",
    "Kline's student Lee comes down with a fever.",
  ],
  10300: [
    'L, 2nd. Lewis & Clark paddle 103 miles.',
    "Ten-three hundred, Lewis: paddle on through, kids.",
    "Lee joins Lewis on the expedition.",
  ],
  10400: [
    'M, 1st. Miller Time at 10:40.',
    "Ten-four hundred, Miller: ten-four, good buddy.",
    "Lewis stops at the miller's mill.",
  ],
  10500: [
    'M, 2nd. "More!" Moore is one more than Miller: 105.',
    "Ten-five hundred, Moore: one more.",
    "The miller wants more (Moore) flour.",
  ],
  10600: [
    'N, 1st. Nelson\'s sandwich: a bun, a hero, and sticks: 1-0-6.',
    "Ten-six hundred, Nelson: the wrestling's still on.",
    "Moore puts Nelson in a half nelson.",
  ],
  10700: [
    'N, 2nd. A new comb with 107 teeth.',
    "Ten-seven hundred, Newcombe: a new comb comes.",
    "After wrestling, Nelson needs a new comb (Newcombe).",
  ],
  10800: [
    'O, 1st. An oak bat and a baseball\'s 108 stitches. Anchor.',
    "Ten-eight hundred, Oak: the stitches are no joke.",
    "The new comb is carved from oak.",
  ],
  10900: [
    'O, 2nd. Owens owes 109 bucks.',
    "Ten-nine hundred, Owens: Jesse's going.",
    "Jesse Owens sprints past the oak.",
  ],
  11000: [
    'P, 1st. Parfet is "perfect": 110% effort.',
    "Eleven thousand, Parfet: perfect, let's get it.",
    "Owens's run is perfect (Parfet).",
  ],
  11100: [
    'P, 2nd. Pierson\'s pier stands on three posts: 1-1-1.',
    "Eleven-one hundred, Pierson: three ones on the pier, son.",
    "Parfet celebrates on Pierson's pier.",
  ],
  11200: [
    'Q, 1st. A quail calls 112, Europe\'s emergency number.',
    "Eleven-two hundred, Quail: one-one-two without fail.",
    "A quail lands on the pier.",
  ],
  11300: [
    'Q, 2nd. The Queen\'s lucky 13: 113.',
    "Eleven-three hundred, Queen: thirteen's her scene.",
    "The Queen hunts quail.",
  ],
  11400: [
    'R, 1st. Robb robs a bun, a bun and a door: 1-1-4.',
    "Eleven-four hundred, Robb: robbing's his job.",
    "Robb robs the Queen.",
  ],
  11500: [
    'R, 2nd. Routt\'s route: bun, bun, beehive, 1-1-5.',
    "Eleven-five hundred, Routt: the getaway route.",
    "Robb flees by Routt's route.",
  ],
  11600: [
    'S, 1st. Simms, near Standley Lake: sweet 16 plus 100. Anchor.',
    "Eleven-six hundred, Simms: the anchor by the lake's rims.",
    "The route ends at Simms, by Standley Lake.",
  ],
  11700: [
    'S, 2nd. A baby swaddled (Swadley) between two buns, floating to heaven: 1-1-7.',
    "Eleven-seven hundred, Swadley: swaddle the baby.",
    "At Simms you find a baby to swaddle (Swadley).",
  ],
  11800: [
    'T, 1st. Run a tab (Tabor) for two buns at the gate: 1-1-8.',
    "Eleven-eight hundred, Tabor: run a tab for labor.",
    "The baby's bill goes on Tabor's tab.",
  ],
  11900: [
    'T, 2nd. Big President Taft carries two buns up a vine: 1-1-9.',
    "Eleven-nine hundred, Taft: the biggest laugh.",
    "President Taft pays Tabor's tab.",
  ],
  12000: [
    'U, 1st. A union 120 strong.',
    "Twelve thousand, Union: everyone's in.",
    "Taft gives a speech to the union.",
  ],
  12100: [
    'U, 2nd. Urban bus #121.',
    "Twelve-one hundred, Urban: the city's turnin'.",
    "The union marches downtown (Urban).",
  ],
  12200: [
    'V, 1st. A van (Van Gordon) carrying a bun and two shoes: 1-2-2.',
    "Twelve-two hundred, Van Gordon: the van is boardin'.",
    "The urban marchers ride in Van Gordon's van.",
  ],
  12300: [
    'V, 2nd. Vivian: easy as 1-2-3.',
    "Twelve-three hundred, Vivian: one-two-three, livin'.",
    "Vivian drives the van.",
  ],
  12400: [
    'W, 1st. Welch\'s grape juice, 24 hours a day at 124. Anchor.',
    "Twelve-four hundred, Welch: the grape-juice anchor.",
    "Vivian spills Welch's grape juice.",
  ],
  12500: [
    'W, 2nd. The Wright brothers flew 120 ft; land them at 125.',
    "Twelve-five hundred, Wright: takes flight.",
    "The Wright brothers fly over the spill.",
  ],
  12600: [
    'X, 1st. A xenon headlight shines on a bun, a shoe and sticks: 1-2-6.',
    "Twelve-six hundred, Xenon: the headlights glow on.",
    "The Wright plane switches on xenon headlights.",
  ],
  12700: [
    'X, 2nd. Xenophon eats a bun, ties a shoe and marches to heaven: 1-2-7.',
    "Twelve-seven hundred, Xenophon: the march goes on.",
    "The xenon lights lead Xenophon's march: two X's.",
  ],
  12800: [
    'Y (only one). Yank out the 128 GB thumb drive. There is no 12900.',
    "Twelve-eight hundred, Yank, and twelve-nine is blank.",
    "Xenophon's army yanks (Yank) the flag down. Only one Y.",
  ],
  13000: [
    'Z, 1st. "Zang!" A gong at 130.',
    "Thirteen thousand, Zang: the gong goes bang.",
    "Skip the empty 12900: Yank jumps straight to Zang.",
  ],
  13100: [
    'Z, 2nd. A zinnia on a bun: 13-1.',
    "Thirteen-one hundred, Zinnia: second Z, nearly finished-a.",
    "The Zang gong shakes a zinnia: two Z's.",
  ],
  13200: [
    'A again. Alkire restarts the alphabet and caps the sheet at 132. Anchor.',
    "Thirteen-two hundred, Alkire: back to A, then retire.",
    "After Zinnia the alphabet wraps around to Alkire, the last anchor.",
  ],
};

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

export const HOOK_KINDS = [
  { id: 'picture', label: 'Picture it', why: 'a vivid image tying the name to the number' },
  { id: 'say', label: 'Say it', why: 'a rhyme to say out loud' },
  { id: 'link', label: 'Link it', why: 'a story that chains each street to the one before it' },
];

/** All three hooks for a street. */
export const hooks = (s) => HOOKS[s.block] || [];
/** The picture hook (kept for callers that want one line). */
export const hook = (s) => hooks(s)[0] || '';

/** Extra note for streets that sit on more than one block line. */
export function alsoNote(s) {
  if (s.also?.length) return `${s.name} is ${s.block} on the sheet, but also runs on the ${s.also.join(' and ')} line in some parts of the city.`;
  const sharers = STREETS.filter((x) => x.also?.includes(s.block));
  if (sharers.length) return `${sharers.map((x) => x.name).join(' and ')} also runs on the ${s.block} line in some areas, so ${s.block} can be ${[s.name, ...sharers.map((x) => x.name)].join(' or ')}.`;
  return '';
}
