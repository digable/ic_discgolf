// discgolf.js: The view from the player's lie, and the shot screen.
// Loaded by ../discgolf.js. ES5 for Synchronet (no let/const/arrows).

"use strict";

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
		g = t === "." ? ["\xB1", 10] : (t === "W" ? GLYPH.W : (isOB(t) && t !== "O" ? ["\xB1", 8] : ["\xB0", 2]));
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
