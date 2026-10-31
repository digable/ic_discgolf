// discgolf.js: The overhead hole map.
// Loaded by ../discgolf.js. ES5 for Synchronet (no let/const/arrows).

"use strict";

// ---- Overhead map ----------------------------------------------------------
var RANGE_MARK = 14 | BLINK;            // where the disc lands at 100% power: bright cyan, blinking
var RANGE_PAST = 6 | BLINK;             // it flies off the map: dim cyan at the map's edge
var PATH_DOT = ["\xFA", 14];            // the flight to the range mark, on every other open cell
var PATH_HIT = 15 | 0x10;               // a tree or hazard on that line: white on red
var NO_MARKS = { rc: null, path: {} };

// lc: the lie's cell, ac: the aim's cell, m: the range mark and path (see rangeMarks)
function cellGlyph(c, r, lc, ac, m) {
	var t = S.H.grid[r][c], rc = m.rc, p = m.path[c + "," + r];
	if (c === lc.c && r === lc.r) return ["\xFE", 15];
	if (ac && c === ac.c && r === ac.r) return t === "B" ? ["\xE8", 11 | 0x50] : ["+", 13];
	if (rc && c === rc.c && r === rc.r) return ["\xE9", (rc.past ? RANGE_PAST : RANGE_MARK) | terrainBg(t)];
	if (p !== undefined) {
		if (t === "." || t === ",") { if (p % 2 === 0) return PATH_DOT; }
		else if (t !== "S" && t !== "B") return [(GLYPH[t] || [" "])[0], PATH_HIT];
	}
	return GLYPH[t] || [" ", 7];
}

// The terrain's color as a background, so a blinking mark's off phase shows the ground it sits on
// (green fairway, blue water...) instead of black. Backgrounds can't be bright: 10 becomes 2.
function terrainBg(t) {
	var a = (GLYPH[t] || [" ", 7])[1];
	return (a & 0x70) || ((a & 7) << 4);
}

function aimCell() { return S.showAim ? cellOf(S.H, S.aim) : null; }

// The range mark and the flight to it: where the current disc goes on a perfect, flat 100%
// throw. Only the disc's flight numbers shape it (plus the hand and throw, which set which way
// it curves, and a pitch-out's power cap). No wind, release angle, terrain, trees, skips or rolls.
// Returns { rc: the mark's cell (past: it flies off the map), path: "c,r" -> order along the flight }.
function rangeMarks() {
	if (!S.showAim || S.view === "pov") return NO_MARKS;
	var sh = throwShape(1, false), step = S.H.S / 2 / sh.dist, lc = cellOf(S.H, S.lie);
	var cells = [], seen = {}, off = false, m = { rc: null, path: {} }, c, k, i, n = 0;
	for (var u = step; u < 1; u += step) {
		c = cellOf(S.H, idealPoint(sh, u));
		if (!inMap(c)) { off = true; break; }
		k = c.c + "," + c.r;
		if (!seen[k]) { seen[k] = true; cells.push(c); }
	}
	c = cellOf(S.H, idealPoint(sh, 1));
	if (!off && inMap(c)) m.rc = c;
	else if (cells.length) { m.rc = cells.pop(); m.rc.past = true; }   // past the edge: the last cell on the map
	for (i = 0; i < cells.length && player.flightPath; i++) {
		c = cells[i];
		if ((c.c === lc.c && c.r === lc.r) || (m.rc && c.c === m.rc.c && c.r === m.rc.r)) continue;
		m.path[c.c + "," + c.r] = n++;
	}
	return m;
}

function drawCell(c, r) {
	if (c < 0 || c >= MAP_W || r < 0 || r >= MAP_H) return "";
	var g = cellGlyph(c, r, cellOf(S.H, S.lie), aimCell(), S.marks || NO_MARKS);
	return moveTo(MAP_X + c, MAP_Y + r) + text(g[0], g[1]);
}

function drawMap() {
	S.marks = rangeMarks();
	var s = "", lc = cellOf(S.H, S.lie), ac = aimCell(), m = S.marks;
	for (var r = 0; r < MAP_H; r++) {
		s += moveTo(MAP_X, MAP_Y + r);
		for (var c = 0; c < MAP_W; c++) { var g = cellGlyph(c, r, lc, ac, m); s += text(g[0], g[1]); }
	}
	out(s);
}

// Moves the range mark and path after a disc, throw, hand, pitch or aim change. Only cells
// whose look changed are redrawn.
function updateRangeMark() {
	var old = S.marks || NO_MARKS, nw = rangeMarks(), lc = cellOf(S.H, S.lie), ac = aimCell();
	var keys = {}, s = "", k;
	S.marks = nw;
	for (k in old.path) keys[k] = true;
	for (k in nw.path) keys[k] = true;
	if (old.rc) keys[old.rc.c + "," + old.rc.r] = true;
	if (nw.rc) keys[nw.rc.c + "," + nw.rc.r] = true;
	for (k in keys) {
		var p = k.split(","), c = Number(p[0]), r = Number(p[1]);
		var a = cellGlyph(c, r, lc, ac, old), b = cellGlyph(c, r, lc, ac, nw);
		if (a[0] !== b[0] || a[1] !== b[1]) s += drawCell(c, r);
	}
	out(s);
}
