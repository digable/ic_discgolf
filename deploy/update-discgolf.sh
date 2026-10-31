#!/bin/bash
# Pull the latest Disc Golf from GitHub and publish just the game files.
# Runs on digiweb, as root, when the GitHub deploy workflow connects (or by hand: sudo update-discgolf.sh).
#
# Install it once, outside the repo, as /usr/local/bin/update-discgolf.sh. The deploy key in
# ~deploy/.ssh/authorized_keys is forced to run only this script:
#
#   restrict,command="sudo /usr/local/bin/update-discgolf.sh" ssh-ed25519 AAAA... github-actions discgolf
#
# and /etc/sudoers.d/deploy-discgolf lets the deploy user run it:
#
#   deploy ALL=(root) NOPASSWD: /usr/local/bin/update-discgolf.sh
#
# The published folder is used twice: the ic-discgolf service (server.js, behind nginx) serves it as
# discgolf.sodamachine.net, and Synchronet runs the door from its bbs/ folder (Start-up Directory in
# SCFG). Only the game and server files go there, never .git or the docs. The player database lives
# in /var/lib/ic-discgolf (the service's StateDirectory), not here, so a deploy never touches it.
set -euo pipefail

SRC=/srv/src/ic_discgolf
DEST=/srv/apps/ic_discgolf

git -C "$SRC" fetch --quiet --depth 1 origin HEAD
git -C "$SRC" reset --quiet --hard FETCH_HEAD

mkdir -p "$DEST"
rsync -a --delete --delete-excluded \
    --exclude='/data/' \
    --include='/index.html' \
    --include='/styles/***' \
    --include='/scripts/***' \
    --include='/bbs/' \
    --include='/bbs/discgolf.js' \
    --include='/bbs/lib/***' \
    --include='/vendor/***' \
    --include='/server.js' \
    --include='/package.json' \
    --include='/api/***' \
    --exclude='*' \
    "$SRC/" "$DEST/"

# The service (discgolf) and Synchronet (sbbs) only need to read the files.
chmod -R a+rX "$DEST"

# Pick up new server code, once the service is set up (see README, "The save service")
if systemctl cat ic-discgolf.service >/dev/null 2>&1; then systemctl restart ic-discgolf.service; fi

echo "Published $(git -C "$SRC" log -1 --format='%h %s (%cd)' --date=short)"
