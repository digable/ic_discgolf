// discgolf.js: The disc catalog and what the toggle keys cycle through.
// Loaded by ../discgolf.js. ES5 for Synchronet (no let/const/arrows).

"use strict";

// ---- Discs: speed / glide / turn / fade as published by the makers -------
// Types: P putter, A approach, M midrange, F fairway driver, D distance driver
var DISCS = [
	{ name: "KC Aviar",    maker: "Innova",        type: "P", n: [2, 3, 0, 2] },
	{ name: "Judge",       maker: "Dynamic Discs", type: "P", n: [2, 4, 0, 1] },
	{ name: "Luna",        maker: "Discraft",      type: "P", n: [3, 4, 0, 2] },
	{ name: "Envy",        maker: "Axiom",         type: "P", n: [3, 3, 0, 2] },
	{ name: "Zone",        maker: "Discraft",      type: "A", n: [4, 3, 0, 3] },
	{ name: "Pig",         maker: "Innova",        type: "A", n: [4, 1, 0, 3] },
	{ name: "Buzzz",       maker: "Discraft",      type: "M", n: [5, 4, -1, 1] },
	{ name: "Mako3",       maker: "Innova",        type: "M", n: [5, 5, 0, 0] },
	{ name: "Roc3",        maker: "Innova",        type: "M", n: [5, 4, 0, 3] },
	{ name: "Truth",       maker: "Dynamic Discs", type: "M", n: [5, 5, 0, 2] },
	{ name: "Teebird",     maker: "Innova",        type: "F", n: [7, 5, 0, 2] },
	{ name: "Leopard3",    maker: "Innova",        type: "F", n: [7, 5, -2, 1] },
	{ name: "Hawkeye",     maker: "Innova",        type: "F", n: [7, 5, -1, 1] },
	{ name: "TL3",         maker: "Innova",        type: "F", n: [8, 4, -1, 1] },
	{ name: "Passion",     maker: "Discraft",      type: "F", n: [8, 5, -1, 1] },
	{ name: "Thunderbird", maker: "Innova",        type: "F", n: [9, 5, 0, 2] },
	{ name: "Firebird",    maker: "Innova",        type: "F", n: [9, 3, 0, 4] },
	{ name: "Roadrunner",  maker: "Innova",        type: "F", n: [9, 5, -4, 1] },
	{ name: "Valkyrie",    maker: "Innova",        type: "D", n: [9, 4, -2, 2] },
	{ name: "Wraith",      maker: "Innova",        type: "D", n: [11, 5, -1, 3] },
	{ name: "Destroyer",   maker: "Innova",        type: "D", n: [12, 5, -1, 3] },
	{ name: "Hades",       maker: "Discraft",      type: "D", n: [12, 6, -3, 2] },
	{ name: "Daedalus",    maker: "Innova",        type: "D", n: [13, 6, -3, 2] },
	{ name: "Shryke",      maker: "Innova",        type: "D", n: [13, 6, -2, 2] }
];
var TYPE_NAME = { P: "Putter", A: "Approach", M: "Midrange", F: "Fairway", D: "Distance" };
var DISC_BY_NAME = {};
for (var di = 0; di < DISCS.length; di++) DISC_BY_NAME[DISCS[di].name] = DISCS[di];

// What the toggle keys cycle through
var HANDS = ["R", "L"], STYLES = ["BH", "FH", "HM"], ANGLES = ["F", "H", "A"], PUTT_VIEWS = ["side", "top", "pov"];
