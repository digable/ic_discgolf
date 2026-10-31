// discgolf.js: Building holes from the course data: trees, lies and elevation.
// Loaded by ../discgolf.js. ES5 for Synchronet (no let/const/arrows).

"use strict";

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
