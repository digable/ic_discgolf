// discgolf.js: The disc catalog and what the toggle keys cycle through.
// Loaded by ../discgolf.js. ES5 for Synchronet (no let/const/arrows).

"use strict";

// ---- Discs: speed / glide / turn / fade as published by the makers -------
// Types: P putter, A approach, M midrange, F fairway driver, D distance driver
var DISCS = [
	{ name: "KC Aviar",    maker: "Innova",        type: "P", n: [2, 3, 0, 2] },
	{ name: "Aviar",       maker: "Innova",        type: "P", n: [2, 3, 0, 1] },
	{ name: "Polecat",     maker: "Innova",        type: "P", n: [1, 3, 0, 0] },
	{ name: "Judge",       maker: "Dynamic Discs", type: "P", n: [2, 4, 0, 1] },
	{ name: "Luna",        maker: "Discraft",      type: "P", n: [3, 4, 0, 2] },
	{ name: "Envy",        maker: "Axiom",         type: "P", n: [3, 3, 0, 2] },
	{ name: "Zone",        maker: "Discraft",      type: "A", n: [4, 3, 0, 3] },
	{ name: "Pig",         maker: "Innova",        type: "A", n: [4, 1, 0, 3] },
	{ name: "Roc",         maker: "Innova",        type: "M", n: [4, 4, 0, 3] },
	{ name: "Shark",       maker: "Innova",        type: "M", n: [4, 4, 0, 2] },
	{ name: "Buzzz",       maker: "Discraft",      type: "M", n: [5, 4, -1, 1] },
	{ name: "Mako3",       maker: "Innova",        type: "M", n: [5, 5, 0, 0] },
	{ name: "Roc3",        maker: "Innova",        type: "M", n: [5, 4, 0, 3] },
	{ name: "Gator",       maker: "Innova",        type: "M", n: [5, 2, 0, 4] },
	{ name: "Truth",       maker: "Dynamic Discs", type: "M", n: [5, 5, 0, 2] },
	{ name: "Leopard",     maker: "Innova",        type: "F", n: [6, 5, -2, 1] },
	{ name: "Teebird",     maker: "Innova",        type: "F", n: [7, 5, 0, 2] },
	{ name: "Eagle",       maker: "Innova",        type: "F", n: [7, 4, -1, 3] },
	{ name: "IT",          maker: "Innova",        type: "F", n: [7, 6, -2, 1] },
	{ name: "Teebird3",    maker: "Innova",        type: "F", n: [8, 4, 0, 2] },
	{ name: "Leopard3",    maker: "Innova",        type: "F", n: [7, 5, -2, 1] },
	{ name: "Hawkeye",     maker: "Innova",        type: "F", n: [7, 5, -1, 1] },
	{ name: "TL3",         maker: "Innova",        type: "F", n: [8, 4, -1, 1] },
	{ name: "Passion",     maker: "Discraft",      type: "F", n: [8, 5, -1, 1] },
	{ name: "Thunderbird", maker: "Innova",        type: "F", n: [9, 5, 0, 2] },
	{ name: "Firebird",    maker: "Innova",        type: "F", n: [9, 3, 0, 4] },
	{ name: "Roadrunner",  maker: "Innova",        type: "F", n: [9, 5, -4, 1] },
	{ name: "Sidewinder",  maker: "Innova",        type: "F", n: [9, 5, -3, 1] },
	{ name: "Valkyrie",    maker: "Innova",        type: "D", n: [9, 4, -2, 2] },
	{ name: "Beast",       maker: "Innova",        type: "D", n: [10, 5, -2, 2] },
	{ name: "Orc",         maker: "Innova",        type: "D", n: [10, 4, -1, 3] },
	{ name: "Mamba",       maker: "Innova",        type: "D", n: [11, 6, -5, 1] },
	{ name: "Wraith",      maker: "Innova",        type: "D", n: [11, 5, -1, 3] },
	{ name: "Destroyer",   maker: "Innova",        type: "D", n: [12, 5, -1, 3] },
	{ name: "Tern",        maker: "Innova",        type: "D", n: [12, 6, -3, 2] },
	{ name: "Hades",       maker: "Discraft",      type: "D", n: [12, 6, -3, 2] },
	{ name: "Boss",        maker: "Innova",        type: "D", n: [13, 5, -1, 3] },
	{ name: "Charger",     maker: "Innova",        type: "D", n: [13, 5, -1, 2] },
	{ name: "Apex",        maker: "Innova",        type: "D", n: [13, 5, 0, 4] },
	{ name: "Daedalus",    maker: "Innova",        type: "D", n: [13, 6, -3, 2] },
	{ name: "Shryke",      maker: "Innova",        type: "D", n: [13, 6, -2, 2] },
	{ name: "Firestorm",   maker: "Innova",        type: "D", n: [14, 4, -1, 3] }
];
var TYPE_NAME = { P: "Putter", A: "Approach", M: "Midrange", F: "Fairway", D: "Distance" };
var DISC_BY_NAME = {};
for (var di = 0; di < DISCS.length; di++) DISC_BY_NAME[DISCS[di].name] = DISCS[di];

// ---- Weights -------------------------------------------------------------
// Each disc in the bag comes in one of three weights. Max (175 g) is how every disc flew before
// weights existed. A bag entry is the disc's name ("Destroyer", max weight) or name:grams
// ("Destroyer:150"), so the same mold can be in the bag at two or three weights.
var WEIGHTS = [150, 165, 175];
var WEIGHT_NAME = { 150: "Light", 165: "Mid", 175: "Max" };
var MAX_G = 175;

function bagKey(name, g) { return g === MAX_G ? name : name + ":" + g; }
// { name, g } from a bag entry; g is null when the weight isn't one of WEIGHTS
function parseBagKey(k) {
	var i = String(k).lastIndexOf(":");
	if (i < 0) return { name: k, g: MAX_G };
	var g = Number(k.slice(i + 1));
	return { name: k.slice(0, i), g: WEIGHTS.indexOf(g) >= 0 ? g : null };
}
// How far below max weight, as a fraction: 0 at 175 g, -0.4 at 165, -1 at 150. Everything
// weight changes is scaled by this (see flight.js).
function wtOf(d) { return ((d.g || MAX_G) - MAX_G) / (MAX_G - WEIGHTS[0]); }
function discLabel(d) { return d.name + " " + (d.g || MAX_G) + "g"; }

// What the toggle keys cycle through
var HANDS = ["R", "L"], STYLES = ["BH", "FH", "TH"], ANGLES = ["F", "H", "A"], PUTT_VIEWS = ["top", "pov"];
