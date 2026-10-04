# WFD Nav Trainer

A training site for Westminster Fire Department crews: learn the street rotations, then practice getting out of the station and to the address.

It's a static site: plain HTML, CSS and JavaScript modules, with no framework or build step. It works on phones, and progress saves in each person's browser.

## The games

| Game | What you do | How it's graded |
| --- | --- | --- |
| **Rotations** (flash cards) | Pick a deck: **Major streets** (the 18 bold anchors: Broadway, Huron, Pecos, Zuni, Federal, Lowell, Tennyson, Sheridan, Harlan, Pierce, Wadsworth, Carr, Garrison, Kipling, Oak, Simms, Welch, Alkire) or **All streets** (132, filterable by rotation). Modes: **Learn** (guided), Study, Name → Block, Block → Name, Address → Cross streets (`5850 W 94th Ave` → Fenton & Gray), **West or East** (is Carr west or east of Wadsworth?), and **Street side** (`3789 W 127th Ave` → North: odd numbers are on the north and west sides, even on the south and east). | Learn: 6 cards at a time, then a quiz you must pass (5 of 6) to unlock the next set. Practice modes use Leitner spaced repetition: cards you miss come back more often. |
| **Turn Signal** | You get a station and an address. Pick **left** or **right** out of the bay. | The shortest drive-time route is computed both ways. If they're within 0.5%, either answer counts. |
| **Cardinal** | Two modes. **From an address:** you get an address and one of the key hospitals (`data/landmarks.json`) or a WFD station, and pick N, NE, E, SE, S, SW, W or NW ("Everything on the map" adds other landmarks). **From a station:** you leave a WFD station (pick one or random) and pick the direction to a random address. | Straight-line bearing. A neighboring direction gets half credit. |
| **Responder** | Drive from the station to the address one block at a time: ↑ forward to the next intersection, ↓ back up a block, ← → turn onto the cross street. The windshield view and the map sit side by side (stacked on phones), and both have see-through arrow buttons on their edges, labeled with the street each one takes you onto. The windshield shows real streets in perspective (roads only, no buildings), the Front Range on the western horizon, the downtown Denver skyline in its true direction, and a green street-name blade for the cross street (with its hundred-block number) at each intersection as you approach. Your heading (N, NE, E, …) shows at the top center and a trip odometer in the lower right. The map is always on and turns with the truck, so the way you're facing is always up (a small arrow marks north). It follows the truck as it drives, labels the major streets (freeways, highways and arterials), and its Aa button cycles to all street names or none. Hints are optional. | Your drive time is compared with the fastest route, and the best route is drawn over your trail. |
| **Transporter** | Same controls, but you start at a random scene address and drive the patient to a hospital. Switch individual hospitals on or off; calls go to a random hospital that's on. | Same as Responder. |

Turn Signal picks addresses so left and right come up about equally often, even at stations where most calls go one way.

Every answer shows a map with the correct route and explains the grid math (for example, "about 4350 W, between Stuart (4300) and Tennyson (4400)").

## How the memory aids work

Every street has two aids, shown on every card back and on every wrong answer (`js/lib/mnemonics.js`):

- **Letter math**, generated from the sheet. In rotations 1 to 3, block = rotation start + letter position × 100. For example, Lowell: L is the 12th letter and rotation 2 starts after Zuni (2400), so 2400 + 1200 = 3600. Rotation 4 has two names per letter (K pair = Kipling 10000, Kline 10100). The exceptions are explained on the card: skipped letters (no X or Y in rotation 1), doubled letters (Winona/Wolff, Webster/Wadsworth), the boundary streets (Sheridan, Alkire), the missing 12900, and Pierce, which is 6800 on the sheet but also runs on the 6600 line in some areas (`ALSO_AT` in `js/lib/rotations.js`).
- **One mnemonic per street**, built with the keyword method and a peg system, with no pop-culture references. The street name becomes a keyword you can picture by sound or meaning (Lowell is a low well, Kendall is a candle, Mariposa is a butterfly). The hundreds are spelled with one fixed set of rhyming pegs, the same everywhere: 0 hero, 1 bun, 2 shoe, 3 tree, 4 door, 5 hive, 6 sticks, 7 heaven, 8 gate, 9 vine. One vivid scene has the keyword act on the pegs in digit order: "A low well: a tree grows out of it, dropping sticks into the water" = 3600. Tap the mnemonic to open its poster: the street name, the keyword picture, the pegs with their digits, and the hundred block.

Learn mode follows the evidence on memory: encode a small chunk with elaborate, vivid cues; test yourself on it right away (retrieval practice); then come back in spaced sessions. Edit any entry in `MNEMONICS` if your crew has a better one. Streets with a drawing in `data/mnemonic-art/` show it on the poster; the rest use emoji art.

## Look

The colors come from the WFD patch (black, fire-engine red, gold, maroon). The logo itself is not used. Red marks actions and routes; gold marks selection and highlights. Type is Barlow, modeled on highway signage.

## Players and the scoreboard

The start screen asks for a player name, or you can play anonymously. Each name keeps its own scores and flash card progress on the device, and the 👤 chip in the header switches players (handy on a shared station tablet). Anonymous play is never posted.

