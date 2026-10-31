// discgolf.js: Tuning: the swing meter, the 80x25 screen layout and the player model.
// Loaded by ../discgolf.js. ES5 for Synchronet (no let/const/arrows).

"use strict";

// ---- Meter (same as golfmeter.js, adaptive off) --------------------------
var BAR_X = 4;           // screen column of the bar's left edge (1-based)
var BAR_Y = 22;          // screen row of the bar
var BAR_W = 53;          // bar width in columns (0-100% plus overswing)
var SNAP = 6;            // first column of the yellow release zone
var SNAP_W = 2;          // yellow zone width (double the 100% mark)
var P100 = 46;           // column of 100% power
var SNAP_MID = SNAP + (SNAP_W - 1) / 2;
var SNAP_TOL = SNAP_W / 2;
var SWEEP_SEC = 1.1;     // seconds for the marker to cross the bar one way
var FRAME_MS = 50;       // marker updates ~20 times a second
var MAX_LAG_COMP = 0.25; // never compensate more than 250 ms of lag

// ---- Screen layout (80x25) ------------------------------------------------
var SCR_W = 80;          // screen width
var MAP_X = 2, MAP_Y = 2, MAP_W = 78, MAP_H = 16;  // hole map: rows 2-17
var MSG_Y = 18;          // shot results
var HELP_Y = 19;         // key help
var PANEL_X = 60, PANEL_Y = 20;  // disc / throw / wind panel, rows 20-25
var STATUS_Y = BAR_Y + 3;
var HOT_ATTR = 11 | 0x80;  // hotkey letters: yellow, underlined (terminals without underlines just show yellow)

// ---- Player model ---------------------------------------------------------
// Skill levels: backhand / forehand arm speed (an arm of 10 fully powers a speed-10 disc)
// and a distance scale. Regular is a typical recreational player: about 160 ft with a
// putter, 235 with a midrange, 270 with a fairway driver and 300-330 with a distance driver,
// which they can't get up to speed (so it barely turns and fades early). Pro is a strong arm.
var LEVELS = {
	reg: { name: "Regular", bh: 6,  fh: 5.5, dist: 0.88 },
	pro: { name: "Pro",     bh: 10, fh: 9,   dist: 1 }
};
var OFF_HAND = 0.7;      // non-dominant hand: 70% of the arm speed...
var OFF_ACC = 1.6;       // ...and 60% bigger release errors
var OVER_ACC = 1.5;      // an overswing makes release errors 50% bigger
var HAMMER_RANGE = 0.65; // a hammer flies 65% as far as a flat backhand
var PITCH_POWER = 0.4;   // a pitch-out tops out at 40% power
var PUTT_M = 20;         // inside 20 m (66 ft) you putt (circle 2)
var C1_M = 10;           // circle 1: 10 m (33 ft)
var BAG_MAX = 8;
var FT = 3.28084;        // feet per meter
var MPH_TO_MS = 0.447;   // meters per second per mph
