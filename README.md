# Disc Golf Door 

A Genesis-style disc golf game for Synchronet BBS, built around a 3-click swing
meter. The same game script runs in two places:

- **On your BBS** as a JavaScript door (`discgolf.js`).
- **In a web browser** (`index.html`): an emulated 80×25 ANSI terminal that runs
  the real `discgolf.js`, with a simulated connection (lag, jitter, modem speeds),
  so testers can play without dialing in.

The first course is Turkey Creek (Coralville Reservoir, Iowa City, IA).

## Files

| File | What it is |
|---|---|
| `discgolf.js` | The game. This is the door you install on Synchronet, and the web page plays this same file. |
| `index.html` | The browser version: terminal emulator, connection simulator and on-screen keys. |
| `vendor/acorn.js` | JavaScript parser the web page uses to run the door script in the browser (acorn 8.12.1, MIT license). |
| `vendor/acorn-LICENSE.txt` | acorn's license. |

## Put it on your web server

There's no build step. Copy the folder's contents (`index.html`, `discgolf.js`
and `vendor/`) into any folder your web server serves, for example:

```sh
git clone https://github.com/YOU/ic_discgolf.git
cp -r ic_discgolf/index.html ic_discgolf/discgolf.js ic_discgolf/vendor /var/www/html/discgolf/
```

Then open `https://your-site/discgolf/`.

- `index.html` and `discgolf.js` must stay in the same folder; the page loads the game from there.
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

1. Copy `discgolf.js` to a folder under your Synchronet install, for example `xtrn/discgolf/`.
2. In SCFG, go to **External Programs > Online Programs (Doors)**, pick a section, and add a program:
   - **Name:** Disc Golf
   - **Start-up Directory:** `../xtrn/discgolf/`
   - **Command Line:** `?discgolf.js`
3. Save, and it shows up in that door section.

The script is written for Synchronet's JavaScript engine (ES5: no `let`, `const`
or arrow functions), so keep to that style when you edit it.

### Automatic deploys (digiweb)

Every push to `main` runs `.github/workflows/deploy.yaml`, the same setup as IC
Zombies: it joins Tailscale and SSHes to digiweb with a key that can only run
`sudo update-discgolf.sh`. That script pulls `main` into `/srv/src/ic_discgolf`
and copies just the game files (`index.html`, `discgolf.js`, `vendor/`) to
`/srv/apps/ic_discgolf`. nginx serves that folder as
[discgolf.sodamachine.net](https://discgolf.sodamachine.net), and the BBS door runs
from it, so one push updates both.

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
4. In SCFG, point the door at the published folder instead of `xtrn/discgolf/`:

| Setting | Value |
|---|---|
| Name | Disc Golf |
| Internal Code | `DISCGOLF` |
| Start-up Directory | `/srv/apps/ic_discgolf` |
| Command Line | `?discgolf.js` |
| Native Executable/Script | No |
| BBS Drop File Type | None |
| Multiple Concurrent Users | Yes |

## Editing the game

Everything is near the top of `discgolf.js`:

- **`DISCS`**: the disc catalog, with each maker's published speed, glide, turn and fade.
- **`COURSES`**: the holes. Each hole has a length and par, a path from tee to
  basket on a 78×16 grid, fairway width, how wooded each side is, single trees,
  and out-of-bounds areas (road, parking, water). The comment above `COURSES`
  explains each field.
- **Elevation**: add `elev` to a hole, in feet, such as
  `elev: { tee: 0, basket: -12, hills: [[40, 6, 5, 8]] }`. Each hill is
  `[column, row, radius, height]`; use a negative height for a dip.
- **Meter and player tuning**: the constants at the top (`SWEEP_SEC`,
  `ARM_BH`, `OFF_HAND`, `PUTT_M`, and so on).

After editing, refresh the web page to play your changes, and **Restart**
reloads the game. The web page only runs its own `discgolf.js`; to try changes
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
