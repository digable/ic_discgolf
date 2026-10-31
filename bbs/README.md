# Disc Golf: the BBS door

The game itself: a JavaScript door for Synchronet BBS. The web page (`../index.html`) plays these same
files in its emulated terminal, so there's only one copy of the game.

The door is written for Synchronet's JavaScript engine (ES5: no `let`, `const` or arrow functions), so
keep to that style when you edit it.

| File | What it does |
|---|---|
| `discgolf.js` | The door you install. Loads everything in `lib/`, in order, then runs the main menu. |
| `lib/config.js` | Tuning: the swing meter, the 80×25 screen layout and the player model (arm speed, off hand, putting range). |
| `lib/discs.js` | The disc catalog, with each maker's published speed, glide, turn and fade. |
| `lib/courses.js` | The courses and their holes. The comment at the top explains each field; each course's details are in the main README, "Courses". |
| `lib/screen.js` | Basics, raw ANSI output (tracks cursor and color) and key input. |
| `lib/meter.js` | Lag measurement and the 3-click swing meter. |
| `lib/player.js` | The player: hands, throws and the bag. |
| `lib/holes.js` | Building a hole from the course data: trees, lies and elevation. |
| `lib/state.js` | Round and shot state, wind and disc range. |
| `lib/hud.js` | Header, messages, key help and the disc/throw/wind panel. |
| `lib/map.js` | The overhead hole map, with the range mark and the flight path to it. |
| `lib/pov.js` | The view from the player's lie, and the shot screen. |
| `lib/flight.js` | Disc flight, throwing a shot and PDGA optional relief. |
| `lib/putt.js` | Putting: side, overhead and from-the-player views. |
| `lib/round.js` | Playing a hole, the scorecard and a full round. |
| `lib/menus.js` | Title screen, player setup, bag and how to play. |

## How the files fit together

`discgolf.js` pulls in each file with `load(js.exec_dir + "lib/name.js")`. On Synchronet that runs the
file in the door's global scope, so everything it defines is visible to the others. The library files
only define things (constants, data and functions); nothing runs until the main loop at the bottom of
`discgolf.js`. Order still matters for constants that use earlier ones (`PV_SCALE` in `putt.js` uses
`PUTT_M` from `config.js`), so add new files to the list in a sensible place.

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

## Editing the game

- **Discs:** `DISCS` in `lib/discs.js`.
- **Holes:** `COURSES` in `lib/courses.js`. Each hole has a length and par, a path from tee to basket on a
  78×16 grid, fairway width, how wooded each side is, single trees, and out-of-bounds areas (road,
  parking, water).
- **Elevation:** add `elev` to a hole, in feet, such as
  `elev: { tee: 0, basket: -12, hills: [[40, 6, 5, 8]] }`. Each hill is `[column, row, radius, height]`;
  use a negative height for a dip.
- **Meter and player tuning:** the constants in `lib/config.js` (`SWEEP_SEC`, `LEVELS`, `OFF_HAND`,
  `PUTT_M`, and so on).

After editing, refresh the web page to play your changes; **Restart** reloads the game.
