// discgolf.js - Disc golf door for Synchronet BBS
//
// A Genesis-style disc golf game built on the 3-click swing meter from
// golfmeter.js. Pick a disc, a hand, a throw (backhand, forehand or hammer)
// and a release angle, aim with the arrow keys, then:
//   SPACE 1: start the reach-back      SPACE 2: set power
//   SPACE 3: release as the marker comes back through the yellow zone
//
// Install: copy to your xtrn folder, add it in SCFG > External Programs
// with the command line:  ?discgolf.js
//
// Written for Synchronet's JavaScript engine (ES5: no let/const/arrows).

"use strict";
require("sbbsdefs.js", "K_NONE");

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
var ARM_BH = 10;         // backhand arm speed: fully powers a speed-10 disc
var ARM_FH = 9;          // forehand arm speed
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

// ---- Courses --------------------------------------------------------------
// Each hole is drawn on a 78x16 grid; the door scales it so the tee-to-basket
// path matches the real hole length. pts = path from tee to basket (grid
// cells), hw = fairway half-width in meters, rough = rough band in meters,
// left/right = how wooded each side is (dense, medium, light, open),
// trees = single trees, ob = out-of-bounds areas (R road, P parking, W water).
// Left/right are as seen from the tee looking down the fairway.
// elev (optional, feet) = { tee: 0, basket: -12, hills: [[col, row, radius, height]] }
//   tee/basket heights set the overall slope; each hill is a bump (or a dip,
//   with a negative height) centered on a map cell. Leave it out for flat.
//
// Turkey Creek: hole lengths and pars from the course listing (UDisc, 2026).
// Fairway shapes are drawn from the course descriptions (tight tunnels along
// wood lines, road and parking in play) - not surveyed. Adjust to match the
// real holes. No elevation is set yet: add elev to a hole once you know it.
var COURSES = [{
	name: "Turkey Creek",
	where: "Coralville Reservoir, Iowa City, IA",
	holes: [
		{ par: 3, ft: 155, pts: [[8, 9], [68, 8]], hw: 4.5, rough: 2, left: "medium", right: "dense",
		  trees: [[40, 9]], ob: [{ t: "P", x1: 0, y1: 0, x2: 77, y2: 2 }],
		  note: "Short one to start. The parking lot sits just left - stay right of it." },
		{ par: 3, ft: 355, pts: [[5, 5], [40, 6], [71, 11]], hw: 6, rough: 3, left: "dense", right: "light",
		  trees: [[50, 9], [28, 7]],
		  note: "Rides the wood line: tight woods left, open right, bends right late." },
		{ par: 3, ft: 355, pts: [[5, 12], [36, 11], [71, 4]], hw: 4, rough: 2, left: "dense", right: "dense",
		  trees: [[55, 7]],
		  note: "Tunnel shot that turns left. A hyzer or a forehand (for righties) fits." },
		{ par: 3, ft: 195, pts: [[8, 7], [64, 7]], hw: 6, rough: 3, left: "light", right: "medium",
		  trees: [[36, 6], [37, 9]], ob: [{ t: "R", x1: 72, y1: 0, x2: 77, y2: 15 }],
		  note: "Open look with the road long. Don't run it past the pin." },
		{ par: 3, ft: 380, pts: [[5, 8], [30, 6], [55, 10], [72, 8]], hw: 7, rough: 7, left: "dense", right: "dense",
		  trees: [[42, 9]],
		  note: "The longest hole. Wide fairway but the rough off it is heavy." },
		{ par: 3, ft: 274, pts: [[6, 3], [42, 4], [70, 12]], hw: 4, rough: 2, left: "dense", right: "dense",
		  trees: [[30, 3]],
		  note: "Tunnel that bends right at the end. Turnover or anhyzer line." },
		{ par: 3, ft: 292, pts: [[6, 11], [72, 10]], hw: 6, rough: 3, left: "open", right: "dense",
		  trees: [[45, 9], [20, 11]], ob: [{ t: "P", x1: 26, y1: 0, x2: 77, y2: 4 }],
		  note: "Along the tree line with the lot on the left. A fade toward it is trouble." },
		{ par: 3, ft: 210, pts: [[8, 8], [68, 7]], hw: 3.5, rough: 2, left: "dense", right: "dense",
		  trees: [[38, 7]],
		  note: "Tight, straight tunnel. Flat and smooth beats big arm here." },
		{ par: 3, ft: 284, pts: [[6, 11], [44, 10], [70, 4]], hw: 5, rough: 3, left: "medium", right: "dense",
		  trees: [[58, 7]], ob: [{ t: "R", x1: 0, y1: 14, x2: 77, y2: 15 }],
		  note: "Finish with a left turn. The road runs along the right side." }
	]
}];

