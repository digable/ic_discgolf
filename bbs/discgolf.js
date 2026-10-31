// discgolf.js - Disc golf door for Synchronet BBS
//
// A Genesis-style disc golf game built on the 3-click swing meter from
// golfmeter.js. Pick a disc, a hand, a throw (backhand, forehand or hammer)
// and a release angle, aim with the arrow keys, then:
//   SPACE 1: start the reach-back      SPACE 2: set power
//   SPACE 3: release as the marker comes back through the yellow zone
//
// Install: copy this file and lib/ to your xtrn folder, add it in
// SCFG > External Programs with the command line:  ?discgolf.js
//
// Written for Synchronet's JavaScript engine (ES5: no let/const/arrows).

"use strict";
require("sbbsdefs.js", "K_NONE");

// The game, in the order it was written. Each file only defines things; the main loop below runs it.
load(js.exec_dir + "lib/config.js");
load(js.exec_dir + "lib/discs.js");
load(js.exec_dir + "lib/courses.js");
load(js.exec_dir + "lib/screen.js");
load(js.exec_dir + "lib/meter.js");
load(js.exec_dir + "lib/player.js");
load(js.exec_dir + "lib/saves.js");
load(js.exec_dir + "lib/holes.js");
load(js.exec_dir + "lib/state.js");
load(js.exec_dir + "lib/hud.js");
load(js.exec_dir + "lib/map.js");
load(js.exec_dir + "lib/pov.js");
load(js.exec_dir + "lib/flight.js");
load(js.exec_dir + "lib/putt.js");
load(js.exec_dir + "lib/round.js");
load(js.exec_dir + "lib/menus.js");

// ---- Main ----------------------------------------------------------------------
console.write("\x1b[?25l");
try {
	signIn();
	for (;;) {
		if (!bbs.online || js.terminated) break;
		var choice = titleScreen();
		if (choice === "P") {
			var ci = courseMenu();
			if (ci >= 0) { player.course = ci; playRound(COURSES[ci]); savePuttView(); }
		}
		else if (choice === "S") { setup(false); saveSetup(); }
		else if (choice === "B") { var before = player.bag.join("|"); bagScreen(); offerBagSave(before); }
		else if (choice === "H") howTo();
		else if (choice === "Q") break;
	}
} finally {
	console.write("\x1b[0m\x1b[?25h\x1b[2J\x1b[H");
}
