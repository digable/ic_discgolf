// discgolf.js: Putting: side, overhead and from-the-player views.
// Loaded by ../discgolf.js. ES5 for Synchronet (no let/const/arrows).

"use strict";

// ---- Putting -----------------------------------------------------------------
var PV_BX = 66;                 // basket column in the side view
var PV_GROUND = MAP_Y + 13;     // ground row (flat)
var PV_SCALE = 50 / PUTT_M;     // columns per meter (side view)
var PP_CX = 40;                 // center column of the overhead and player views
var PP_HORIZON = MAP_Y + 5;     // horizon row in the view from the player
var PP_AIM_ROW = MAP_Y + 14;    // aim mark / disc start row in the view from the player
var PUTT_FRAME_MS = 45;
// Putt path colors, the same in all three views, picked to stand out from the grass and sky:
// the trail is yellow dots on red, the aim line magenta, the disc white.
var PUTT_TRAIL = 11 | 0x10, PUTT_AIM = 13, PUTT_DISC = 15;
var PUTT_TRAIL_CH = "\xF9";         // putt animation frame time
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
	var g = isTrees(t) ? ["\xE7", 10] : (t === "W" ? GLYPH.W : (isOB(t) && t !== "O" ? ["\xB1", 8] : (d < PUTT_M ? ["\xB1", 10] : ["\xB0", 2])));
	if (!isTrees(t) && t !== "W") {
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

// Background behind the disc, its trail and the aim line: sky blue above the horizon, black on the grass
function povBg(r) { return r < PP_HORIZON ? 0x40 : 0; }

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
		s += moveTo(p.c, p.r) + text("\xFA", PUTT_AIM | povBg(p.r));
		last = p;
	}
	p = povProj(PT.aim, 1, PT.pv.hB);
	if (povOnScreen(p)) s += moveTo(p.c, p.r) + text("+", PUTT_AIM | (povOnArt(p.c, p.r) ? 0 : povBg(p.r)));
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
		out(moveTo(pc.c, pc.r) + text("\xFE", PUTT_DISC));
		put(TOP.cx - 13, TOP.cy - 4, "\x01n\x01k\x01hC1 " + ft(C1_M) + " ft", 0);
		put(TOP.cx + 19, TOP.cy + 6, "\x01n\x01k\x01hC2 " + ft(PUTT_M) + " ft", 0);
		var ac = topCell({ x: S.H.basket.x + PT.rx * PT.aim, y: S.H.basket.y + PT.ry * PT.aim }), ai, ap, al = "";
		for (ai = 1; ai < 16; ai++) {
			ap = topCell(puttWorld(ai / 16, PT.aim * ai / 16));
			if ((ap.c !== pc.c || ap.r !== pc.r) && (ap.c !== TOP.cx || ap.r !== TOP.cy)) al += moveTo(ap.c, ap.r) + text("\xFA", PUTT_AIM);
		}
		out(al + (PT.aim ? moveTo(ac.c, ac.r) + text("+", PUTT_AIM) : "") + setAttr(7));
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
		out(moveTo(PT.p0, sideGround(PT.p0) - 1) + text("\xFE", PUTT_DISC));
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
function povTrailDot(q) { return moveTo(q.c, q.r) + text(PUTT_TRAIL_CH, PUTT_TRAIL); }

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
			if (!hidden) s += moveTo(p.c, p.r) + text(pts[i].u < 0.55 ? "\xFE" : "\xF9", PUTT_DISC | (povOnArt(p.c, p.r) ? 0 : povBg(p.r)));
			out(s);
			prev = hidden ? null : p; prevU = pts[i].u;
			mswait(PUTT_FRAME_MS);
		}
		if (prev) out(moveTo(prev.c, prev.r) + text(prevU < 0.55 || made ? "\xFE" : "\xF9", PUTT_DISC | (povOnArt(prev.c, prev.r) ? 0 : povBg(prev.r))));
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
			st = moveTo(pv.c, pv.r) + ((pv.c === TOP.cx && pv.r === TOP.cy) ? text("\xE8", 11) : text(PUTT_TRAIL_CH, PUTT_TRAIL));
			out(st + moveTo(p.c, p.r) + text("\xFE", PUTT_DISC));
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
		var sb3 = prev3 ? moveTo(prev3.c, prev3.r) + (sideGlyph(prev3.c, prev3.r)[0] === " " ? text(PUTT_TRAIL_CH, PUTT_TRAIL) : text(sideGlyph(prev3.c, prev3.r)[0], sideGlyph(prev3.c, prev3.r)[1])) : "";
		prev3 = { c: c, r: r };
		out(sb3 + moveTo(c, r) + text("\xFE", PUTT_DISC));
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
	if (!made) {
		var from = { x: S.lie.x, y: S.lie.y };
		S.lie = { x: H.basket.x + PT.bx * along + PT.rx * endLat, y: H.basket.y + PT.by * along + PT.ry * endLat };
		// A miss that ends in water or out of bounds (an island green, say): one penalty
		// throw, and putt again from where this putt was taken
		var endT = tileAt(H, S.lie);
		if (isOB(endT)) {
			S.strokes++;
			S.lie = from;
			msg(line + " \x01h\x01r" + (endT === "W" ? "In the water!" : "Out of bounds!") + "\x01n +1, putt again from your spot.");
			waitKey("Press any key");
			return false;
		}
	}
	msg(line + (made ? "" : "\x01n  " + ft(pinDist()) + " ft away.  \x01k\x01h" + puttWhy(kind, need, thrown, over)));
	waitKey("Press any key");
	return made;
}
