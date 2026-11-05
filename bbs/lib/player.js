// discgolf.js: The player: hands, throws and the bag.
// Loaded by ../discgolf.js. ES5 for Synchronet (no let/const/arrows).

"use strict";

// ---- Player ---------------------------------------------------------------
var player = {
	name: "",            // the BBS alias, or the name a web player typed (see signIn)
	handle: "",          // slugOf(name) for BBS players, the key for their saved settings; "" on the web
	canSave: false,      // a BBS player and the save service answered
	hand: "R",           // dominant hand
	style: "BH",         // usual throw
	level: "reg",        // skill level: "reg" or "pro" (see LEVELS)
	puttView: "top",     // top (overhead) or pov (from the player)
	flightPath: true,    // dots on the map from the lie to the range mark
	course: -1,          // the last course played, an index into COURSES (starts highlighted in the course menu)
	bag: ["KC Aviar", "Zone", "Buzzz", "Teebird", "Leopard3", "Destroyer"]
};

function discByName(n) { return DISC_BY_NAME.hasOwnProperty(n) ? DISC_BY_NAME[n] : null; }

// A bag entry ("Leopard3:150") as a disc of that weight: the catalog disc's numbers plus g and key
function bagDisc(k) {
	var p = parseBagKey(k), d = discByName(p.name);
	if (!d || !p.g) return null;
	return { name: d.name, maker: d.maker, type: d.type, n: d.n, g: p.g, key: k };
}

// The bag as disc objects, slowest first. Sorted once and kept until the bag
// changes (call bagChanged() after editing player.bag).
var bagCache = null;

function bagDiscs() {
	if (!bagCache) {
		// slowest first; the same mold heaviest first (so the putter is the heaviest one)
		player.bag.sort(function (a, c) { var x = bagDisc(a), y = bagDisc(c); return (x.n[0] - y.n[0]) || (y.g - x.g); });
		bagCache = [];
		for (var i = 0; i < player.bag.length; i++) { var d = bagDisc(player.bag[i]); if (d) bagCache.push(d); }
	}
	return bagCache;
}

function bagChanged() { bagCache = null; }

function puttDisc() { return bagDiscs()[0]; }
function domHand() { return S.hand === player.hand; }   // throwing with the dominant hand
function level() { return LEVELS[player.level] || LEVELS.reg; }
// The arm speed a disc needs to fly fully: a lighter one gets up to speed with less
function speedNeed(d) { return d.n[0] * (1 + 0.12 * wtOf(d)); }
function armSpeed(style, dom) { var L = level(); return (style === "FH" ? L.fh : L.bh) * (dom ? 1 : OFF_HAND); }

function handName(h) { return h === "R" ? "Right" : "Left"; }
function styleName(s) { return s === "BH" ? "Backhand" : (s === "FH" ? "Forehand" : "Tomahawk"); }
function angleName(a) { return a === "H" ? "Hyzer" : (a === "A" ? "Anhyzer" : "Flat"); }
