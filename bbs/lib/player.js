// discgolf.js: The player: hands, throws and the bag.
// Loaded by ../discgolf.js. ES5 for Synchronet (no let/const/arrows).

"use strict";

// ---- Player ---------------------------------------------------------------
var player = {
	hand: "R",           // dominant hand
	style: "BH",         // usual throw
	level: "reg",        // skill level: "reg" or "pro" (see LEVELS)
	puttView: "side",    // side, top or pov
	bag: ["KC Aviar", "Zone", "Buzzz", "Teebird", "Leopard3", "Destroyer"]
};

function discByName(n) { return DISC_BY_NAME.hasOwnProperty(n) ? DISC_BY_NAME[n] : null; }

// The bag as disc objects, slowest first. Sorted once and kept until the bag
// changes (call bagChanged() after editing player.bag).
var bagCache = null;

function bagDiscs() {
	if (!bagCache) {
		player.bag.sort(function (a, c) { return discByName(a).n[0] - discByName(c).n[0]; });
		bagCache = [];
		for (var i = 0; i < player.bag.length; i++) { var d = discByName(player.bag[i]); if (d) bagCache.push(d); }
	}
	return bagCache;
}

function bagChanged() { bagCache = null; }

function puttDisc() { return bagDiscs()[0]; }
function domHand() { return S.hand === player.hand; }   // throwing with the dominant hand
function level() { return LEVELS[player.level] || LEVELS.reg; }
function armSpeed(style, dom) { var L = level(); return (style === "FH" ? L.fh : L.bh) * (dom ? 1 : OFF_HAND); }

function handName(h) { return h === "R" ? "Right" : "Left"; }
function styleName(s) { return s === "BH" ? "Backhand" : (s === "FH" ? "Forehand" : "Hammer"); }
function angleName(a) { return a === "H" ? "Hyzer" : (a === "A" ? "Anhyzer" : "Flat"); }
