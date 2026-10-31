# Disc Golf Door 

A Genesis-style disc golf game for Synchronet BBS, built around a 3-click swing
meter. The same game script runs in two places:

- **On your BBS** as a JavaScript door (`bbs/discgolf.js`).
- **In a web browser** (`index.html`): an emulated 80×25 ANSI terminal that runs
  the real door, with a simulated connection (lag, jitter, modem speeds),
  so testers can play without dialing in.

The first course is Turkey Creek (Coralville Reservoir, Iowa City, IA).

## Files

| Path | What it is |
|---|---|
| `bbs/` | The game: the Synchronet door (`discgolf.js`) and its `lib/` files. The web page plays these same files. See [`bbs/README.md`](bbs/README.md). |
| `index.html` | The browser version's page: the terminal, the connection settings and the on-screen keys. |
| `styles/` | The page's CSS: `base.css` (colors, fonts), `layout.css` (page layout), `components.css` (terminal, keys, panels). |
| `scripts/` | The emulator, as ES modules (listed below). |
| `vendor/acorn.js` | JavaScript parser the web page uses to run the door script in the browser (acorn 8.12.1, MIT license). |
| `vendor/acorn-LICENSE.txt` | acorn's license. |
| `deploy/update-discgolf.sh` | The script digiweb runs to publish a push (see "Automatic deploys"). |

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
- It's all static files, so GitHub Pages works too: enable Pages for the repo and the game is at `https://YOU.github.io/ic_discgolf/`.

### Try it on your own computer first

```sh
cd ic_discgolf
python3 -m http.server 8000
```

Then open http://localhost:8000 in a browser.

## Install the door on Synchronet

See [`bbs/README.md`](bbs/README.md#install-on-synchronet): copy `bbs/discgolf.js` and `bbs/lib/` to
your xtrn folder and add it in SCFG with the command line `?discgolf.js`.

### Automatic deploys (digiweb)

Every push to `main` runs `.github/workflows/deploy.yaml`, the same setup as IC
Zombies: it joins Tailscale and SSHes to digiweb with a key that can only run
`sudo update-discgolf.sh`. That script pulls `main` into `/srv/src/ic_discgolf`
and copies just the game files (`index.html`, `styles/`, `scripts/`, the door in
`bbs/`, and `vendor/`) to `/srv/apps/ic_discgolf`. nginx serves that folder as
[discgolf.sodamachine.net](https://discgolf.sodamachine.net), and the BBS door runs
from its `bbs/` folder, so one push updates both.

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

## Editing the game

The discs, courses and tuning constants are in `bbs/lib/`; see
[`bbs/README.md`](bbs/README.md#editing-the-game) for which file holds what.

After editing, refresh the web page to play your changes, and **Restart**
reloads the game. The web page only runs its own copy of the door; to try changes
without touching the server, run the page on your own computer (see "Try it on
your own computer first").

## Known limits

- Turkey Creek's hole lengths and pars come from its UDisc listing (2026). The
  fairway shapes are drawn from course descriptions, not surveyed, and no
  elevation is set yet.
- Player setup and bag aren't saved between visits yet.
- No multiplayer or tournaments yet.

## Credits

- Disc flight numbers: published by Innova, Discraft, Dynamic Discs and Axiom.
- Turkey Creek hole lengths and pars: [UDisc](https://udisc.com/courses/turkey-creek-tNSo).
- Relief rule: PDGA optional relief (one penalty throw, move back along the line of play).
- [acorn](https://github.com/acornjs/acorn) JavaScript parser, MIT license.
