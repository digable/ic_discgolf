# Disc Golf: the BBS door

The game itself: a JavaScript door for Synchronet BBS. The web page (`../index.html`) plays these same
files in its emulated terminal, so there's only one copy of the game.

The door is written for Synchronet's JavaScript engine (ES5: no `let`, `const` or arrow functions), so
keep to that style when you edit it.

The files come in two groups. **The rules** don't draw, read keys or wait: they change the game state
and return what happened, so any front end (this door, or a future web or multiplayer version) can
play by exactly the same rules. **The door** is the ANSI screens and keys that play those rules on a
BBS. Keep the split: a rule goes in a rules file, never in a door loop.

| File | What it does |
|---|---|
| `discgolf.js` | The door you install. Loads everything in `lib/`, in order, then runs the main menu. |
| **The rules** | |
| `lib/config.js` | Tuning: the swing meter, the 80×25 screen layout and the player model (arm speed, off hand, putting range). |
| `lib/util.js` | Basics: math, text padding and seeded random numbers. |
| `lib/discs.js` | The disc catalog, with each maker's published speed, glide, turn and fade. |
| `lib/courses.js` | The courses and their holes. The comment at the top explains each field; each course's details are in the main README, "Courses". |
| `lib/player.js` | The player: name, hands, throws and the bag. |
| `lib/holes.js` | Building a hole from the course data: trees, lies and elevation. |
| `lib/state.js` | The game state (`R` the round, `S` the hole being played, `PT` the putt), house rules, wind, disc range and the automatic disc pick. |
| `lib/flight.js` | Disc flight: how a throw curves, and where it ends up. |
| `lib/rules.js` | Playing it: start a round or hole, aim, throw, take a mulligan or relief, putt. Each changes the state and returns what happened. |
| **The door** | |
| `lib/screen.js` | The clock, raw ANSI output (tracks cursor and color) and key input. |
| `lib/meter.js` | Lag measurement and the 3-click swing meter. |
| `lib/saves.js` | Saved settings for BBS players: loads and saves them through the save service (`../server.js`) using Synchronet's `http.js`. |
| `lib/hud.js` | What the door is showing (`V`: map or view from the lie, the range mark, the message), the header, messages, key help and the disc/throw/wind panel. |
| `lib/map.js` | The overhead hole map, with the range mark and the flight path to it. |
| `lib/pov.js` | The view from the player's lie, and the shot screen. |
| `lib/shot.js` | The throw (swing, the flight on the map, what happened) and the relief screen. |
| `lib/putt.js` | Putting: overhead and from-the-player views. |
| `lib/round.js` | Playing a hole, the scorecard and a full round. |
| `lib/menus.js` | Title screen, signing in (BBS alias or a typed web name, welcome back), player setup, house rules, bag and how to play. |

## How the files fit together

`discgolf.js` pulls in each file with `load(js.exec_dir + "lib/name.js")`. On Synchronet that runs the
file in the door's global scope, so everything it defines is visible to the others. The library files
only define things (constants, data and functions); nothing runs until the main loop at the bottom of
`discgolf.js`. Order still matters for constants that use earlier ones (`PP_HORIZON` in `putt.js` uses
`MAP_Y` from `config.js`), so add new files to the list in a sensible place: rules files before the
door's. The rules files load and play on their own in plain Node (`vm.runInContext`, no stubs needed),
which is a quick way to test a rule change.

The web page does the same: it fetches `discgolf.js`, finds those `load(...)` lines and puts each file's
text in its place, then runs the result as one script. Only lines written exactly as
`load(js.exec_dir + "lib/name.js");` are joined this way. Errors in the browser name the file and line,
for example `(lib/putt.js line 42)`.

## Install on Synchronet

1. Copy `discgolf.js` and the `lib/` folder to a folder under your Synchronet install, for example
   `xtrn/discgolf/`.
2. In SCFG, go to **External Programs > Online Programs (Doors)**, pick a section, and add a program:
   - **Name:** Disc Golf
   - **Start-up Directory:** `../xtrn/discgolf/`
   - **Command Line:** `?discgolf.js`
3. Save, and it shows up in that door section.

On digiweb the door runs from the published folder instead (see the main README, "Automatic deploys"):

| Setting | Value |
|---|---|
| Name | Disc Golf |
| Internal Code | `DISCGOLF` |
| Start-up Directory | `/srv/apps/ic_discgolf/bbs` |
| Command Line | `?discgolf.js` |
| Native Executable/Script | No |
| BBS Drop File Type | None |
| Multiple Concurrent Users | Yes |

**Saved settings.** Players are named after their BBS alias. To save their settings between visits, the
door needs the save service (main README, "The save service") and `ctrl/discgolf.ini`, readable only by
the BBS:

```ini
[api]
url = http://127.0.0.1:3002
key = (the service's DOOR_KEY)
```

Without it (or if the service doesn't answer) the door still runs; players just start from the defaults
each visit.

## Editing the game

- **Discs:** `DISCS` in `lib/discs.js`.
- **Holes:** `COURSES` in `lib/courses.js`. Each hole has a length and par, a path from tee to basket on a
  78×16 grid, fairway width, how wooded each side is, single trees, and out-of-bounds areas (road,
  parking, water).
- **Water:** a throw in the water can lose that disc for the round, and the farther from dry ground the
  likelier that is (the `WATER_` constants in `lib/config.js`). The putter is never lost. If several holes
  on a course share the same creek or lake, give their water areas the same name, as in
  `{ t: "W", body: "creek", ... }`, and a lost disc can wash up on those later holes.
- **Elevation:** add `elev` to a hole, in feet, such as
  `elev: { tee: 0, basket: -12, hills: [[40, 6, 5, 8]] }`. Each hill is `[column, row, radius, height]`;
  use a negative height for a dip.
- **Meter and player tuning:** the constants in `lib/config.js` (`SWEEP_SEC`, `LEVELS`, `OFF_HAND`,
  `PUTT_M`, and so on).
- **House rules:** the defaults are `HOUSE_DEFAULT` in `lib/state.js`, the biggest bag is `BAG_MOST` and the
  wind ranges are `WINDS` in `lib/config.js`, and the screen is `HOUSE_FORM` in `lib/menus.js`. Rules code
  reads only the round's copy, `R.rules`. If you add a rule, also add it to `houseFrom` in
  `../api/players.js`, or the save service will refuse to save it.

After editing, refresh the web page to play your changes; **Restart** reloads the game.