- **As a Claude artifact**, the scoreboard is shared: everyone who opens the page sees everyone's totals, which are stored in the artifact's database at `scores/<account>`. People need **Contributor** access (or higher) on the artifact to post scores. Viewers can see the board but not post to it.
- **On GitHub Pages or a local server** there's no backend, so the board lists the named players on that device. A shared board here would need a small backend (Firebase, Supabase, or a Google Sheet behind Apps Script) plugged into `js/scoreboard.js`.

## Project layout

```
index.html            app shell
css/style.css         styles (light and dark)
js/app.js             data loading and page routing
js/lib/rotations.js   the rotation sheet (Broadway 0 → Alkire 13200)
js/lib/mnemonics.js   one mnemonic and a letter-math rule for every street
js/mnemonicArt.js     poster pictures for the mnemonics (SVG)
data/mnemonic-art/    drawn illustrations, one <block>.svg per street (see docs/mnemonic-art-brief.md)
tools/build-art.mjs   checks the illustrations and packs them into js/lib/mnemonicArtData.js
tools/bundle-preview.mjs  builds the single-file preview page
js/lib/grid.js        house number <-> coordinates (Denver grid)
js/lib/graph.js       road graph, fastest routes, turn-by-turn directions
js/map.js             canvas map (no tiles, so street names stay hidden until you ask)
js/windshield.js      driver's-eye 3D view for Responder and Transporter (plain canvas, no library)
js/lib/exits.js       freeway exits: where each ramp leads, for the exit signs
js/games/*.js         the games, start screen, scoreboard and station setup
js/scoreboard.js      shared (artifact database) or per-device scoreboard
data/city.json        roads, addresses and points of interest (generated)
data/stations.json    the six WFD stations: address, bay street, bay facing
data/landmarks.json   key hospitals for the Cardinal game
tools/build-data.mjs  builds data/city.json
```

## Map data

`data/city.json` is generated by `tools/build-data.mjs`:

- `node tools/build-data.mjs` downloads the Westminster city boundary, every drivable road, address points and points of interest (hospitals, fire and police stations, libraries, lakes, malls) from OpenStreetMap through the Overpass API. It also re-fits the address grid to where Sheridan, Wadsworth, W 92nd Ave and the other anchor streets really are. If OpenStreetMap doesn't have enough address points, it fills in addresses generated from the grid. Those are marked "approximate" in the games.
- `node tools/build-data.mjs --demo` builds an offline demo grid of arterials and rotation streets. It's useful for trying the games, but it is **not** the real road network, and the site shows a banner when it's loaded.

The repository ships real OpenStreetMap data. To refresh it, either:

1. Open the **Actions** tab on GitHub, choose **Westminster Nav - build map data**, and click **Run workflow**. It builds the data and commits it to the branch. Or:
2. Run `node tools/build-data.mjs` on any computer with Node 18 or newer and internet access, then commit `data/city.json`.

Map data © OpenStreetMap contributors, ODbL.

## Stations

`data/stations.json` holds each station's address, its position, the street the bay opens onto, and which way the apparatus faces when it pulls out. "Left" in Turn Signal and Responder means left from the driver's seat as the truck leaves the bay.

| Station | Address | Bay faces | Onto |
| --- | --- | --- | --- |
| 1 | 3948 W 73rd Ave | South | W 72nd Pl (OpenStreetMap's name for what crews call 72nd Way) |
| 2 | 9150 Lowell Blvd | West | Lowell Blvd |
| 3 | 7702 W 90th Ave | Northeast | W 90th Ave |
| 4 | 4580 W 112th Ave | North | W 112th Ave |
| 5 | 10100 Garland St | West | Garland St |
| 6 | 999 W 124th Ave | South | W 124th Ave |

To adjust one, open **Station setup** (link at the bottom of the home page), tap the map, pick the street and facing, then **Export stations.json** and commit it.

## Hospitals

Transporter drives to every hospital in `data/landmarks.json`. Outside Westminster the map carries the metro freeways and main roads (I-25, I-70, I-76, US-36 and the like, plus primary arterials) and every street within 1.2 km of each hospital. Editing `landmarks.json` triggers a map rebuild, so a new hospital gets its surrounding streets automatically. On a freeway, ↑ drives to the next exit, and ← or → takes the exit ramp onto the cross street. Every exit is signed: a green guide sign beside the ramp in the windshield (exit number when OpenStreetMap has one, the street the ramp reaches and which way it heads, like "W 104th Ave West"), and the turn buttons read "Exit 217 · W 104th Ave East". Ramps are unnamed in OpenStreetMap, so `js/lib/exits.js` follows each ramp to the first named road to get the sign text.


`data/landmarks.json` lists the hospitals used by Cardinal. All positions come from OpenStreetMap; the build prints the nearest OpenStreetMap hospital for each entry so you can check new ones.

## Run it locally

ES modules need a web server (opening `index.html` as a file won't work):

```sh
cd westminster-nav
python3 -m http.server 8000
# open http://localhost:8000
```

## Publish it

`.github/workflows/westminster-nav-pages.yml` deploys this folder to GitHub Pages on every push to `master`. Enable it once under **Settings → Pages → Source: GitHub Actions**.

## Ideas for later

- Shared leaderboards per shift or station (needs a small backend, or a shared Google Sheet).
- Turn-by-turn answers by voice, for hands-free practice.
- Hydrant and box-alarm layers, preplans, and "first-due area" quizzes.
- A timed "speed round" mode for drills.
