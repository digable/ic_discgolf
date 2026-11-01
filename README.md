# Disc Golf Door 

A Genesis-style disc golf game for Synchronet BBS, built around a 3-click swing
meter. The same game script runs in two places:

- **On your BBS** as a JavaScript door (`bbs/discgolf.js`).
- **In a web browser** (`index.html`): an emulated 80×25 ANSI terminal that runs
  the real door, with a simulated connection (lag, jitter, modem speeds),
  so testers can play without dialing in.

Seven courses at six real disc golf parks in Iowa and Missouri (see [Courses](#courses)).

## Players and saved settings

- **On the BBS** you play under your BBS alias, and your settings (hand, usual throw,
  level, flight path, putting view and disc bag) are saved for next time:
  - **First visit:** player setup, then **Continue** saves it ("Saved for next time").
  - **Coming back:** a welcome-back screen shows your saved settings: **Play with
    these** (Enter) or **Change settings** (player setup with your answers filled in,
    saved when you continue).
  - **Player setup** from the title screen saves the same way. Leaving the bag screen
    after changing your bag asks "Save this bag for next time? Y/n". The putting view
    is remembered when a round ends.
  - If the save service doesn't answer, you play with the defaults and a note says
    settings won't be saved today.
- **On the web** you type the name you'll play under (the same rules as a new BBS
  alias: up to 25 characters, starting with a letter, no double spaces or trailing
  space). Web settings aren't saved.
- **Shared games** (cross-play, coming later): web players' names are tagged so they
  can't pass for a BBS player: "Digable (web)", then "Digable (web01)", "Digable
  (web02)" for more web players with the same name (`webName()` in `api/_names.js`).

Saves are kept by the save service (`server.js`), in SQLite, keyed by the BBS alias
like IC Zombies' saves. See [The save service](#the-save-service).

## Courses

**Play** opens a scrolling course list: Up/Down to move, Enter (or Space) to play.

| # | Course | Holes | Par | Length | Address |
|---|---|---|---|---|---|
| 1 | Turkey Creek | 9 | 27 | 2,500 ft | Turkey Creek Day Use Area, 2850 Prairie Du Chien Rd NE, Iowa City, IA 52240 |
| 2 | Wildcat Bluff | 21 | 71 | 7,445 ft | Wildcat Bluff Recreation Area, 3139 57th Street Trail, Center Point, IA 52213 |
| 3 | Eagles Crossing (Championship Course) | 18 | 70 | 7,564 ft | Eagles Crossing, 300 Eagles Nest Farm Road, Hawk Point, MO 63349 |
| 4 | Sugar Bottom | 18 | 55 | 5,791 ft | Sugar Bottom Day Use Area, 2192 Mehaffey Bridge Rd NE, Solon, IA 52333 |
| 5 | High Bridge Top Ten | 10 | 32 | 2,635 ft | Memorial Park, 9 Park Street, Eldora, IA 50627 |
| 6 | High Bridge Heaven & Hell | 18 | 58 | 4,575 ft | Memorial Park, 9 Park Street, Eldora, IA 50627 |
| 7 | Peninsula Park | 18 | 55 | 5,507 ft | Peninsula Park, Foster Rd & Ball St, Iowa City, IA 52240 |

Every course's hole lengths and pars are the real ones, from its UDisc listing
(2026). The rest of each hole (fairway shapes and bends, woods, single trees,
water, roads, parking lots and hills) is drawn from UDisc's description and
course reviews, not surveyed, so it's the course's character rather than an exact
copy. The holes are in `bbs/lib/courses.js`; adjust a hole there to match the real
one. The town shown in the game is the one UDisc lists, which isn't always the
mailing address's town.

### 1. Turkey Creek

- **Where:** Coralville Lake (U.S. Army Corps of Engineers), east of the Coralville
  Lake Dam. Go east on Prairie Du Chien Rd NE across the dam; the Turkey Creek Day
  Use Area entrance is on the right. [Map](https://www.google.com/maps?q=41.72342,-91.52306)
- **The course:** 9 holes, free, established 1983. Short holes (150 to 300+ ft)
  with narrow and wide fairways, and the road and parking lot in play on several
  holes. Finding the next tee is part of the challenge.
- **In the game:** tight tunnels along the wood lines, with the parking lot (hole
  1, 7) and the road (holes 4, 9) out of bounds. No elevation yet.

### 2. Wildcat Bluff

- **Where:** Wildcat Bluff Recreation Area (Benton County Conservation), just
  south of Urbana. UDisc lists it under Vinton. [Map](https://www.google.com/maps?q=42.19472,-91.88794)
- **The course:** 21 holes, free, established 2007. Heavily wooded, extremely
  hilly and full of tight lines. UDisc's best-rated course in Iowa (2025).
- **In the game:** the short (red) tees, par 71. Tight wooded tunnels with big
  drops and climbs; eight par 4s.

### 3. Eagles Crossing (Championship Course)

- **Where:** Eagles Crossing, on 400 acres near Hawk Point, Missouri. UDisc lists
  it under New Truxton. [Map](https://www.google.com/maps?q=38.97686,-91.21237) ·
  [eaglescrossingdiscgolf.com](https://eaglescrossingdiscgolf.com/)
- **The course:** 18 holes, par 70, established 2021, on private land. Pay to
  play ($42 per round per player) with tee times booked online; closed in January
  and February. Open fields, very hilly woods and nine ponds and lakes, with red,
  white and blue tees on every hole. The park's second course, Wild Times (par
  64), isn't in the game.
- **In the game:** UDisc's "Masters Invitational 2026 - Red" layout. Ponds, three
  island greens (a ring of water around the basket) and a gravel road out of
  bounds. Where the water, woods and road go comes from reviews written before
  the course was renumbered in 2023, so some may now be on different holes.

### 4. Sugar Bottom

- **Where:** Sugar Bottom Day Use Area on Coralville Lake. UDisc lists it under
  North Liberty. The gates close in winter until April 1, but you can walk in:
  park at the small lot at 2335 Sugar Bottom Rd NE, about a 12-minute walk.
  [Map](https://www.google.com/maps?q=41.75941,-91.55703)
- **The course:** 18 holes, free, established 1989. Hilly, a mix of wooded and
  open holes, and very shaggy off the fairways.
- **In the game:** UDisc's main layout ("Main - Sugar Bottom - 7/30/2026"),
  with heavy rough and a 717 ft par 4 to finish.

### 5 and 6. High Bridge (Top Ten, Heaven & Hell)

- **Where:** Memorial Park, the city park on the east side of Eldora. Park on the
  east side of Park Street, just north of the Welcome Center. The "high bridge" is
  the highway along the park's south edge, almost 100 ft above the Iowa River.
  [Map](https://www.google.com/maps?q=42.36133,-93.08465)
- **The course:** 18 holes, free, established 2022, concrete tees and Veteran
  baskets. Ten holes are up on the bluff: beginner friendly, shorter and slightly
  technical. The other eight go down into the river valley and back up, over
  rougher terrain. Reviews in 2026 say the bottom eight aren't being mowed (weeds
  instead of fairway, fallen trees).
- **In the game:** both of UDisc's layouts, as two courses that share their first
  ten holes:
  - **Top Ten** (UDisc: "The Top Ten"): just the ten bluff holes, flat.
  - **Heaven & Hell** (UDisc: "Heaven and Hell. 18 hole layout."): all 18. The
    bottom eight have tight fairways, heavy rough and dense woods, dropping about
    60 ft (holes 11-15) and climbing about 50 ft back out (16-18). The river and
    the bridge aren't in play, because no source says which holes they're near.

### 7. Peninsula Park

- **Where:** Peninsula Park, an Iowa City park on a bend of the Iowa River, off
  Foster Rd at Ball St. Park in the lot (port-o-potty, no drinking water).
  [Map](https://www.google.com/maps?q=41.67257,-91.55853)
- **The course:** 18 holes, free, established 2006, concrete tees, two baskets
  per hole (A and B). Mostly flat. The front nine is mostly in the woods; the back
  nine is more open and runs along the river. Shaggy off the fairways; watch for
  poison ivy and nettles. Hole 5 and holes 11-16 are prone to flooding, so check
  conditions before you go.
- **In the game:** UDisc's "Red Tees to Orange Baskets" layout, par 55 with one
  par 4 (hole 11, 503 ft). Wooded tunnels on the front nine, wide open on the back,
  and only small slopes. The river isn't in play, because no source says which
  holes it runs beside.

## Files

| Path | What it is |
|---|---|
| `bbs/` | The game: the Synchronet door (`discgolf.js`) and its `lib/` files. The web page plays these same files. See [`bbs/README.md`](bbs/README.md). |
| `index.html` | The browser version's page: the terminal, the connection settings and the on-screen keys. |
| `styles/` | The page's CSS: `base.css` (colors, fonts), `layout.css` (page layout), `components.css` (terminal, keys, panels). |
| `scripts/` | The emulator, as ES modules (listed below). |
| `vendor/acorn.js` | JavaScript parser the web page uses to run the door script in the browser (acorn 8.12.1, MIT license). |
| `vendor/acorn-LICENSE.txt` | acorn's license. |
| `server.js` | The disc golf service: serves the game files and the BBS door's save API (Node built-ins only). See "The save service". |
| `api/` | The service's routes and database: `players.js` (the save API), `_db.js` (SQLite: players, rate limits), `_names.js` (player name rules and web-name tags), `_helpers.js` (door check, client address), `_rateLimit.js`. |
| `package.json` | `npm start` runs `server.js`. No dependencies. |
| `deploy/update-discgolf.sh` | The script digiweb runs to publish a push (see "Automatic deploys"). |
| `deploy/ic-discgolf.service`, `deploy/nginx-discgolf.conf` | The service's systemd unit and the nginx change for it, to install once (see "The save service"). |

The emulator in `scripts/`:

| File | What it does |
|---|---|
| `main.js` | Entry point: loads the door, runs the screen and readout loops. |
| `door-loader.js` | Fetches `bbs/discgolf.js` and the `lib/` files it `load()`s, and joins them into one program. |
| `terminal.js` | The caller's screen: an ANSI parser drawing CP437 cells on a canvas. |
| `wire.js` | The simulated connection: delay, jitter, line speed and Nagle's algorithm. |
| `runtime.js` | A stand-in for Synchronet's JavaScript runtime (`console`, `bbs`, `system`, `user`, ...). |
| `transform.js` | Makes the door's blocking calls (`console.getkey()`, `mswait()`) awaitable, and compiles it. |
| `session.js` | Starting, restarting and ending a session, and reporting door errors. |
| `controls.js` | Connection settings, on-screen keys, the phone keyboard and the real keyboard. |
| `dom.js` | `$()`, the page's element lookup. |

## Put it on your web server

There's no build step. Copy the game files (`index.html`, `styles/`, `scripts/`,
`bbs/` and `vendor/`) into any folder your web server serves, for example:

```sh
git clone https://github.com/YOU/ic_discgolf.git
cd ic_discgolf
cp -r index.html styles scripts bbs vendor /var/www/html/discgolf/
```

Then open `https://your-site/discgolf/`.

- Keep the folders together; the page loads its styles, scripts and the door from them.
- The page must be served over http or https. Opening `index.html` straight from disk won't load the game, because browsers block that.
- The page pulls its fonts from Google Fonts. Without internet access it falls back to system fonts and still works.
- The web game is all static files, so GitHub Pages works too: enable Pages for the repo and the game is at `https://YOU.github.io/ic_discgolf/`. Only BBS saving needs the save service.

### Try it on your own computer first

```sh
cd ic_discgolf
npm start
```

Then open http://localhost:3002 in a browser. `npm start` runs `server.js`, which
needs Node 22.13 or newer for its built-in SQLite (or the `sqlite3` module). Any
other static web server works too for the web game.

## Install the door on Synchronet

See [`bbs/README.md`](bbs/README.md#install-on-synchronet): copy `bbs/discgolf.js` and `bbs/lib/` to
your xtrn folder and add it in SCFG with the command line `?discgolf.js`.

### Automatic deploys (digiweb)

Every push to `main` runs `.github/workflows/deploy.yaml`, the same setup as IC
Zombies: it joins Tailscale and SSHes to digiweb with a key that can only run
`sudo update-discgolf.sh`. That script pulls `main` into `/srv/src/ic_discgolf`
and copies just the game and server files (`index.html`, `styles/`, `scripts/`, the
door in `bbs/`, `vendor/`, `server.js`, `api/` and `package.json`) to
`/srv/apps/ic_discgolf`, then restarts the save service. The player database isn't
in that folder (it's `/var/lib/ic-discgolf/saves.db`), so a deploy never touches it. The service serves that folder as
[discgolf.sodamachine.net](https://discgolf.sodamachine.net) behind nginx, and the BBS
door runs from its `bbs/` folder, so one push updates both.

The copy of `update-discgolf.sh` that runs is the one in `/usr/local/bin/`, not
the repo's. When `deploy/update-discgolf.sh` changes, copy it there again.

One-time setup (the full steps are in the digiweb setup guide, "Adding another game"):

1. Clone the repo to `/srv/src/ic_discgolf`, copy `deploy/update-discgolf.sh` to
   `/usr/local/bin/`, make it executable and run it once.
2. Make a new SSH key for this repo, and add its public key to `~deploy/.ssh/authorized_keys`, locked to the script:
   `restrict,command="sudo /usr/local/bin/update-discgolf.sh" ssh-ed25519 AAAA... github-actions discgolf`,
   plus `/etc/sudoers.d/deploy-discgolf` with
   `deploy ALL=(root) NOPASSWD: /usr/local/bin/update-discgolf.sh`.
3. In the GitHub repo's **Settings > Secrets and variables > Actions**, add
   `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET`, `DEPLOY_SSH_KEY` (the new private key)
   and `DEPLOY_KNOWN_HOSTS` (the same values as IC Zombies, except the key).
4. In SCFG, point the door at the published folder: Start-up Directory
   `/srv/apps/ic_discgolf/bbs` (all the settings are in
   [`bbs/README.md`](bbs/README.md#install-on-synchronet)).
5. Set up the save service (next section).

## The save service

`server.js` serves the game files (like IC Zombies' server, it never serves `data/`,
`api/`, `deploy/`, `server.js`, `package.json` or dotfiles) and runs the save API the
BBS door uses. Player settings are in SQLite at `DB_FILE`: `/var/lib/ic-discgolf/saves.db`
on digiweb (set by the systemd unit). Without `DB_FILE` it falls back to
`data/discgolf.db`, which is only for trying it locally. SQLite comes from the `sqlite3`
module if it's installed (Debian:
`sudo apt install node-sqlite3`), otherwise from Node's built-in `node:sqlite`
(Node 22.13+).

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3002` | Listen port (IC Zombies has 3000) |
| `HOST` | `127.0.0.1` | Listen address; nginx on the same machine forwards to it |
| `DB_FILE` | `data/discgolf.db` (local testing only) | SQLite database path: `/var/lib/ic-discgolf/saves.db` on digiweb |
| `DOOR_KEY` | none | The secret the BBS door sends with every save request. Without it, nothing can be saved. |

**Who can save.** Only the BBS door: `/api/players` requests need the door key
(`X-Door-Key`) and must come straight from the same machine, not through nginx.
Anything else gets the same 404 as a route that doesn't exist, and failed attempts
are rate limited. Web players can't read or change a BBS player's settings, now or
once cross-play adds public game routes.

**One-time setup on digiweb** (after the steps in "Automatic deploys"):

1. Node and SQLite: `sudo apt install nodejs node-sqlite3`.
2. A user for the service:
   `sudo useradd --system --no-create-home --shell /usr/sbin/nologin discgolf`.
   Its database folder, `/var/lib/ic-discgolf`, is created by systemd when the
   service starts (`StateDirectory`, owned by `discgolf`, mode 700).
3. The door key, in two places only root and the BBS can read:
   ```sh
   KEY=$(openssl rand -hex 32)
   echo "DOOR_KEY=$KEY" | sudo tee /etc/ic-discgolf.env >/dev/null && sudo chmod 600 /etc/ic-discgolf.env
   printf '[api]\nurl = http://127.0.0.1:3002\nkey = %s\n' "$KEY" | sudo tee /sbbs/ctrl/discgolf.ini >/dev/null
   sudo chown sbbs /sbbs/ctrl/discgolf.ini && sudo chmod 600 /sbbs/ctrl/discgolf.ini
   ```
   (Use your Synchronet `ctrl` folder and BBS user if they differ.)
4. The service: `sudo cp /srv/src/ic_discgolf/deploy/ic-discgolf.service /etc/systemd/system/`,
   then `sudo systemctl daemon-reload && sudo systemctl enable --now ic-discgolf`.
   Check it with `curl -s http://127.0.0.1:3002/ | head -3`; the log
   (`journalctl -u ic-discgolf`) should say it's using `/var/lib/ic-discgolf/saves.db`.
5. nginx: in the discgolf.sodamachine.net site, replace the `root`/`try_files` lines
   with the `location` block in `deploy/nginx-discgolf.conf` (it must set
   `X-Forwarded-For`), then `sudo nginx -t && sudo systemctl reload nginx`.
6. Copy the new `deploy/update-discgolf.sh` to `/usr/local/bin/` (it publishes the
   server files and restarts the service).
7. Backups: the Atom's weekly `/usr/local/bin/digiweb-backup.sh` (not in any repo)
   backs it up the same way as Studio Boss's database. Add this right after its
   "Same for IC Studio Boss" block:
   ```sh
   # Same for IC Disc Golf (player saves)
   rm -f /root/ic-discgolf-saves.db
   if [ -f /var/lib/ic-discgolf/saves.db ] && command -v sqlite3 >/dev/null; then
       sqlite3 /var/lib/ic-discgolf/saves.db ".backup /root/ic-discgolf-saves.db"
   fi
   ```
   and these lines to its `tar` list:
   ```sh
   /root/ic-discgolf-saves.db \
   /etc/systemd/system/ic-discgolf.service \
   /etc/ic-discgolf.env \
   ```
   `.backup` makes a safe copy while the service is running (a plain `cp` could catch
   the database mid-write). `/sbbs/ctrl/discgolf.ini` is already covered: the backup
   includes all of `/sbbs/ctrl`.

## Editing the game

The discs, courses and tuning constants are in `bbs/lib/`; see
[`bbs/README.md`](bbs/README.md#editing-the-game) for which file holds what.

After editing, refresh the web page to play your changes, and **Restart**
reloads the game. The web page only runs its own copy of the door; to try changes
without touching the server, run the page on your own computer (see "Try it on
your own computer first").

## Known limits

- Course holes are drawn from descriptions, not surveyed (see [Courses](#courses)).
  Turkey Creek has no elevation yet, and the river isn't in play at High Bridge
  (nor the bridge) or Peninsula Park.
- Settings are saved for BBS players only; web players start fresh each visit.
- The scorecard shows the first 8 characters of a player's name.
- No multiplayer, cross-play or tournaments yet.

## Credits

- Disc flight numbers: published by Innova, Discraft, Dynamic Discs and Axiom.
- Hole lengths, pars and course details: UDisc -
  [Turkey Creek](https://udisc.com/courses/turkey-creek-tNSo),
  [Wildcat Bluff](https://udisc.com/courses/wildcat-bluff-I1rO),
  [Eagles Crossing](https://udisc.com/courses/championship-course-at-eagles-crossing-JQQP),
  [Sugar Bottom](https://udisc.com/courses/sugar-bottom-rec-areas-EwqR),
  [High Bridge](https://udisc.com/courses/high-bridge-dgc-fhad),
  [Peninsula Park](https://udisc.com/courses/peninsula-park-jLph).
- Eagles Crossing water and woods: [DG Course Review](https://dgcoursereview.com/courses/eagles-crossing.12414/reviews).
- High Bridge park, parking and the bluff/valley split: [DG Course Review](https://www.dgcoursereview.com/courses/high-bridge-dgc.13426).
- Addresses: Recreation.gov ([Turkey Creek](https://www.recreation.gov/camping/campgrounds/254086),
  [Sugar Bottom](https://www.recreation.gov/camping/campgrounds/254085)),
  [Benton County Conservation](https://mycountyparks.com/County/Benton/Park/Wildcat-Bluff-Recreation-Area.aspx),
  [Eagles Crossing](https://eaglescrossingdiscgolf.com/),
  [PDGA](https://www.pdga.com/node/24943) (Sugar Bottom's winter parking),
  [DG Course Review](https://www.dgcoursereview.com/courses/high-bridge-dgc.13426) (High Bridge),
  [PDGA](https://www.pdga.com/node/26368) (Peninsula Park, and its flood-prone holes).
- Relief rule: PDGA optional relief (one penalty throw, move back along the line of play).
- [acorn](https://github.com/acornjs/acorn) JavaScript parser, MIT license.
