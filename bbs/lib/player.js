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

// The bag as disc objects, slowest first, without any lost in the water this round (those stay
// in player.bag, which gets saved: see R.lost). Sorted once and kept until the bag changes (call
// bagChanged() after editing player.bag or R.lost).
var bagCache = null;

function lostThisRound(key) {
	for (var i = 0; R && i < R.lost.length; i++) if (R.lost[i].disc.key === key) return true;
	return false;
}

function bagDiscs() {
	if (!bagCache) {
		// slowest first; the same mold heaviest first (so the putter is the heaviest one)
		player.bag.sort(function (a, c) { var x = bagDisc(a), y = bagDisc(c); return (x.n[0] - y.n[0]) || (y.g - x.g); });
		bagCache = [];
		for (var i = 0; i < player.bag.length; i++) { var d = bagDisc(player.bag[i]); if (d && !lostThisRound(d.key)) bagCache.push(d); }
	}
	return bagCache;
}

function bagChanged() { bagCache = null; }

// The putter: the bag's first putter (slowest, then heaviest). fitBag makes sure there is one.
function puttDisc() {
	var b = bagDiscs();
	for (var i = 0; i < b.length; i++) if (b[i].type === "P") return b[i];
	return b[0];
}

function isPutterKey(k) { var d = bagDisc(k); return !!d && d.type === "P"; }
function bagPutters() { var n = 0; for (var i = 0; i < player.bag.length; i++) if (isPutterKey(player.bag[i])) n++; return n; }
// The discs besides the putter (a second putter counts as one of them)
function bagOthers() { return player.bag.length - (bagPutters() ? 1 : 0); }

// A rule of the game: every bag has a putter, plus up to size other discs (the house rules' bag
// size). The bag screen won't let you leave without a putter; this is for anything else (a bag
// saved before the rule) and adds a KC Aviar. It also takes out the fastest discs past the
// limit (never the last putter). Returns the bag keys it took out.
var DEFAULT_PUTTER = "KC Aviar";

function fitBag(size) {
	var removed = [], i;
	if (!bagPutters()) player.bag.unshift(bagKey(DEFAULT_PUTTER, MAX_G));
	bagChanged();
	bagDiscs();                                          // sorts player.bag, slowest first
	for (i = player.bag.length - 1; i >= 0 && player.bag.length > size + 1; i--) {
		if (isPutterKey(player.bag[i]) && bagPutters() === 1) continue;
		removed.push(player.bag.splice(i, 1)[0]);
	}
	bagChanged();
	return removed;
}
function domHand() { return S.hand === player.hand; }   // throwing with the dominant hand
function level() { return LEVELS[player.level] || LEVELS.reg; }
// The arm speed a disc needs to fly fully: a lighter one gets up to speed with less
function speedNeed(d) { return d.n[0] * (1 + 0.12 * wtOf(d)); }
function armSpeed(style, dom) { var L = level(); return (style === "FH" ? L.fh : L.bh) * (dom ? 1 : OFF_HAND); }

function handName(h) { return h === "R" ? "Right" : "Left"; }
function styleName(s) { return s === "BH" ? "Backhand" : (s === "FH" ? "Forehand" : "Tomahawk"); }
function angleName(a) { return a === "H" ? "Hyzer" : (a === "A" ? "Anhyzer" : "Flat"); }
