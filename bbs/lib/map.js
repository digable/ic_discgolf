// discgolf.js: The overhead hole map.
// Loaded by ../discgolf.js. ES5 for Synchronet (no let/const/arrows).

"use strict";

// ---- Overhead map ----------------------------------------------------------
var RANGE_MARK = ["\xE9", 14];      // where the disc lands at 100% power: bright cyan
var RANGE_PAST = ["\xE9", 6];       // it flies off the map: dim cyan at the map's edge

// lc: the lie's cell, ac: the aim's cell, rc: the range mark's cell (null when not shown)
function cellGlyph(c, r, lc, ac, rc) {
	if (c === lc.c && r === lc.r) return ["\xFE", 15];
	if (ac && c === ac.c && r === ac.r) return S.H.grid[r][c] === "B" ? ["\xE8", 11 | 0x50] : ["+", 13];
	if (rc && c === rc.c && r === rc.r) return rc.past ? RANGE_PAST : RANGE_MARK;
	return GLYPH[S.H.grid[r][c]] || [" ", 7];
}

function aimCell() { return S.showAim ? cellOf(S.H, S.aim) : null; }

// The range mark: where the current disc lands on a perfect, flat 100% throw. Only the disc's
// flight numbers shape it (plus the hand and throw, which set which way it curves, and a
// pitch-out's power cap). No wind, release angle, terrain, trees, skips or rolls.
function rangeCell() {
	if (!S.showAim || S.view === "pov") return null;
	var sh = throwShape(1, false);
	var rc = cellOf(S.H, idealPoint(sh, 1));
	if (inMap(rc)) return rc;
	// Past the edge: step back along the flight to the last cell on the map
	var step = S.H.S / 2 / sh.dist;
	for (var u = 1 - step; u > 0; u -= step) {
		rc = cellOf(S.H, idealPoint(sh, u));
		if (inMap(rc)) { rc.past = true; return rc; }
	}
	return null;
}

function drawCell(c, r) {
	if (c < 0 || c >= MAP_W || r < 0 || r >= MAP_H) return "";
	var g = cellGlyph(c, r, cellOf(S.H, S.lie), aimCell(), S.rangeCell);
	return moveTo(MAP_X + c, MAP_Y + r) + text(g[0], g[1]);
}

function drawMap() {
	S.rangeCell = rangeCell();
	var s = "", lc = cellOf(S.H, S.lie), ac = aimCell(), rc = S.rangeCell;
	for (var r = 0; r < MAP_H; r++) {
		s += moveTo(MAP_X, MAP_Y + r);
		for (var c = 0; c < MAP_W; c++) { var g = cellGlyph(c, r, lc, ac, rc); s += text(g[0], g[1]); }
	}
	out(s);
}

// Moves the range mark after a disc, throw, hand, pitch or aim change (redraws just two cells)
function updateRangeMark() {
	var old = S.rangeCell, nw = rangeCell();
	if (old && nw && old.c === nw.c && old.r === nw.r && old.past === nw.past) return;
	S.rangeCell = nw;
	out((old ? drawCell(old.c, old.r) : "") + (nw ? drawCell(nw.c, nw.r) : ""));
}