// ---- Basics ---------------------------------------------------------------
function now() { return system.timer; }
function rnd() { return Math.random(); }
function hyp(x, y) { return Math.sqrt(x * x + y * y); }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function blank(n) { return n > 0 ? new Array(n + 1).join(" ") : ""; }
function pad(s, n) { s = String(s); return s.length >= n ? s.substr(0, n) : s + blank(n - s.length); }
function ft(m) { return Math.round(m * FT); }
function angDiff(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
function cycle(list, cur) { return list[(list.indexOf(cur) + 1) % list.length]; }   // the item after cur, wrapping

// Seeded random numbers so each hole's woods come out the same every time
function seeded(seed) {
	var a = seed % 4294967296;
	return function () {          // plain LCG; exact in doubles, works in ES5
		a = (a * 1664525 + 1013904223) % 4294967296;
		return a / 4294967296;
	};
}

// ---- Lean screen output (raw ANSI, tracks cursor and color) --------------
// Colors use ANSI order: 0 black 1 red 2 green 3 brown 4 blue 5 magenta
// 6 cyan 7 gray, +8 bright (10 lt green, 11 yellow, 15 white), +16*n
// background, +128 underline.
var scr = { row: 0, col: 0, attr: -1 };

function setAttr(a) {
	if (a === scr.attr) return "";
	var p = [], o = scr.attr;
	if (o < 0 || ((o & 8) && !(a & 8)) || ((o & 0x70) && !(a & 0x70)) || ((o & 0x80) && !(a & 0x80))) { p.push(0); o = 7; }
	if ((a & 8) && !(o & 8)) p.push(1);
	if ((a & 0x80) && !(o & 0x80)) p.push(4);
	if ((a & 7) !== (o & 7)) p.push(30 + (a & 7));
	if ((a & 0x70) !== (o & 0x70)) p.push(40 + ((a >> 4) & 7));
	scr.attr = a;
	return p.length ? "\x1b[" + p.join(";") + "m" : "";
}

function moveTo(x, y) {
	if (y === scr.row && x === scr.col) return "";
	var s, d = scr.col - x;
	if (y === scr.row && d > 0 && d <= 3) s = new Array(d + 1).join("\b");
	else if (y === scr.row && d > 0) s = "\x1b[" + d + "D";
	else if (y === scr.row && d < 0) s = "\x1b[" + (-d) + "C";
	else s = "\x1b[" + y + ";" + x + "H";
	scr.row = y; scr.col = x;
	return s;
}

function text(str, attr) {
	var s = (attr === undefined ? "" : setAttr(attr)) + str;
	scr.col += str.length;
	if (scr.col > SCR_W) scr.row = 0;   // hit the right edge: next move is absolute
	return s;
}

function out(s) { if (s) console.write(s); }

// Ctrl-A color codes to raw ANSI. "~X" draws X as a hotkey (HOT_ATTR).
// Stops after max visible characters.
// Returns [ansi, visibleLength].
function ca(str, base, max) {
	var o = "", a = base === undefined ? 7 : base, buf = "", vis = 0;
	if (!max) max = 999;
	for (var i = 0; i < str.length && vis + buf.length < max; i++) {
		var ch = str.charAt(i);
		if (ch === "~" && i + 1 < str.length) {
			if (buf) { o += text(buf, a); vis += buf.length; buf = ""; }
			o += text(str.charAt(++i), HOT_ATTR); vis++;
			continue;
		}
		if (ch === "\x01" && i + 1 < str.length) {
			if (buf) { o += text(buf, a); vis += buf.length; buf = ""; }
			var c = str.charAt(++i).toLowerCase(), k = "krgybmcw".indexOf(c);
			if (c === "n") a = 7;
			else if (c === "h") a |= 8;
			else if (k >= 0) a = (a & 0x78) | k;
			continue;
		}
		buf += ch;
	}
	if (buf) { o += text(buf, a); vis += buf.length; }
	return [o, vis];
}

// Writes a Ctrl-A string at x,y, cut or padded to exactly width characters
function put(x, y, str, width, base) {
	var m = moveTo(x, y), r = ca(str, base, width);   // move first: ca() advances the cursor record
	out(m + r[0] + (width ? text(blank(width - r[1]), 7) : ""));
}

function cls() {
	out(setAttr(7) + "\x1b[2J\x1b[H");
	scr.row = 1; scr.col = 1;
}

function key() { return console.getkey(K_NONE); }

function waitKey(msg) {
	if (msg) put(BAR_X, STATUS_Y, "\x01n\x01h" + msg, BAR_W + 2);
	return key();
}

function isLeft(k) { return k === KEY_LEFT || k === "j" || k === "J"; }
function isRight(k) { return k === KEY_RIGHT || k === "l" || k === "L"; }
function isUp(k) { return k === KEY_UP || k === "i" || k === "I"; }
function isDown(k) { return k === KEY_DOWN || k === "k" || k === "K"; }

// ---- Lag (measured once per round, as in golfmeter.js) ------------------
function measureLag() {
	var s = [];
	for (var i = 0; i < 5; i++) {
		var t0 = now(), pos = console.getxy(), dt = now() - t0;
		if (pos && pos.x !== undefined) s.push(dt);
	}
	if (!s.length) return 0;
	s.sort(function (a, b) { return a - b; });
	return Math.min(s[Math.floor(s.length / 2)], MAX_LAG_COMP);
}

// ---- The meter -------------------------------------------------------------
function posAt(t) {
	var top = BAR_W - 1;
	if (t <= SWEEP_SEC) return top * (t / SWEEP_SEC);
	return top - top * ((t - SWEEP_SEC) / SWEEP_SEC);
}

function powerAt(pos) {
	var pct = (pos - SNAP) / (P100 - SNAP) * 100;
	if (pct > 100) pct = 200 - pct;
	return Math.max(0, Math.min(100, Math.round(pct)));
}

function pctCol(p) { return Math.round(SNAP + p / 100 * (P100 - SNAP)); }

// marks: [[percent, label], ...] (default 25/50/75/100). basketPct: where
// the basket sits on the scale when putting (drawn as a small basket).
function drawMeter(marks, basketPct) {
	marks = marks || [[25, "25"], [50, "50"], [75, "75"], [100, "100"]];
	var s = "";
	s += moveTo(BAR_X, BAR_Y - 2) + text(blank(BAR_W + 2), 7);
	s += moveTo(BAR_X, BAR_Y - 1) + text(blank(BAR_W + 2), 7);
	for (var m = 0; m < marks.length; m++) {
		var col = pctCol(marks[m][0]), lab = marks[m][1];
		s += moveTo(BAR_X + col - Math.floor((lab.length - 1) / 2), BAR_Y - 2) + text(lab, marks[m][0] === 100 ? 15 : 7);
		s += moveTo(BAR_X + col, BAR_Y - 1) + text("|", 8);
	}
	if (basketPct !== undefined) s += moveTo(BAR_X + pctCol(Math.min(100, basketPct)), BAR_Y - 1) + text("\xE8", 11);
	s += moveTo(BAR_X, BAR_Y);
	for (var i = 0; i < BAR_W; i++) {
		if (i >= SNAP && i < SNAP + SNAP_W) s += text("\xDB", 11); // release zone
		else if (i < SNAP) s += text("\xB1", 1);                  // late side
		else if (i === P100) s += text("\xDB", 15);               // 100%
		else if (i > P100) s += text("\xDB", 2);                  // overswing
		else s += text("\xB1", 10);                               // power
	}
	s += moveTo(BAR_X, BAR_Y + 1) + text(blank(BAR_W), 7);
	s += moveTo(BAR_X, BAR_Y + 2) + text(blank(BAR_W), 7);
	out(s);
}

function markerBytes(oldCol, newCol) {
	var vis = function (c) { return c >= 0 && c < BAR_W; }, s = "";
	if (vis(oldCol) && vis(newCol) && Math.abs(newCol - oldCol) <= 4) {
		var a = Math.min(oldCol, newCol), b = Math.max(oldCol, newCol), span = "";
		for (var c = a; c <= b; c++) span += (c === newCol ? "^" : " ");
		return moveTo(BAR_X + a, BAR_Y + 1) + text(span, 15);
	}
	if (vis(oldCol)) s += moveTo(BAR_X + oldCol, BAR_Y + 1) + text(" ");
	if (vis(newCol)) s += moveTo(BAR_X + newCol, BAR_Y + 1) + text("^", 15);
	return s;
}

function status(msg) { put(BAR_X, STATUS_Y, msg, BAR_W + 2); }

function markPress(col, ch) {
	if (col < 0 || col >= BAR_W) return;
	out(moveTo(BAR_X + col, BAR_Y + 2) + text(ch, 14));
}

// Runs one swing. SPACE has already been pressed to start it.
// Returns { power, over, accuracy } or { whiff: true, power }.
// As soon as power is set, the marker turns around and heads back toward
// the yellow from where it is. (Set power after it bounces off the end and
// it just keeps coming back.)
function swingMeter(lag) {
	out(moveTo(BAR_X, BAR_Y + 1) + text(blank(BAR_W), 7) + moveTo(BAR_X, BAR_Y + 2) + text(blank(BAR_W), 7));
	var start = now(), power = null, over = false, lastCol = -1;
	var speed = (BAR_W - 1) / SWEEP_SEC, turnT = null, turnPos = 0;
	function pos(t) { return (turnT !== null && t >= turnT) ? turnPos - (t - turnT) * speed : posAt(t); }
	status("Reach back... \x01hSPACE\x01n for power");
	while (bbs.online && !js.terminated) {
		var t = now() - start, p = pos(t);
		if (p < 0) { out(markerBytes(lastCol, -1)); return { whiff: true, power: power === null ? 30 : power, over: over }; }
		var col = Math.round(p);
		if (col !== lastCol) { out(markerBytes(lastCol, col)); lastCol = col; }
		var k = console.inkey(K_NONE, FRAME_MS);
		if (k !== " ") continue;
		var tNow = now() - start, hitT = Math.max(0, tNow - lag);   // rewind to what the caller saw
		if (power === null) {
			var hp = posAt(hitT);
			power = powerAt(hp);
			over = hp > P100 + 0.5;
			markPress(Math.round(hp), "P");
			if (tNow < SWEEP_SEC) { turnT = tNow; turnPos = posAt(tNow); }   // head back now
			status((over ? "\x01h\x01rOverswing!\x01n " : "") + "Power " + power + "%  - \x01hSPACE\x01n in the yellow to release");
		} else {
			var ap = pos(hitT);
			markPress(Math.round(ap), "R");
			return { power: power, over: over, accuracy: ap - SNAP_MID };
		}
	}
	return { whiff: true, power: 30, over: false };
}

// ---- Player ---------------------------------------------------------------
var player = {
	hand: "R",           // dominant hand
	style: "BH",         // usual throw
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
function armSpeed(style, dom) { return (style === "FH" ? ARM_FH : ARM_BH) * (dom ? 1 : OFF_HAND); }

function handName(h) { return h === "R" ? "Right" : "Left"; }
function styleName(s) { return s === "BH" ? "Backhand" : (s === "FH" ? "Forehand" : "Hammer"); }
function angleName(a) { return a === "H" ? "Hyzer" : (a === "A" ? "Anhyzer" : "Flat"); }

// ---- Holes ------------------------------------------------------------------
// Map cell (column, row) to world meters, m meters per column
function gridPt(c, r, m) { return { x: c * m, y: r * 2 * m }; }

function buildHole(h, idx) {
	var L1 = 0, i;
	for (i = 1; i < h.pts.length; i++) L1 += hyp(h.pts[i][0] - h.pts[i - 1][0], 2 * (h.pts[i][1] - h.pts[i - 1][1]));
	var S = (h.ft / FT) / L1;   // meters per column (a row is 2*S tall)
	var P = [];
	for (i = 0; i < h.pts.length; i++) P.push(gridPt(h.pts[i][0], h.pts[i][1], S));
	var dens = {
		dense:  { w: 0.72, t: 0.18 },
		medium: { w: 0.4,  t: 0.3 },
		light:  { w: 0.06, t: 0.22 },
		open:   { w: 0,    t: 0.04 }
	};
	var rng = seeded(4099 + idx * 7919), grid = [], x, y;
	for (y = 0; y < MAP_H; y++) {
		var row = [];
		for (x = 0; x < MAP_W; x++) {
			var q = nearest(P, x * S, y * 2 * S), t;
			if (q.d <= h.hw) t = ".";
			else if (q.d <= h.hw + (h.rough || 3)) t = ",";
			else {
				var dd = dens[q.side < 0 ? h.left : h.right] || dens.dense, r = rng();
				t = r < dd.w ? "#" : (r < dd.w + dd.t ? "T" : ",");
			}
			row.push(t);
		}
		grid.push(row);
	}
	var ob = h.ob || [];
	for (i = 0; i < ob.length; i++)
		for (y = ob[i].y1; y <= ob[i].y2; y++)
			for (x = ob[i].x1; x <= ob[i].x2; x++)
				if (grid[y] && grid[y][x] !== undefined) grid[y][x] = ob[i].t;
	var tr = h.trees || [];
	for (i = 0; i < tr.length; i++) grid[tr[i][1]][tr[i][0]] = "T";
	var tee = h.pts[0], bk = h.pts[h.pts.length - 1];
	grid[tee[1]][tee[0]] = "S";
	grid[bk[1]][bk[0]] = "B";
	for (y = -1; y <= 1; y++) for (x = -2; x <= 2; x++) {
		var a = grid[tee[1] + y], b = grid[bk[1] + y];
		if (a && (a[tee[0] + x] === "#" || a[tee[0] + x] === "T") && (x || y)) a[tee[0] + x] = ",";
		if (b && (b[bk[0] + x] === "#" || b[bk[0] + x] === "T") && (x || y)) b[bk[0] + x] = ".";
	}
	var H = {
		def: h, num: idx + 1, par: h.par, ft: h.ft, S: S, grid: grid,
		tee: gridPt(tee[0], tee[1], S),
		basket: gridPt(bk[0], bk[1], S)
	};
	buildTrunks(H);
	return H;
}

// Every tree on the map becomes trunks at fixed spots. The view from the
// player and the disc's flight both use these, so a gap you can see is a
// gap the disc can fly through.
function buildTrunks(H) {
	var rng = seeded(77 + H.num * 131), list = [], cells = [], r, c, k;
	for (r = 0; r < MAP_H; r++) { cells.push([]); for (c = 0; c < MAP_W; c++) cells[r].push([]); }
	for (r = 0; r < MAP_H; r++) for (c = 0; c < MAP_W; c++) {
		var g = H.grid[r][c], n = g === "T" ? 1 : (g === "#" ? (rng() < 0.5 ? 2 : 1) : 0);
		for (k = 0; k < n; k++) {
			var t = { x: (c + (rng() - 0.5) * 0.9) * H.S, y: (r + (rng() - 0.5) * 0.9) * 2 * H.S, rad: 0.09 + rng() * 0.09 };
			list.push(t);
			cells[r][c].push(t);
		}
	}
	H.trunks = list;
	H.trunkCells = cells;
}

// The trunk the disc would clip at point p, if any
function trunkAt(H, p, extra) {
	var c0 = cellOf(H, p);
	for (var r = c0.r - 1; r <= c0.r + 1; r++) {
		if (r < 0 || r >= MAP_H) continue;
		for (var c = c0.c - 1; c <= c0.c + 1; c++) {
			if (c < 0 || c >= MAP_W) continue;
			var l = H.trunkCells[r][c];
			for (var i = 0; i < l.length; i++) if (hyp(p.x - l[i].x, p.y - l[i].y) < l[i].rad + extra) return l[i];
		}
	}
	return null;
}

// Distance (m) from a point to the hole's path, and which side it's on
function nearest(P, px, py) {
	var best = { d: 1e9, side: 0 };
	for (var i = 1; i < P.length; i++) {
		var ax = P[i - 1].x, ay = P[i - 1].y, bx = P[i].x, by = P[i].y;
		var dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
		var u = clamp(((px - ax) * dx + (py - ay) * dy) / L2, 0, 1);
		var cx = ax + dx * u, cy = ay + dy * u, d = hyp(px - cx, py - cy);
		if (d < best.d) best = { d: d, side: dx * (py - ay) - dy * (px - ax) };
	}
	return best;
}

function cellOf(H, p) { return { c: Math.round(p.x / H.S), r: Math.round(p.y / (2 * H.S)) }; }
function inMap(c) { return c.c >= 0 && c.c < MAP_W && c.r >= 0 && c.r < MAP_H; }

function tileAt(H, p) {
	var c = cellOf(H, p);
	if (!inMap(c)) return "O";
	return H.grid[c.r][c.c];
}

function isOB(t) { return t === "R" || t === "P" || t === "W" || t === "O"; }
function isTrees(t) { return t === "T" || t === "#"; }

// ---- Elevation (feet) -------------------------------------------------------
function heightAt(H, p) {
	var e = H.def.elev;
	if (!e) return 0;
	var vx = H.basket.x - H.tee.x, vy = H.basket.y - H.tee.y;
	var t = clamp(((p.x - H.tee.x) * vx + (p.y - H.tee.y) * vy) / (vx * vx + vy * vy), 0, 1);
	var h = (e.tee || 0) + ((e.basket || 0) - (e.tee || 0)) * t, hl = e.hills || [];
	for (var i = 0; i < hl.length; i++) {
		var d = hyp(p.x - hl[i][0] * H.S, p.y - hl[i][1] * 2 * H.S) / (hl[i][2] * H.S);
		h += hl[i][3] * Math.exp(-d * d * 2);
	}
	return h;
}

function elevText(dFt) {
	var d = Math.round(dFt);
	return Math.abs(d) < 2 ? "" : (d > 0 ? "up " + d + " ft" : "down " + (-d) + " ft");
}

var GLYPH = {
	".": ["\xB1", 10],   // fairway
	",": ["\xB0", 2],    // rough
	"T": ["\xE7", 10],   // tree
	"#": ["\xE7", 0x20], // woods: dark trees on green
	"R": ["\xB1", 8],    // road (OB)
	"P": ["\xB0", 7],    // parking lot (OB)
	"W": ["\xF7", 12],   // water (OB)
	"S": ["\xDB", 7],    // tee pad
	"B": ["\xE8", 11]    // basket
};

// ---- Round state ------------------------------------------------------------
var R = null;  // { course, holes[], strokes[], lag }
var S = null;  // current hole/shot state

function newWind() {
	var dirs = [[0, -1, "N"], [1, -1, "NE"], [1, 0, "E"], [1, 1, "SE"], [0, 1, "S"], [-1, 1, "SW"], [-1, 0, "W"], [-1, -1, "NW"]];
	var d = dirs[Math.floor(rnd() * 8)], mph = Math.floor(rnd() * 13), L = hyp(d[0], d[1]);
	return { mph: mph, to: d[2], x: d[0] / L * mph * MPH_TO_MS, y: d[1] / L * mph * MPH_TO_MS };
}

function windText() { return S.wind.mph ? S.wind.mph + " mph to " + S.wind.to : "calm"; }

// How far a disc flies at 100% power for this thrower (meters, flat, no wind)
function discRange(d, style, dom) {
	var arm = armSpeed(style, dom);
	var r = (30 + d.n[0] * 7 + d.n[1] * 4) * Math.min(1, 0.6 + 0.4 * arm / d.n[0]);
	return style === "HM" ? r * HAMMER_RANGE : r;
}

// Caddie: the slowest disc in the bag that reaches the basket with room to spare
function caddiePick() {
	var b = bagDiscs(), pin = pinDist(), dom = domHand();
	S.disc = b.length - 1;
	for (var i = 0; i < b.length; i++) if (discRange(b[i], S.style, dom) >= pin * 1.1) { S.disc = i; break; }
}

function curDisc() { var b = bagDiscs(); return b[clamp(S.disc, 0, b.length - 1)]; }
function pinDist() { return hyp(S.H.basket.x - S.lie.x, S.H.basket.y - S.lie.y); }
function lieInTrees() { return isTrees(tileAt(S.H, S.lie)); }

// ---- Screen pieces -------------------------------------------------------
// Strokes over (+) or under (-) par for the holes finished so far
function roundToPar() {
	var rel = 0;
	for (var i = 0; i < R.strokes.length; i++) if (R.strokes[i]) rel += R.strokes[i] - R.holes[i].par;
	return rel;
}

function header(extra) {
	var rel = roundToPar(), rs = rel === 0 ? "E" : (rel > 0 ? "+" + rel : String(rel));
	var h = " " + R.course.name.toUpperCase() + "   HOLE " + S.H.num + "   PAR " + S.H.par + "   " + S.H.ft + " FT" +
		"   THROW " + (S.strokes + 1) + "   ROUND " + rs;
	if (extra) h += "   " + extra;
	else {
		var e = Math.round(heightAt(S.H, S.H.basket) - heightAt(S.H, S.H.tee));
		if (Math.abs(e) >= 2) h += "   BASKET " + (e > 0 ? "+" : "") + e + " FT";
	}
	out(moveTo(1, 1) + text(pad(h, SCR_W), 0x4F) + setAttr(7));
}

function msg(m) {
	if (m !== undefined) S.lastMsg = m;
	put(1, MSG_Y, " " + S.lastMsg, SCR_W);
}

function helpLine(mode) {
	var t;
	if (mode === "putt") t = " ~View  ~Hand  ~Scorecard  ~Quit   \x01k\x01hLeft/Right aim   SPACE putt";
	else if (mode === "relief") t = " \x01hArrows\x01n slide back/forward   \x01hENTER\x01n take this spot   \x01hESC\x01n cancel";
	else t = " ~Disc ~Throw ~Hand ~Angle ~Pitch ~View ~Relief ~Scorecard ~Quit  \x01k\x01h1-8 disc  Arrows " + (S.view === "pov" ? "turn" : "aim");
	put(1, HELP_Y, "\x01n\x01w" + t, 79);
}

function throwLabel() {
	if (S.pitch) return "Pitch-out \x01k\x01h" + (S.style === "HM" ? "BH" : S.style);
	if (S.style === "HM") return "Hammer";
	return styleName(S.style) + " \x01k\x01h" + angleName(S.angle);
}

// Panel lines shared by the throw and putt panels
function discSpecLine(d) { return "\x01n\x01k\x01h" + pad(TYPE_NAME[d.type], 9) + "\x01n" + d.n.join("/"); }
function handLine() { return "\x01n\x01h~Hand  \x01n" + handName(S.hand) + (domHand() ? "" : " \x01h\x01r(off)"); }

function showPanel(lines) { for (var i = 0; i < lines.length; i++) put(PANEL_X, PANEL_Y + i, lines[i], 20); }

function panel() {
	var d = curDisc(), pin = pinDist();
	var lines = [
		"\x01n\x01h~Disc  \x01c" + d.name,
		discSpecLine(d),
		handLine(),
		"\x01n\x01h~Throw \x01n" + throwLabel()
	];
	if (S.view === "pov" && S.pov) {
		var gi = gapInfo(S.pov.aimCol);
		lines.push("\x01n\x01hGap \x01n" + ft(gi.width) + " ft, clear " + (gi.clear > POV.maxD ? "far" : ft(gi.clear)));
		lines.push("\x01n\x01hBasket \x01n" + bearingText());
	} else {
		var up = elevText(heightAt(S.H, S.H.basket) - heightAt(S.H, S.lie));
		lines.push("\x01n\x01hWind  \x01n" + windText());
		lines.push("\x01n\x01hPin \x01n" + ft(pin) + " ft " + (up ? "\x01k\x01h" + up : "\x01k\x01hAim \x01n" + ft(hyp(S.aim.x - S.lie.x, S.aim.y - S.lie.y))));
	}
	showPanel(lines);
}

// ---- Overhead map ----------------------------------------------------------
// lc: the lie's cell, ac: the aim's cell (null when the aim isn't shown)
function cellGlyph(c, r, lc, ac) {
	if (c === lc.c && r === lc.r) return ["\xFE", 15];
	if (ac && c === ac.c && r === ac.r) return S.H.grid[r][c] === "B" ? ["\xE8", 11 | 0x50] : ["+", 13];
	return GLYPH[S.H.grid[r][c]] || [" ", 7];
}

function aimCell() { return S.showAim ? cellOf(S.H, S.aim) : null; }

function drawCell(c, r) {
	if (c < 0 || c >= MAP_W || r < 0 || r >= MAP_H) return "";
	var g = cellGlyph(c, r, cellOf(S.H, S.lie), aimCell());
	return moveTo(MAP_X + c, MAP_Y + r) + text(g[0], g[1]);
}

function drawMap() {
	var s = "", lc = cellOf(S.H, S.lie), ac = aimCell();
	for (var r = 0; r < MAP_H; r++) {
		s += moveTo(MAP_X, MAP_Y + r);
		for (var c = 0; c < MAP_W; c++) { var g = cellGlyph(c, r, lc, ac); s += text(g[0], g[1]); }
	}
	out(s);
}

// ---- View from the player (POV) -----------------------------------------
// Raycasts the hole's trunks for each screen column and floor-casts the
// ground below the horizon.
var POV = { horizon: MAP_Y + 5, fov: 70 * Math.PI / 180, camH: 1.6, f: 32, maxD: 60, clearing: 2.2 };

function colOffset(i) { return (i + 0.5 - MAP_W / 2) / MAP_W * POV.fov; }   // screen column's angle off center
function colAngle(i) { return S.pov.ang + colOffset(i); }

function povHits(H, from, ang) {
	var hit = [], near = [], tr = H.trunks, reach = POV.maxD + 1, i, j;
	// Only trunks past the clearing and close enough to be seen (a trunk this
	// far out is beyond maxD along any ray that could touch it)
	for (j = 0; j < tr.length; j++) {
		var tx = tr[j].x - from.x, ty = tr[j].y - from.y, td = hyp(tx, ty);
		if (td >= POV.clearing && td <= reach) near.push({ vx: tx, vy: ty, rad: tr[j].rad });
	}
	for (i = 0; i < MAP_W; i++) {
		var a = ang + colOffset(i), ca_ = Math.cos(a), sa = Math.sin(a), best = 1e9;
		for (j = 0; j < near.length; j++) {
			var n = near[j], along = n.vx * ca_ + n.vy * sa;
			if (along < 0.4 || along > POV.maxD || along > best) continue;
			if (Math.abs(-n.vx * sa + n.vy * ca_) < n.rad) best = along;
		}
		hit.push(best * Math.cos(a - ang));
	}
	return hit;
}

function drawPOV() {
	var H = S.H, from = S.lie, P = S.pov, i, r;
	P.hit = povHits(H, from, P.ang);
	var bx = H.basket.x - from.x, by = H.basket.y - from.y;
	P.bd = hyp(bx, by);
	P.bang = angDiff(Math.atan2(by, bx) - P.ang);
	P.bcol = Math.floor(MAP_W / 2 + P.bang / POV.fov * MAP_W);
	P.buf = [];
	var cols = [];
	for (i = 0; i < MAP_W; i++) cols.push(povColumn(i));
	var s = "";
	for (r = 0; r < MAP_H; r++) {
		var row = MAP_Y + r, line = [];
		s += moveTo(MAP_X, row);
		for (i = 0; i < MAP_W; i++) {
			var g = povCell(i, row, cols[i]);
			line.push(g);
			s += text(g[0], g[1]);
		}
		P.buf.push(line);
	}
	out(s + setAttr(7));
	povAimOverlay(P.aimCol, true);
	basketMarker();
}

// What povCell needs for a column, worked out once per column: the ray's
// direction and the rows of the nearest trunk's base, trunk top and crown
function povColumn(i) {
	var a = colAngle(i), d = S.pov.hit[i];
	return {
		ca: Math.cos(a), sa: Math.sin(a), off: Math.cos(a - S.pov.ang),
		base: POV.horizon + POV.camH * POV.f / d,
		trunkTop: POV.horizon - (2.6 - POV.camH) * POV.f / d,
		crown: POV.horizon - (9 - POV.camH) * POV.f / d
	};
}

function povCell(i, row, C) {
	var H = S.H, P = S.pov, d = P.hit[i], g = [" ", 0x40];
	if (row >= POV.horizon) {
		var fd = POV.camH * POV.f / (row - POV.horizon + 0.5) / C.off;
		var t = fd > POV.maxD ? "," : tileAt(H, { x: S.lie.x + C.ca * fd, y: S.lie.y + C.sa * fd });
		g = t === "." ? ["\xB1", 10] : (isOB(t) && t !== "O" ? ["\xB1", 8] : ["\xB0", 2]);
	}
	if (d < 1e8 && row <= C.base && row >= C.crown) {
		if (row >= C.trunkTop) g = [d < 12 ? "\xDB" : (d < 28 ? "\xB2" : "\xB1"), d < 28 ? 3 : 8];
		else g = [d < 20 ? "\xB2" : "\xB1", row < POV.horizon ? 2 | 0x40 : 2];
	}
	if (i === P.bcol && P.bd < d) {
		var bTop = Math.round(POV.horizon + (POV.camH - 1.35) * POV.f / P.bd), bBase = Math.round(POV.horizon + POV.camH * POV.f / P.bd);
		if (row === bTop) g = ["\xE8", 11 | (row < POV.horizon ? 0x40 : 0)];
		else if (row > bTop && row <= bBase) g = ["\xB3", 7 | (row < POV.horizon ? 0x40 : 0)];
	}
	return g;
}

// Dotted aim line up the ground to where the line is blocked
function povAimOverlay(col, on) {
	var P = S.pov, s = "";
	if (col < 0 || col >= MAP_W) return;
	for (var r = 0; r < MAP_H; r++) {
		var row = MAP_Y + r, g = P.buf[r][col];
		if (on && row >= POV.horizon) {
			var rowD = POV.camH * POV.f / (row - POV.horizon + 0.5);
			if (rowD <= P.hit[col]) g = [r === MAP_H - 1 ? "^" : "\xFA", 13];
		}
		if (row >= POV.horizon || !on) s += moveTo(MAP_X + col, row) + text(g[0], g[1]);
	}
	out(s);
	if (!on && P.bcol >= 0 && P.bcol < MAP_W) basketMarker();
}

// Basket marker across the top: over the basket when it's in view (seen or
// hidden by trees), a small arrow at the edge when it isn't.
function basketMarker() {
	var P = S.pov, lab = "\xE8 " + ft(P.bd) + " ft", y = MAP_Y;
	if (P.bcol >= 0 && P.bcol < MAP_W) {
		var x = clamp(MAP_X + P.bcol - Math.floor(lab.length / 2), MAP_X, MAP_X + MAP_W - lab.length);
		put(x, y, "\x01h\x01y" + lab, 0, 0x40);
		out(moveTo(MAP_X + P.bcol, y + 1) + text("v", 11 | 0x40) + setAttr(7));
	} else if (P.bcol < 0) {
		put(MAP_X, y, "\x01h\x01y\xAE " + lab, 0, 0x40);
	} else {
		var lab2 = lab + " \xAF";
		put(MAP_X + MAP_W - lab2.length, y, "\x01h\x01y" + lab2, 0, 0x40);
	}
}

function gapInfo(col) {
	var P = S.pov, c = clamp(col, 0, MAP_W - 1), clear = P.hit[c], need = Math.min(clear, 12) * 0.8, l = c, r = c;
	while (l > 0 && P.hit[l - 1] >= need) l--;
	while (r < MAP_W - 1 && P.hit[r + 1] >= need) r++;
	var w = (r - l + 1) / MAP_W * POV.fov, at = Math.min(clear, 12);
	return { clear: clear, width: 2 * Math.tan(w / 2) * at };
}

function bearingText() {
	var P = S.pov, deg = Math.round((P.bang - colOffset(P.aimCol)) * 180 / Math.PI);
	return Math.abs(deg) < 1 ? "on your line" : Math.abs(deg) + "\xF8 " + (deg < 0 ? "left" : "right");
}

// Points S.aim along the POV aim column
function povSetAim() {
	var a = colAngle(S.pov.aimCol), d = Math.max(pinDist(), 15);
	S.aim = { x: S.lie.x + Math.cos(a) * d, y: S.lie.y + Math.sin(a) * d };
}

function povStart() {
	var a = Math.atan2(S.aim.y - S.lie.y, S.aim.x - S.lie.x);
	S.pov = { ang: a, aimCol: MAP_W / 2 - 1 };
}

function povTurn(dc) {
	var P = S.pov, nc = P.aimCol + dc;
	if (nc < 4 || nc > MAP_W - 5) {
		P.ang = colAngle(nc);   // re-center the view on the new line
		P.aimCol = MAP_W / 2 - 1;
		P.ang -= colOffset(P.aimCol);
		drawPOV();
	} else {
		povAimOverlay(P.aimCol, false);
		P.aimCol = nc;
		povAimOverlay(nc, true);
	}
	povSetAim();
}

// ---- Shot screen -----------------------------------------------------------
function drawShotScreen() {
	cls();
	if (S.view === "pov") {
		header(lieInTrees() ? "IN THE TREES" : "VIEW FROM YOUR LIE");
		if (!S.pov) povStart();
		drawPOV();
		povSetAim();
	} else {
		header();
		drawMap();
	}
	msg();
	helpLine();
	drawMeter();
	panel();
	status("\x01hSPACE\x01n to throw");
}

// ---- Flight ------------------------------------------------------------------
// Throws the current disc from S.lie toward S.aim. Returns the path (world
// points), where it ended, and what happened.
function fly(sw) {
	var H = S.H, d = curDisc(), n = d.n, speed = n[0], turn = n[2], fade = n[3];
	var dom = domHand(), hammer = S.style === "HM", pitch = S.pitch;
	var arm = armSpeed(S.style, dom);
	var pf = (sw.power || 0) / 100;
	if (pitch) pf *= PITCH_POWER;
	var cw = (S.hand === "R") === (S.style !== "FH");    // clockwise spin: fades left
	var fadeSide = cw ? -1 : 1;                          // in right-positive terms
	var armFull = arm / speed, ar = armFull * pf;

	var dist = Math.max(1, discRange(d, S.style, dom) * pf);
	var effTurn = turn * clamp(ar, 0, 1.4);              // turn shows up only at speed
	var effFade = fade + Math.max(0, 0.8 - ar) * 2;      // underpowered discs fade early
	if (sw.over) effTurn -= 1;                           // muscled it: turns over
	if (pitch) { effTurn *= 0.5; effFade *= 0.5; }

	var dx = S.aim.x - S.lie.x, dy = S.aim.y - S.lie.y, L = hyp(dx, dy);
	if (L < 0.5) { dx = H.basket.x - S.lie.x; dy = H.basket.y - S.lie.y; L = hyp(dx, dy) || 1; }
	dx /= L; dy /= L;
	var rx = -dy, ry = dx;
	var head = -(S.wind.x * dx + S.wind.y * dy), cross = S.wind.x * rx + S.wind.y * ry;
	effTurn -= head * 0.12;                              // headwind: more turn
	if (head < 0) effFade += -head * 0.1;                // tailwind: more fade
	dist *= 1 - head * 0.02;

	// elevation: downhill flies farther and fades more, uphill comes up short
	var drop = (heightAt(H, S.lie) - heightAt(H, { x: S.lie.x + dx * dist, y: S.lie.y + dy * dist })) / FT;
	dist = Math.max(1, dist + drop);
	if (drop > 0) effFade += drop * 0.05;

	var angTerm = 0;
	if (!hammer && S.angle === "H") { effTurn *= 0.4; angTerm = 0.08; }
	else if (!hammer && S.angle === "A") { effTurn -= 0.8; angTerm = -0.08; }

	// Release timing: early = toward the fade side, late = toward the turn side
	var accMul = (dom ? 1 : OFF_ACC) * (sw.over ? OVER_ACC : 1) * (hammer ? 1.4 : 1) * (pitch ? 0.7 : 1);
	var err;
	if (sw.whiff) err = (rnd() - 0.5) * 0.6;
	else {
		err = sw.accuracy * 0.025 * accMul;
		if (Math.abs(sw.accuracy) > SNAP_TOL) err += (rnd() - 0.5) * 0.03 * accMul;
	}
	var rot = err * fadeSide, cr = Math.cos(rot), sr = Math.sin(rot);
	var fx = dx * cr + rx * sr, fy = dy * cr + ry * sr;   // rotated forward
	var gx = -fy, gy = fx;                                // rotated right
	var hamSide = S.hand === "R" ? 1 : -1;               // a righty's hammer curves right

	var path = [], lastIn = { x: S.lie.x, y: S.lie.y }, res = { tree: false, basket: false, ob: false };
	var steps = Math.max(2, Math.ceil(dist / 0.5)), discR = pitch ? 0.04 : 0.11;
	for (var i = 1; i <= steps; i++) {
		var s = dist * i / steps, u = s / dist, lat;
		if (hammer) lat = hamSide * dist * 0.12 * u * u + cross * dist * 0.02 * u;
		else {
			var ts = u < 0.75 ? (u / 0.75) * (u / 0.75) : 1;
			var fs = u < 0.55 ? 0 : ((u - 0.55) / 0.45) * ((u - 0.55) / 0.45);
			lat = (effFade * dist * 0.05 * fs + effTurn * dist * 0.035 * ts + angTerm * dist * u * u) * fadeSide + cross * dist * 0.012 * u;
		}
		var p = { x: S.lie.x + fx * s + gx * lat, y: S.lie.y + fy * s + gy * lat };
		path.push(p);
		var t = tileAt(H, p);
		if (!isOB(t)) lastIn = p;
		var bd = hyp(p.x - H.basket.x, p.y - H.basket.y);
		if (u > 0.5 && bd < 0.7 && !hammer) {
			res.basket = true;
			if (rnd() < 0.7) { res.end = { x: H.basket.x, y: H.basket.y }; res.inBasket = true; return finish(res, path); }
			res.end = { x: H.basket.x - fx * (1 + rnd()), y: H.basket.y + (rnd() - 0.5) * 2 };
			return finish(res, path);
		}
		// trees: a hammer flies over them until it comes down
		if ((!hammer || u > 0.8) && hyp(p.x - S.lie.x, p.y - S.lie.y) > POV.clearing && trunkAt(H, p, discR)) {
			res.tree = true;
			if (rnd() < 0.3) res.end = { x: p.x + fx * (1 + rnd() * 4) + gx * (rnd() - 0.5) * 5, y: p.y + fy * (1 + rnd() * 4) + gy * (rnd() - 0.5) * 5 };
			else res.end = { x: p.x - fx * (0.5 + rnd() * 2.5) + gx * (rnd() - 0.5) * 4, y: p.y - fy * (0.5 + rnd() * 2.5) + gy * (rnd() - 0.5) * 4 };
			path.push(res.end);
			res.lastIn = isOB(tileAt(H, res.end)) ? lastIn : res.end;
			return finish(res, path);
		}
	}
	var end = path[path.length - 1];
	// skip along the fairway (not hammers or pitch-outs)
	if (tileAt(H, end) === "." && !sw.whiff && !hammer && !pitch) {
		var sk = speed * 0.4 * pf;
		end = { x: end.x + fx * sk + gx * fadeSide * sk * 0.3, y: end.y + fy * sk + gy * fadeSide * sk * 0.3 };
		path.push(end);
		if (!isOB(tileAt(H, end))) lastIn = end;
	}
	// roll downhill on a slope
	var roll = slopeRoll(H, end);
	if (roll) { end = roll; path.push(end); if (!isOB(tileAt(H, end))) lastIn = end; res.rolled = true; }
	res.end = end;
	res.lastIn = lastIn;
	return finish(res, path);
}

// On a real slope, open ground lets the disc roll a few meters downhill
function slopeRoll(H, p) {
	if (!H.def.elev) return null;
	var t = tileAt(H, p);
	if (t !== "." && t !== ",") return null;
	var e = 1, gx = (heightAt(H, { x: p.x + e, y: p.y }) - heightAt(H, { x: p.x - e, y: p.y })) / (2 * e * FT);
	var gy = (heightAt(H, { x: p.x, y: p.y + e }) - heightAt(H, { x: p.x, y: p.y - e })) / (2 * e * FT);
	var g = hyp(gx, gy);
	if (g < 0.08) return null;
	var m = Math.min(5, g * 25) * (t === "," ? 0.5 : 1);
	return { x: p.x - gx / g * m, y: p.y - gy / g * m };
}

function finish(res, path) {
	res.path = path;
	var t = tileAt(S.H, res.end);
	if (!res.inBasket && isOB(t)) { res.ob = true; res.obTile = t; }
	return res;
}

// Animates the disc along its path, leaving a dotted trail
function animate(path) {
	var H = S.H, cells = [], last = null, i;
	for (i = 0; i < path.length; i++) {
		var c = cellOf(H, path[i]);
		if (!last || c.c !== last.c || c.r !== last.r) { cells.push(c); last = c; }
	}
	var frames = clamp(cells.length, 8, 45), ms = Math.round(1500 / frames), prev = null, trail = [];
	for (var f = 1; f <= frames; f++) {
		var c2 = cells[Math.min(cells.length - 1, Math.round(f / frames * (cells.length - 1)))];
		var sb = "";
		if (prev && (prev.c !== c2.c || prev.r !== c2.r) && inMap(prev)) {
			sb += moveTo(MAP_X + prev.c, MAP_Y + prev.r) + text("\xFA", 15);
			trail.push(prev);
		}
		if (inMap(c2)) sb += moveTo(MAP_X + c2.c, MAP_Y + c2.r) + text("\xFE", 15);
		out(sb);
		prev = c2;
		mswait(ms);
	}
	return trail;
}

function lieName(t) {
	if (t === ".") return "in the fairway";
	if (t === ",") return "in the rough";
	if (isTrees(t)) return "in the trees";
	if (t === "S") return "on the tee";
	if (t === "B") return "at the basket";
	return "";
}

function scoreName(strokes, par) {
	if (strokes === 1) return "\x01h\x01yACE!!";
	var d = strokes - par;
	return ["\x01h\x01yAlbatross!", "\x01h\x01yEagle!", "\x01h\x01gBirdie!", "\x01hPar.", "\x01n\x01yBogey.", "\x01n\x01rDouble bogey."][d + 3] || ("\x01n\x01r+" + d + ".");
}

// One full throw. Returns "in" if it went in the basket.
function throwShot() {
	var H = S.H, d = curDisc();
	if (S.view === "pov") povSetAim();
	var sw = swingMeter(R.lag);
	S.strokes++;
	var res = fly(sw);
	// the flight is always shown on the map
	var wasPov = S.view === "pov";
	S.showAim = false;
	if (wasPov) { S.view = "map"; cls(); header(); drawMap(); helpLine(); drawMeter(); panel(); msg(); }
	else { var oldAim = cellOf(H, S.aim); out(drawCell(oldAim.c, oldAim.r)); }
	var fromLie = cellOf(H, S.lie);
	var trail = animate(res.path);
	var start = { x: S.lie.x, y: S.lie.y };
	var dist = hyp(res.end.x - start.x, res.end.y - start.y);
	var how = S.pitch ? "pitch-out" : (S.style === "HM" ? "hammer" : "");
	var line = "\x01h\x01c" + d.name + (how ? " " + how : "") + "\x01n " + (sw.whiff ? "\x01h\x01rshanked\x01n, " : "") + ft(dist) + " ft. ";
	if (sw.over) line = "\x01h\x01rOverswing! \x01n" + line;
	S.pitch = false;
	if (res.inBasket) {
		S.lie = { x: H.basket.x, y: H.basket.y };
		msg(line + "\x01h\x01g" + (S.strokes === 1 ? "IN THE CHAINS - ACE!!" : "IN THE CHAINS!"));
		header();
		waitKey("Press any key");
		return "in";
	}
	if (res.ob) {
		S.strokes++;
		S.lie = res.lastIn || start;
		var where = res.obTile === "R" ? "on the road" : (res.obTile === "P" ? "in the parking lot" : (res.obTile === "W" ? "in the water" : "off the course"));
		line += "\x01h\x01rOB " + where + "!\x01n +1, play from where it went out.";
	} else {
		S.lie = res.end;
		var t = tileAt(H, S.lie);
		if (res.tree) line += "\x01h\x01yTree hit! \x01n";
		if (res.basket) line += "\x01h\x01yOff the cage. \x01n";
		if (res.rolled) line += "Rolled downhill. ";
		line += "Lying " + lieName(t) + ", " + ft(pinDist()) + " ft to go.";
	}
	var sb = "";
	for (var i = 0; i < trail.length; i++) sb += drawCell(trail[i].c, trail[i].r);
	sb += drawCell(fromLie.c, fromLie.r);
	var endC = cellOf(H, res.end);
	sb += drawCell(endC.c, endC.r);
	S.aim = { x: H.basket.x, y: H.basket.y };
	S.showAim = true;
	var lc = cellOf(H, S.lie), ac = cellOf(H, S.aim);
	sb += drawCell(lc.c, lc.r) + drawCell(ac.c, ac.r);
	out(sb);
	msg(line);
	header();
	caddiePick();
	panel();
	if (pinDist() <= PUTT_M) status("\x01hIn putting range.\x01n Press any key to line up your putt.");
	else if (lieInTrees()) status("\x01hIn the trees.\x01n Press any key for your view from the lie.");
	else status("Press any key");
	key();
	return "";
}

// ---- Relief (PDGA optional relief: +1, back along the line of play) -------
function relief() {
	var H = S.H, bx = S.lie.x - H.basket.x, by = S.lie.y - H.basket.y, L = hyp(bx, by) || 1;
	bx /= L; by /= L;
	var step = Math.max(0.5, H.S), back, spots = [];
	for (back = 0; back < 200; back += step) {
		var p = { x: S.lie.x + bx * back, y: S.lie.y + by * back };
		if (!inMap(cellOf(H, p))) break;
		spots.push(p);
	}
	var savedView = S.view;
	S.view = "map";
	S.showAim = false;
	cls();
	header("RELIEF");
	drawMap();
	var s = "", i;
	for (i = 1; i < spots.length; i++) { var c = cellOf(H, spots[i]); s += moveTo(MAP_X + c.c, MAP_Y + c.r) + text("\xFA", 13); }
	out(s);
	msg("\x01h\x01mOptional relief\x01n (PDGA): +1 throw, move back along the line from the basket.");
	helpLine("relief");
	drawMeter();
	var at = Math.min(spots.length - 1, Math.max(1, Math.round(4 / step)));
	function show(prev) {
		if (prev !== undefined && prev > 0) { var pc = cellOf(H, spots[prev]); out(moveTo(MAP_X + pc.c, MAP_Y + pc.r) + text("\xFA", 13)); }
		var sp = spots[at], c2 = cellOf(H, sp), t = tileAt(H, sp);
		out(moveTo(MAP_X + c2.c, MAP_Y + c2.r) + text("\xFE", 13));
		var lines = [
			"\x01n\x01h\x01mRelief  +1 throw",
			"\x01n\x01hBack  \x01n" + ft(at * step) + " ft",
			"\x01n\x01hLie   \x01n" + (isOB(t) ? "\x01h\x01rout of bounds" : lieName(t).replace(/^in the |^on the /, "")),
			"\x01n\x01hPin   \x01n" + ft(hyp(H.basket.x - sp.x, H.basket.y - sp.y)) + " ft",
			"", ""
		];
		showPanel(lines);
		status(isOB(t) ? "\x01h\x01rThat spot is out of bounds." : "Slide to a clear spot, then \x01hENTER");
	}
	if (spots.length < 2) { status("No room to move back here."); key(); S.view = savedView; S.showAim = true; return false; }
	show();
	for (;;) {
		var k = key(), prev = at;
		if (isLeft(k) || isDown(k)) at = Math.min(spots.length - 1, at + 1);
		else if (isRight(k) || isUp(k)) at = Math.max(1, at - 1);
		else if (k === "\r" && !isOB(tileAt(H, spots[at]))) {
			S.strokes++;
			S.lie = spots[at];
			S.aim = { x: H.basket.x, y: H.basket.y };
			S.showAim = true;
			S.pov = null;
			S.view = null;
			msg("\x01h\x01mTook relief.\x01n +1 throw, " + ft(at * step) + " ft back. " + ft(pinDist()) + " ft to go.");
			caddiePick();
			return true;
		}
		else if (k === "\x1b" || k === "r" || k === "R" || k === "q" || k === "Q") { S.view = savedView; S.showAim = true; return false; }
		if (at !== prev) show(prev);
	}
}

// ---- Putting -----------------------------------------------------------------
var PV_BX = 66;                 // basket column in the side view
var PV_GROUND = MAP_Y + 13;     // ground row (flat)
var PV_SCALE = 50 / PUTT_M;     // columns per meter (side view)
var PP_CX = 40;                 // center column of the overhead and player views
var PP_HORIZON = MAP_Y + 5;     // horizon row in the view from the player
var PP_AIM_ROW = MAP_Y + 14;    // aim mark / disc start row in the view from the player
var PUTT_FRAME_MS = 45;         // putt animation frame time
var PT = null;                  // putt state

function puttCol(m) { return Math.max(MAP_X + 2, PV_BX - Math.round(m * PV_SCALE)); }

// Side view ground height (rows) at a column, sloping up to an uphill basket
function sideGround(c) {
	var p0 = PT.p0, rise = PT.rise;
	var k = c <= p0 ? 0 : (c >= PV_BX ? rise : Math.round(rise * (c - p0) / (PV_BX - p0)));
	return PV_GROUND - k;
}

// What the side view shows at a screen cell (also used to repaint behind the disc)
function sideGlyph(c, r) {
	var B = PV_BX, y = r - MAP_Y + PT.rise, gr = sideGround(c);
	if (y === 4 && c >= B - 3 && c <= B + 3) return ["\xDB", 11];
	if ((y === 5 || y === 6) && c >= B - 2 && c <= B + 2) return ["\xB3", 7];
	if (y === 7 && (c === B - 3 || c === B + 3)) return ["\xDB", 3];
	if (y === 7 && c > B - 3 && c < B + 3) return ["\xDC", 3];
	if (y === 8 && c >= B - 2 && c <= B + 2) return ["\xDF", 3];
	if (c === B && r < gr && y >= 9) return ["\xB3", 7];
	if (r === gr) return ["\xDC", 2];
	if (r > gr) return ["\xB0", 2];
	return [" ", 7];
}

// Overhead putting view: the putt line runs up the screen to the basket
var TOP = { cx: PP_CX, cy: MAP_Y + 6, colM: 1.25, rowM: 2.5 };

function topWorld(c, r) {
	var x = (c - TOP.cx) * TOP.colM, y = (r - TOP.cy) * TOP.rowM;   // right, back toward the player
	return { x: S.H.basket.x + PT.rx * x + PT.bx * y, y: S.H.basket.y + PT.ry * x + PT.by * y };
}

function topCell(p) {
	var vx = p.x - S.H.basket.x, vy = p.y - S.H.basket.y;
	return { c: Math.round(TOP.cx + (vx * PT.rx + vy * PT.ry) / TOP.colM), r: Math.round(TOP.cy + (vx * PT.bx + vy * PT.by) / TOP.rowM) };
}

function topGlyph(c, r) {
	var w = topWorld(c, r), d = hyp(w.x - S.H.basket.x, w.y - S.H.basket.y), t = tileAt(S.H, w);
	var g = isTrees(t) ? ["\xE7", 10] : (isOB(t) && t !== "O" ? ["\xB1", 8] : (d < PUTT_M ? ["\xB1", 10] : ["\xB0", 2]));
	if (!isTrees(t)) {
		if (Math.abs(d - C1_M) < 0.8) g = ["\xFA", 15 | 0x20];
		else if (Math.abs(d - PUTT_M) < 1.0) g = ["\xFA", 7 | 0x20];
	}
	if (c === TOP.cx && r === TOP.cy) g = ["\xE8", 11];
	return g;
}

// View from the player: basket ahead, sized by distance
function povPuttArt(d) {
	if (d < 7) return [["\xDC\xDC\xDC\xDC\xDC\xDC\xDC", 11], ["\xDB\xDB\xDB\xDB\xDB\xDB\xDB", 11], ["\xB3\xB3\xB3\xB3\xB3\xB3\xB3", 7], ["\xB3\xB3\xB3\xB3\xB3\xB3\xB3", 7], ["\xDB\xDC\xDC\xDC\xDC\xDC\xDB", 3], [" \xDF\xDF\xDF\xDF\xDF ", 3], ["   \xB3   ", 7], ["   \xB3   ", 7], ["   \xB3   ", 7]];
	if (d < 13) return [["\xDB\xDB\xDB\xDB\xDB", 11], ["\xB3\xB3\xB3\xB3\xB3", 7], ["\xDB\xDC\xDC\xDC\xDB", 3], ["  \xB3  ", 7], ["  \xB3  ", 7]];
	return [["\xDB\xDB\xDB", 11], ["\xB3\xB3\xB3", 7], ["\xDF\xDF\xDF", 3], [" \xB3 ", 7]];
}

function povPuttGlyph(c, r) {
	var hz = PP_HORIZON, g = r >= hz ? ((r - hz) < 3 ? ["\xB0", 2] : ["\xB1", 10]) : [" ", 0x40];
	if (r < hz && ((c * 5 + r * 3) % 11 === 0 || (c > 62 && (c + r) % 3 === 0) || (c < 9 && (c + r) % 2 === 0))) g = ["\xB2", 2 | 0x40];
	var art = PT.art, top = PT.artTop, w = art[0][0].length, left = PP_CX - Math.floor(w / 2);
	if (r >= top && r < top + art.length && c >= left && c < left + w) {
		var ch = art[r - top][0].charAt(c - left);
		if (ch !== " ") g = [ch, art[r - top][1] | (r < hz ? 0x40 : 0)];
	}
	return g;
}

// One scale for everything in the basket view. The basket drawing is as wide as the cage
// (1.1 m, the "off the band" zone), so sideways distances at the basket use that scale, and
// the aim line, the flight and the misses all line up with what you see. Nearer points use
// true perspective (columns by X/Z, rows by 1/Z), so a straight line stays straight.
function povPuttGeom() {
	var P = {}, W = PT.art[0][0].length;
	P.sc = W / 1.1;                                  // columns per meter at the basket
	P.zc = 1.5;                                      // camera this far behind the release
	P.Zb = PT.dist + P.zc;
	P.F = P.sc * P.Zb;
	P.pRow = PP_AIM_ROW;                             // ground at the player
	P.bRow = PT.artTop + PT.art.length;              // ground under the basket
	P.B = (P.pRow - P.bRow) / (1 / P.zc - 1 / P.Zb);
	P.A = P.pRow - P.B / P.zc;
	P.cRow = PT.artTop + (W === 7 ? 2 : 1);          // chains
	P.tRow = PT.artTop + (W === 7 ? 4 : 2);          // tray
	P.hB = (P.bRow - P.cRow) / (P.B / P.Zb / 1.6);   // chain height, in this view's meters
	P.hTop = (P.bRow - PT.artTop + 1) / (P.B / P.Zb / 1.6);
	PT.pv = P;
}

// Screen cell for a point X m right of the line, u of the way to the basket (1 = basket), Y m up
function povProj(X, u, Y) {
	var P = PT.pv, Z = P.zc + PT.dist * u;
	return { c: Math.round(PP_CX + X * P.F / Z), r: Math.round(P.A + P.B / Z - Y * P.B / Z / 1.6) };
}

// Background behind the disc and its trail: sky blue above the horizon, grass green below
function povBg(r) { return r < PP_HORIZON ? 0x40 : 0x20; }

function povOnScreen(p) { return p.c >= MAP_X && p.c < MAP_X + MAP_W && p.r >= MAP_Y && p.r < MAP_Y + MAP_H - 1; }

// Is this cell part of the basket drawing?
function povOnArt(c, r) {
	var art = PT.art, w = art[0][0].length, left = PP_CX - Math.floor(w / 2);
	return r >= PT.artTop && r < PT.artTop + art.length && c >= left && c < left + w && art[r - PT.artTop][0].charAt(c - left) !== " ";
}

// The aim line on the ground, and a + where it reaches the basket at chain height
function povAimLine() {
	var s = "", i, p, last = null;
	for (i = 1; i <= 24; i++) {
		p = povProj(PT.aim * i / 24, i / 24, 0);
		if (!povOnScreen(p) || (last && p.c === last.c && p.r === last.r) || povOnArt(p.c, p.r)) continue;
		s += moveTo(p.c, p.r) + text("\xFA", 13 | povBg(p.r));
		last = p;
	}
	p = povProj(PT.aim, 1, PT.pv.hB);
	if (povOnScreen(p)) s += moveTo(p.c, p.r) + text("+", 13 | (povOnArt(p.c, p.r) ? 0 : povBg(p.r)));
	out(s + setAttr(7));
}

// Paints the whole map area; glyph(c, r) takes screen columns and rows
function paintScene(glyph) {
	var s = "", r, c, g;
	for (r = MAP_Y; r < MAP_Y + MAP_H; r++) { s += moveTo(MAP_X, r); for (c = MAP_X; c < MAP_X + MAP_W; c++) { g = glyph(c, r); s += text(g[0], g[1]); } }
	out(s);
}

function drawPuttScene() {
	if (player.puttView === "top") {
		paintScene(topGlyph);
		var pc = topCell(S.lie);
		out(moveTo(pc.c, pc.r) + text("\xFE", 15));
		put(TOP.cx - 13, TOP.cy - 4, "\x01n\x01k\x01hC1 " + ft(C1_M) + " ft", 0);
		put(TOP.cx + 19, TOP.cy + 6, "\x01n\x01k\x01hC2 " + ft(PUTT_M) + " ft", 0);
		var ac = topCell({ x: S.H.basket.x + PT.rx * PT.aim, y: S.H.basket.y + PT.ry * PT.aim }), ai, ap, al = "";
		for (ai = 1; ai < 16; ai++) {
			ap = topCell(puttWorld(ai / 16, PT.aim * ai / 16));
			if ((ap.c !== pc.c || ap.r !== pc.r) && (ap.c !== TOP.cx || ap.r !== TOP.cy)) al += moveTo(ap.c, ap.r) + text("\xFA", 13);
		}
		out(al + (PT.aim ? moveTo(ac.c, ac.r) + text("+", 13) : "") + setAttr(7));
	} else if (player.puttView === "pov") {
		PT.art = povPuttArt(PT.dist);
		PT.artTop = MAP_Y + 1 + (PT.dist < 7 ? 0 : (PT.dist < 13 ? 2 : 3)) - clamp(Math.round(PT.dz / 3), -1, 2);
		paintScene(povPuttGlyph);
		povPuttGeom();
		povAimLine();
	} else {
		paintScene(sideGlyph);
		put(puttCol(C1_M) - 1, PV_GROUND + 2, "\x01n\x01k\x01hC1", 0);
		put(puttCol(PUTT_M) - 1, PV_GROUND + 2, "\x01n\x01k\x01hC2", 0);
		out(moveTo(PT.p0, sideGround(PT.p0) - 1) + text("\xFE", 15));
	}
	var circle = PT.dist <= C1_M ? "inside Circle 1" : "Circle 2 - jump putt";
	var slope = elevText(PT.dz);
	put(MAP_X + 1, MAP_Y + (player.puttView === "side" ? 1 : 15), "\x01h\x01wPUTT \x01y" + ft(PT.dist) + " ft \x01n" + circle + (slope ? "  \x01h\x01c" + slope : ""), 0, player.puttView === "side" ? 0 : 0x20);
}

function puttWindText() {
	var c = PT.cross;
	if (Math.abs(c) < 0.3) return S.wind.mph ? "Wind " + S.wind.mph + " mph, no drift" : "Calm";
	return "Drift " + (c > 0 ? "right" : "left") + ", " + S.wind.mph + " mph";
}

function aimText() {
	var f = Math.round(PT.aim * FT * 2) / 2;
	return f === 0 ? "center" : Math.abs(f) + " ft " + (f < 0 ? "left" : "right");
}

function puttPanel(d) {
	showPanel([
		"\x01n\x01hPutter \x01c" + d.name,
		"\x01n\x01k\x01h" + fadeText(),
		handLine(),
		"\x01n\x01hAim   \x01n" + aimText(),
		"\x01n\x01k\x01h" + puttWindText(),
		"\x01n\x01h~View  \x01n" + (player.puttView === "top" ? "overhead" : (player.puttView === "pov" ? "from player" : "side"))
	]);
}

// How much the putter fades at the end, in meters (negative = left). Backhand from the
// right hand (or forehand from the left) spins clockwise and fades left; the others fade right.
function puttFade() {
	var dir = ((S.hand === "R") === (S.style !== "FH")) ? -1 : 1;
	return dir * puttDisc().n[3] * 0.06 * clamp(PT.dist / 10, 0.3, 1.5);
}

function fadeText() {
	var f = puttFade(), v = Math.round(Math.abs(f) * FT * 10) / 10;
	return v < 0.1 ? "Flies straight" : "Fades " + (f < 0 ? "left " : "right ") + v + " ft";
}

// Sideways position along the putt (meters right of the straight line), u = 0 at the hand,
// 1 at the basket: aim and timing set the line, wind bends it gradually, fade hooks it late.
// Past the basket it carries on in the direction it was going.
function puttLat(u) {
	var c = PT.comp, a = c.aim + c.timing;
	if (u <= 1) return a * u + c.drift * u * u + c.fade * u * u * u;
	return a + c.drift + c.fade + (a + 2 * c.drift + 3 * c.fade) * (u - 1);
}

// World point u of the way from the player to the basket, lat m to the player's right
function puttWorld(u, lat) {
	return { x: S.H.basket.x + PT.bx * PT.dist * (1 - u) + PT.rx * lat, y: S.H.basket.y + PT.by * PT.dist * (1 - u) + PT.ry * lat };
}

// Putting meter ticks every 10 ft; full power (66 ft) at the white mark
function puttMarks() {
	var full = ft(PUTT_M), m = [];
	for (var f = 10; f < full - 8; f += 10) m.push([f / full * 100, String(f)]);
	m.push([100, full + " ft"]);
	return m;
}

function drawPuttScreen() {
	var d = puttDisc();
	cls();
	header("PUTT " + ft(PT.dist) + " FT");
	drawPuttScene();
	msg();
	helpLine("putt");
	drawMeter(puttMarks(), ft(PT.dist) / ft(PUTT_M) * 100);
	puttPanel(d);
}

// A trail dot left behind the disc in the basket view
function povTrailDot(q) { return moveTo(q.c, q.r) + text("\xFA", 7 | (povOnArt(q.c, q.r) ? 0 : povBg(q.r))); }

// Animates a putt. kind: made, cage, short, over or miss. along: where it ends, meters short of
// the basket (negative = past it); lat: meters right of the line where it ends.
// The disc leaves a dotted trail, so the whole path stays on screen next to the basket.
function puttFlight(kind, along, lat) {
	var made = kind === "made", uEnd = 1 - along / Math.max(PT.dist, 0.5), pts = [], i, n, u, p;
	if (player.puttView === "pov") {
		var P = PT.pv, Y0 = 0.9, arc = PT.dist > 10 ? 0.5 : 0.2;
		var Yb = kind === "over" ? P.hTop + 0.6 : P.hB;
		var uTo = kind === "short" ? uEnd : 1;
		n = 22;
		for (i = 1; i <= n; i++) {
			u = uTo * i / n;
			var Y = kind === "short" ? Y0 * (1 - i / n) + arc * Math.sin(i / n * Math.PI) : Y0 + (Yb - Y0) * i / n + arc * Math.sin(i / n * Math.PI);
			pts.push({ p: povProj(puttLat(u), u, Y), u: u });
		}
		if (made) pts.push({ p: { c: pts[pts.length - 1].p.c, r: P.tRow }, u: 1 });
		else if (kind === "cage") {
			for (i = 1; i <= 6; i++) { u = 1 + (uEnd - 1) * i / 6; pts.push({ p: povProj(lat, u, P.hB * (1 - i / 6)), u: u }); }
		} else if (kind !== "short") {
			for (i = 1; i <= 8; i++) { u = 1 + (uEnd - 1) * i / 8; pts.push({ p: povProj(puttLat(u), u, Yb * (1 - i / 8)), u: u }); }
		}
		// Behind the basket (past it) the drawing covers the disc; in front, the disc covers the drawing.
		var prev = null, prevU = 0, s, hidden = false;
		for (i = 0; i < pts.length; i++) {
			p = pts[i].p;
			if (!povOnScreen(p) || (prev && prev.c === p.c && prev.r === p.r)) continue;
			hidden = pts[i].u > 1.02 && povOnArt(p.c, p.r);
			s = prev ? povTrailDot(prev) : "";
			if (!hidden) s += moveTo(p.c, p.r) + text(pts[i].u < 0.55 ? "\xFE" : "\xF9", 15 | (povOnArt(p.c, p.r) ? 0 : povBg(p.r)));
			out(s);
			prev = hidden ? null : p; prevU = pts[i].u;
			mswait(PUTT_FRAME_MS);
		}
		if (prev) out(moveTo(prev.c, prev.r) + text(prevU < 0.55 || made ? "\xFE" : "\xF9", 15 | (povOnArt(prev.c, prev.r) ? 0 : povBg(prev.r))));
		out(setAttr(7));
		return;
	}
	if (player.puttView === "top") {
		n = 16;
		var uMain = kind === "short" ? uEnd : 1;
		for (i = 1; i <= n; i++) { u = uMain * i / n; pts.push(topCell(puttWorld(u, made ? puttLat(u) * (1 - i / n) : puttLat(u)))); }
		if (kind === "cage") pts.push(topCell(puttWorld(uEnd, lat)));
		else if (!made && kind !== "short") for (i = 1; i <= 5; i++) { u = 1 + (uEnd - 1) * i / 5; pts.push(topCell(puttWorld(u, puttLat(u)))); }
		var pv = topCell(S.lie), st;
		// trail dots on the overhead view keep the grass behind them
		for (i = 0; i < pts.length; i++) {
			p = pts[i];
			if (p.c === pv.c && p.r === pv.r) continue;
			st = moveTo(pv.c, pv.r) + ((pv.c === TOP.cx && pv.r === TOP.cy) ? text("\xE8", 11) : text("\xFA", 15 | 0x20));
			out(st + moveTo(p.c, p.r) + text("\xFE", 15));
			pv = p;
			mswait(PUTT_FRAME_MS);
		}
		return;
	}
	var cA = PT.p0, cB = made ? PV_BX : (along >= 0 ? puttCol(along) : Math.min(MAP_X + MAP_W - 2, PV_BX + Math.round(-along * PV_SCALE)));
	var prev3 = null, c, r;
	out(moveTo(cA, sideGround(cA) - 1) + text(sideGlyph(cA, sideGround(cA) - 1)[0], sideGlyph(cA, sideGround(cA) - 1)[1]));
	n = 14;
	for (i = 1; i <= n; i++) {
		u = i / n; c = Math.round(cA + (cB - cA) * u);
		var gnd = sideGround(c) - 1, chain = MAP_Y + 5 - PT.rise;
		r = made ? Math.round(gnd + (chain - gnd) * Math.sin(u * Math.PI / 2)) : gnd - Math.round(Math.sin(u * Math.PI) * (kind === "over" ? 7 : 5));
		var sb3 = prev3 ? moveTo(prev3.c, prev3.r) + (sideGlyph(prev3.c, prev3.r)[0] === " " ? text("\xFA", 8) : text(sideGlyph(prev3.c, prev3.r)[0], sideGlyph(prev3.c, prev3.r)[1])) : "";
		prev3 = { c: c, r: r };
		out(sb3 + moveTo(c, r) + text("\xFE", 15));
		mswait(PUTT_FRAME_MS);
	}
	if (made) out(moveTo(prev3.c, prev3.r) + text(sideGlyph(prev3.c, prev3.r)[0], sideGlyph(prev3.c, prev3.r)[1]) + moveTo(PV_BX, MAP_Y + 7 - PT.rise) + text("\xFE", 15));
}

// Why a putt missed, from the parts that moved it off line (or from the power)
function puttWhy(kind, need, thrown, over) {
	if (kind === "short") return "Needed " + ft(need) + " ft, the putt went " + ft(thrown) + ".";
	if (kind === "over") return "Too hard: about " + ft(over) + " ft more than it needed.";
	if (kind === "spit") return "Too much speed for the chains (" + ft(over) + " ft extra).";
	var c = PT.comp, parts = [["aim", c.aim], ["timing", c.timing], ["fade", c.fade], ["wind", c.drift]], list = [], i, v;
	for (i = 0; i < parts.length; i++) {
		v = Math.round(Math.abs(parts[i][1]) * FT * 10) / 10;
		if (v >= 0.1) list.push(parts[i][0] + " " + v + (parts[i][1] < 0 ? " L" : " R"));
	}
	return list.join(", ");
}

// Sets up the putt from the current lie
function puttSetup() {
	var H = S.H, dist = pinDist();
	var bx = (S.lie.x - H.basket.x) / (dist || 1), by = (S.lie.y - H.basket.y) / (dist || 1);
	var dz = heightAt(H, H.basket) - heightAt(H, S.lie);
	// bx,by: from the basket back toward the player; rx,ry: the player's right
	PT = { dist: dist, bx: bx, by: by, rx: by, ry: -bx, dz: dz, rise: clamp(Math.round(dz / 2), -2, 4), p0: puttCol(dist), aim: 0 };
	PT.cross = S.wind.x * PT.rx + S.wind.y * PT.ry;
}

// One putt. Returns true when it's in, null to quit the round.
function putt() {
	var H = S.H, d = puttDisc();
	puttSetup();
	drawPuttScreen();
	if (PT.dist < 1.2) {
		status("Tap-in range. \x01hSPACE\x01n to drop it in.");
		for (;;) { var k0 = key(); if (k0 === " ") break; }
		PT.comp = { aim: 0, timing: 0, drift: 0, fade: 0 };
		puttFlight("made", 0, 0);
		S.strokes++;
		msg("\x01h\x01gDrop-in.");
		return true;
	}
	status("\x01hSPACE\x01n to start your putt");
	for (;;) {
		var k = key(), ku = k.toUpperCase();
		if (ku === "H") { S.hand = cycle(HANDS, S.hand); puttPanel(d); continue; }
		if (ku === "V") { player.puttView = cycle(PUTT_VIEWS, player.puttView); drawPuttScreen(); status("\x01hSPACE\x01n to start your putt"); continue; }
		if (ku === "S") { scorecard(S.H.num - 1, false); drawPuttScreen(); status("\x01hSPACE\x01n to start your putt"); continue; }
		if (isLeft(k) || isRight(k)) {
			PT.aim = clamp(PT.aim + (isLeft(k) ? -0.15 : 0.15), -3, 3);
			puttPanel(d);
			if (player.puttView !== "side") { drawPuttScene(); }
			continue;
		}
		if (ku === "Q") { if (confirmQuit("\x01hSPACE\x01n to start your putt")) return null; continue; }
		if (k === " ") break;
	}
	var sw = swingMeter(R.lag);
	S.strokes++;
	var dom = domHand(), accMul = (dom ? 1 : OFF_ACC) * (sw.over ? OVER_ACC : 1);
	var need = PT.dist + PT.dz / FT;                          // uphill plays longer
	var thrown = (sw.power / 100) * PUTT_M * (sw.whiff ? 0.6 : 1);
	var over = thrown - need;
	var err = sw.whiff ? (rnd() - 0.5) * 0.4 : sw.accuracy * 0.03 * accMul + (rnd() - 0.5) * 0.01;
	PT.comp = { aim: PT.aim, timing: Math.sin(err) * PT.dist, drift: PT.cross * PT.dist * 0.025, fade: puttFade() };
	var lateral = puttLat(1);                                 // meters right of the basket
	var made = false, line, kind;
	if (over < -0.15) { line = "\x01n\x01yShort."; kind = "short"; }
	else if (Math.abs(lateral) <= 0.35 && over <= 6) {
		var spit = over <= 1.5 ? 0.04 : 0.04 + (over - 1.5) * 0.08;
		if (rnd() < spit) { line = "\x01h\x01rSpit out of the chains!"; kind = "spit"; }
		else { made = true; line = "\x01h\x01gCHAINS!"; kind = "made"; }
	} else if (Math.abs(lateral) <= 0.55 && over <= 6) {
		if (rnd() < 0.35) { made = true; line = "\x01h\x01gOff the band and in!"; kind = "made"; }
		else { line = "\x01n\x01yHits the cage."; kind = "cage"; }
	} else if (over > 6) { line = "\x01n\x01ySailed over the basket."; kind = "over"; }
	else { line = "\x01n\x01yMissed " + (lateral < 0 ? "left." : "right."); kind = "miss"; }

	// where the disc ends up: meters short of the basket (negative = past it)
	var along;
	if (made) along = 0;
	else if (over < -0.15) along = -over;
	else if (kind === "cage") along = 0.3 + rnd() * 1.2;
	else along = -Math.min(Math.max(over, 1), 8) * 0.6;
	if (!made && along < 0 && PT.dz < -2) along -= 1 + rnd() * 2;   // past a downhill basket it rolls away
	var endLat = made ? 0 : (kind === "cage" ? lateral : puttLat(1 - along / Math.max(PT.dist, 0.5)));
	puttFlight(kind === "spit" ? "miss" : kind, along, endLat);
	if (!made) S.lie = { x: H.basket.x + PT.bx * along + PT.rx * endLat, y: H.basket.y + PT.by * along + PT.ry * endLat };
	msg(line + (made ? "" : "\x01n  " + ft(pinDist()) + " ft away.  \x01k\x01h" + puttWhy(kind, need, thrown, over)));
	waitKey("Press any key");
	return made;
}

// ---- Playing a hole --------------------------------------------------------
function playHole(idx) {
	var H = R.holes[idx];
	S = {
		H: H, lie: { x: H.tee.x, y: H.tee.y }, aim: { x: H.basket.x, y: H.basket.y },
		strokes: 0, disc: 0, hand: S ? S.hand : player.hand, style: S ? (S.style === "HM" ? player.style : S.style) : player.style,
		angle: "F", wind: newWind(), showAim: true, pitch: false, view: null, pov: null, lastMsg: ""
	};
	PT = null;
	caddiePick();
	S.lastMsg = "\x01n" + H.def.note;
	var needDraw = true;

	for (;;) {
		if (pinDist() <= PUTT_M) {
			var made = putt();
			if (made === null) return null;
			if (made) return S.strokes;
			if (pinDist() <= PUTT_M) continue;
			S.aim = { x: H.basket.x, y: H.basket.y };
			S.view = null; S.pov = null;
			needDraw = true;
			continue;
		}
		if (needDraw) {
			if (!S.view) { S.view = lieInTrees() ? "pov" : "map"; S.pov = null; }
			if (S.view === "pov" && S.lastMsg.indexOf("trees") < 0 && !S.pov)
				S.lastMsg = S.lastMsg ? S.lastMsg + " \x01n\x01yIn the trees." : "\x01n\x01yIn the trees.\x01n Find a gap, hammer, pitch out or take relief.";
			drawShotScreen();
			needDraw = false;
		}
		var k = key(), ku = k.toUpperCase(), oldAim = { x: S.aim.x, y: S.aim.y };
		if (k === " ") {
			var r = throwShot();
			if (r === "in") return S.strokes;
			S.view = null; S.pov = null;
			needDraw = true;
			continue;
		}
		if (ku >= "1" && ku <= "9" && Number(ku) <= bagDiscs().length) S.disc = Number(ku) - 1;
		else if (ku === "D") S.disc = (S.disc + 1) % bagDiscs().length;
		else if (ku === "T") S.style = cycle(STYLES, S.style);
		else if (ku === "H") S.hand = cycle(HANDS, S.hand);
		else if (ku === "A") S.angle = cycle(ANGLES, S.angle);
		else if (ku === "P") S.pitch = !S.pitch;
		else if (ku === "V") {
			if (S.view === "pov") { S.view = "map"; povSetAim(); }
			else { S.view = "pov"; povStart(); }
			needDraw = true;
			continue;
		}
		else if (ku === "R") { relief(); needDraw = true; continue; }
		else if (ku === "S") { scorecard(idx, false); needDraw = true; continue; }
		else if (ku === "Q") { if (confirmQuit("\x01hSPACE\x01n to throw")) return null; continue; }
		else if (S.view === "pov" && (isLeft(k) || isRight(k))) { povTurn(isLeft(k) ? -1 : 1); panel(); continue; }
		else if (S.view !== "pov" && (isLeft(k) || isRight(k) || isUp(k) || isDown(k))) {
			if (isLeft(k)) S.aim.x -= H.S;
			else if (isRight(k)) S.aim.x += H.S;
			else if (isUp(k)) S.aim.y -= 2 * H.S;
			else S.aim.y += 2 * H.S;
			S.aim.x = clamp(S.aim.x, 0, (MAP_W - 1) * H.S);
			S.aim.y = clamp(S.aim.y, 0, (MAP_H - 1) * 2 * H.S);
			var a0 = cellOf(H, oldAim), a1 = cellOf(H, S.aim);
			if (a0.c !== a1.c || a0.r !== a1.r) out(drawCell(a0.c, a0.r) + drawCell(a1.c, a1.r));
		}
		else continue;
		panel();
	}
}

// Asks before quitting the round. If not, puts the status line back to back.
function confirmQuit(back) {
	status("Quit this round? \x01hY\x01n/N");
	if (key().toUpperCase() === "Y") return true;
	status(back);
	return false;
}

// ---- Scorecard ----------------------------------------------------------------
function scorecard(cur, final) {
	cls();
	var n = R.holes.length, i, tot = 0, par = 0;
	put(3, 2, "\x01h\x01w" + R.course.name.toUpperCase() + "  \x01n\x01k\x01h" + R.course.where, 76);
	put(3, 3, "\x01n\x01k\x01h" + (final ? "Final scorecard" : "Scorecard"), 76);
	var rows = [["HOLE", "\x01h"], ["FEET", "\x01n\x01k\x01h"], ["PAR", "\x01n"], [user.alias || "YOU", "\x01h\x01c"]];
	for (var r = 0; r < rows.length; r++) {
		var line = rows[r][1] + pad(rows[r][0].substr(0, 8), 9);
		for (i = 0; i < n; i++) {
			var v;
			if (r === 0) v = String(i + 1);
			else if (r === 1) v = String(R.holes[i].ft);
			else if (r === 2) v = String(R.holes[i].par);
			else {
				var st = R.strokes[i];
				if (!st) v = i === cur ? "\x01n\x01k\x01h.." : "";
				else {
					var dd = st - R.holes[i].par;
					v = (dd < 0 ? "\x01h\x01g" : (dd > 0 ? "\x01n\x01r" : "\x01h\x01w")) + st;
				}
			}
			var vis = v.replace(/\x01./g, "");
			line += blank(5 - vis.length) + v + rows[r][1];
		}
		if (r === 2) for (i = 0, par = 0; i < n; i++) par += R.holes[i].par;
		if (r === 3) for (i = 0, tot = 0; i < n; i++) tot += R.strokes[i] || 0;
		var tv = r === 0 ? "TOT" : (r === 1 ? String(sumFt()) : (r === 2 ? String(par) : (tot ? String(tot) : "")));
		line += "  " + blank(5 - tv.length) + tv;
		put(3, 6 + r * 2, line, 77);
	}
	var rel = roundToPar();
	put(3, 15, "\x01h\x01wTo par: " + (rel === 0 ? "E" : (rel > 0 ? "\x01r+" + rel : "\x01g" + rel)), 60);
	waitKey(final ? "Press any key to return to the clubhouse" : "Press any key to keep playing");
}

function sumFt() { var t = 0; for (var i = 0; i < R.holes.length; i++) t += R.holes[i].ft; return t; }

// ---- Round ---------------------------------------------------------------------
function playRound(course) {
	cls();
	put(3, 3, "\x01h\x01w" + course.name + "\x01n  " + course.where);
	put(3, 5, "\x01nMeasuring your connection...");
	var lag = measureLag();
	put(3, 5, "\x01nLag compensation: " + Math.round(lag * 1000) + " ms", 60);
	R = { course: course, holes: [], strokes: [], lag: lag };
	S = null;
	for (var i = 0; i < course.holes.length; i++) { R.holes.push(buildHole(course.holes[i], i)); R.strokes.push(0); }
	mswait(600);
	for (i = 0; i < R.holes.length; i++) {
		var st = playHole(i);
		if (st === null) return;
		R.strokes[i] = st;
		msg(scoreName(st, R.holes[i].par) + "\x01n  " + st + " on a par " + R.holes[i].par + ".");
		waitKey("Press any key for the scorecard");
		scorecard(i + 1 < R.holes.length ? i + 1 : -1, i + 1 === R.holes.length);
	}
}

// ---- Menus ---------------------------------------------------------------------
var BIG = {
	D: ["#### ", "#   #", "#   #", "#   #", "#### "],
	I: ["###", " # ", " # ", " # ", "###"],
	S: [" ####", "#    ", " ### ", "    #", "#### "],
	C: [" ####", "#    ", "#    ", "#    ", " ####"],
	G: [" ####", "#    ", "#  ##", "#   #", " ####"],
	O: [" ### ", "#   #", "#   #", "#   #", " ### "],
	L: ["#    ", "#    ", "#    ", "#    ", "#####"],
	F: ["#####", "#    ", "#### ", "#    ", "#    "],
	" ": ["   ", "   ", "   ", "   ", "   "]
};

function bigText(str, x, y, colors) {
	for (var r = 0; r < 5; r++) {
		var s = moveTo(x, y + r), ci = 0;
		for (var i = 0; i < str.length; i++) {
			var g = BIG[str.charAt(i)];
			if (str.charAt(i) === " ") ci++;
			s += text(g[r].replace(/#/g, "\xDB") + " ", colors[ci]);
		}
		out(s);
	}
}

function titleScreen() {
	cls();
	bigText("DISC GOLF", 17, 2, [14, 11]);
	put(17, 8, "\x01n\x01k\x01h" + new Array(47).join("\xC4"));
	put(17, 9, "\x01nA 3-click swing meter disc golf door");
	put(17, 11, "\x01hCourse  \x01n" + COURSES[0].name + " \x01k\x01h- " + COURSES[0].where);
	put(17, 12, "\x01hPlayer  \x01n" + handName(player.hand) + "-handed, " + styleName(player.style).toLowerCase() + " thrower");
	var items = ["~Play " + COURSES[0].name + " (" + COURSES[0].holes.length + " holes)", "Player ~setup", "Your ~bag & disc catalog", "~How to play", "~Quit"];
	for (var i = 0; i < items.length; i++) put(19, 14 + i, "\x01n" + items[i]);
	put(19, 20, "\x01n\x01k\x01hChoose: ");
	return key().toUpperCase();
}

function setup(first) {
	cls();
	put(3, 2, "\x01h\x01wPLAYER SETUP");
	if (first) put(3, 3, "\x01n\x01k\x01hA few questions before you head to the first tee.");
	put(3, 5, "\x01nWhich hand do you throw with?   ~Right   ~Left");
	for (;;) { var k = key().toUpperCase(); if (k === "R" || k === "L") { player.hand = k; break; } if (k === "\r" && !first) break; }
	put(3, 6, "\x01h\x01c  " + handName(player.hand) + "-handed.\x01n \x01k\x01hYour other hand has about " + Math.round(OFF_HAND * 100) + "% of the power, less accuracy.", 76);
	put(3, 8, "\x01nYour usual throw?   ~Backhand   ~Forehand (sidearm)");
	for (;;) { var k2 = key().toUpperCase(); if (k2 === "B" || k2 === "F") { player.style = k2 === "B" ? "BH" : "FH"; break; } if (k2 === "\r" && !first) break; }
	put(3, 9, "\x01h\x01c  " + styleName(player.style) + ".\x01n \x01k\x01hOn any shot, H switches hands and T cycles BH/FH/hammer.", 76);
	var spin = (player.hand === "R") === (player.style === "BH");
	put(3, 10, "\x01n  Your " + styleName(player.style).toLowerCase() + " fades to the \x01h" + (spin ? "left" : "right") + "\x01n and turns over to the \x01h" + (spin ? "right" : "left") + "\x01n.");
	waitKey("Press any key");
}

function bagScreen() {
	var sel = 0, top = 0, ROWS = 17;
	for (;;) {
		cls();
		put(3, 1, "\x01h\x01wYOUR BAG & DISC CATALOG  \x01n\x01k\x01h(" + player.bag.length + " of " + BAG_MAX + " slots)", 77);
		put(3, 2, "\x01n\x01k\x01h   DISC          MAKER          TYPE       SPEED GLIDE TURN FADE", 77);
		if (sel < top) top = sel;
		if (sel >= top + ROWS) top = sel - ROWS + 1;
		for (var i = top; i < Math.min(DISCS.length, top + ROWS); i++) {
			var d = DISCS[i], inBag = player.bag.indexOf(d.name) >= 0;
			var line = (inBag ? "\x01h\x01g\xFE " : "\x01n\x01k\x01h\xFA ") + (i === sel ? "\x01h\x01w" : "\x01n") +
				pad(d.name, 14) + pad(d.maker, 15) + pad(TYPE_NAME[d.type], 11) +
				pad(String(d.n[0]), 6) + pad(String(d.n[1]), 6) + pad(String(d.n[2]), 5) + d.n[3];
			put(3, 3 + i - top, (i === sel ? "\x01h\x01c>" : " ") + line, 77);
		}
		put(3, 21, "\x01n\x01k\x01hSpeed = how hard it must be thrown. Glide = how long it floats.", 77);
		put(3, 22, "\x01n\x01k\x01hTurn = drift right early (for RH backhand; negative turns more). Fade = hook left at the end.", 77);
		put(3, 24, "\x01h\x01cUp/Down\x01n move  \x01h\x01cSPACE\x01n add/remove  ~Quit", 77);
		var k = key(), ku = k.toUpperCase();
		if (isUp(k)) sel = Math.max(0, sel - 1);
		else if (isDown(k)) sel = Math.min(DISCS.length - 1, sel + 1);
		else if (k === " " || k === "\r") {
			var nm = DISCS[sel].name, at = player.bag.indexOf(nm);
			if (at >= 0) { if (player.bag.length > 1) player.bag.splice(at, 1); }
			else if (player.bag.length < BAG_MAX) player.bag.push(nm);
			bagChanged();
		}
		else if (ku === "Q" || k === "\x1b") return;
	}
}

function howTo() {
	cls();
	var L = [
		"\x01h\x01wHOW TO PLAY",
		"\x01h\x01cThe meter\x01n   SPACE starts your reach-back. SPACE again sets power: the white",
		"            mark is 100%. Past it you overswing - the disc turns over and",
		"            power drops. SPACE a third time as the marker comes back through",
		"            the yellow: early pulls toward your fade side, late pushes the other way.",
		"\x01h\x01cDiscs\x01n       1-8 or ~D picks a disc. Fast discs fly far but need arm speed.",
		"\x01h\x01cThrows\x01n      ~T cycles backhand, forehand and hammer. A hammer flies over the",
		"            trees and comes down hard; it goes about two-thirds as far.",
		"\x01h\x01cHand\x01n        ~H switches hands. Your off hand has less power and accuracy.",
		"\x01h\x01cAngle\x01n       ~A cycles flat, hyzer and anhyzer.",
		"\x01h\x01cTrees\x01n       In the trees you see the view from your lie. Left/Right picks a",
		"            line; the panel shows how wide the gap is. ~Pitch-out is a short,",
		"            safe throw back to the fairway. ~Relief (PDGA optional relief):",
		"            +1 throw, move back along the line from the basket.",
		"\x01h\x01cView\x01n        ~V switches between the map and the view from your lie.",
		"\x01h\x01cPutting\x01n     Inside " + ft(PUTT_M) + " ft you putt. ~V cycles side, overhead and from-the-",
		"            player views. Left/Right aims off the basket to play the wind.",
		"            The meter is marked in feet; the small \x01h\x01y\xE8\x01n on it is the basket.",
		"\x01h\x01cHills\x01n       Downhill throws fly farther; uphill putts need more power.",
		"",
		"\x01n\x01k\x01hMap: \x01h\x01g\xB1\x01n\x01k\x01h fairway  \x01n\x01g\xB0\x01k\x01h rough  \x01h\x01g\xE7\x01n\x01k\x01h tree  \x01h\x01k\xB1\x01n\x01k\x01h road (OB)  \x01n\xB0\x01k\x01h parking (OB)  \x01h\x01y\xE8\x01n\x01k\x01h basket  \x01h\x01w\xFE\x01n\x01k\x01h you"
	];
	for (var i = 0; i < L.length; i++) put(3, 2 + i, L[i], 77);
	waitKey("Press any key");
}

// ---- Main ----------------------------------------------------------------------
console.write("\x1b[?25l");
try {
	setup(true);
	for (;;) {
		if (!bbs.online || js.terminated) break;
		var choice = titleScreen();
		if (choice === "P") playRound(COURSES[0]);
		else if (choice === "S") setup(false);
		else if (choice === "B") bagScreen();
		else if (choice === "H") howTo();
		else if (choice === "Q") break;
	}
} finally {
	console.write("\x1b[0m\x1b[?25h\x1b[2J\x1b[H");
}
