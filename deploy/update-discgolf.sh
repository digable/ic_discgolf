#!/bin/sh
# Runs on digiweb when the GitHub deploy workflow connects.
# Install it once, outside the repo (for example /usr/local/bin/update-discgolf.sh),
# and force the deploy key to run only this script in ~deploy/.ssh/authorized_keys:
#
#   command="/usr/local/bin/update-discgolf.sh",restrict ssh-ed25519 AAAA... discgolf-deploy
#
# It keeps /srv/apps/ic_discgolf matching the main branch on GitHub.
# Synchronet runs the door straight from that folder (Start-up Directory in SCFG).
set -eu

REPO_URL="https://github.com/digable/ic_discgolf.git"
APP_DIR="/srv/apps/ic_discgolf"

if [ -d "$APP_DIR/.git" ]; then
	git -C "$APP_DIR" fetch --quiet origin main
	# This folder is deploy-only, so local changes are thrown away.
	git -C "$APP_DIR" reset --quiet --hard origin/main
else
	git clone --quiet --branch main "$REPO_URL" "$APP_DIR"
fi

# Synchronet (user sbbs) only needs to read the files.
chmod -R a+rX "$APP_DIR"

echo "ic_discgolf deployed at $(git -C "$APP_DIR" rev-parse --short HEAD)"
