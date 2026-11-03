// discgolf.js: Putting: overhead and from-the-player views.
// Loaded by ../discgolf.js. ES5 for Synchronet (no let/const/arrows).

"use strict";

// ---- Putting -----------------------------------------------------------------
var PP_CX = 40;                 // center column of the overhead and player views
var PP_HORIZON = MAP_Y + 5;     // horizon row in the view from the player
var PP_AIM_ROW = MAP_Y + 14;    // aim mark / disc start row in the view from the player
var PUTT_FRAME_MS = 45;         // putt animation frame time
// Putt path colors, the same in both views, picked to stand out from the grass and sky:
// the trail is yellow dots on red, the aim line magenta, the disc white.
var PUTT_TRAIL = 11 | 0x10, PUTT_AIM = 13, PUTT_DISC = 15;
var PUTT_TRAIL_CH = "\xF9";

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
	if (player.puttView !== "pov") {
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
	} else {
		PT.art = povPuttArt(PT.dist);
		PT.artTop = MAP_Y + 1 + (PT.dist < 7 ? 0 : (PT.dist < 13 ? 2 : 3)) - clamp(Math.round(PT.dz / 3), -1, 2);
		paintScene(povPuttGlyph);
		povPuttGeom();
		povAimLine();
	}
	var circle = PT.dist <= C1_M ? "inside Circle 1" : "Circle 2 - jump putt";
	var slope = elevText(PT.dz);
	put(MAP_X + 1, MAP_Y + 15, "\x01h\x01wPUTT \x01y" + ft(PT.dist) + " ft \x01n" + circle + (slope ? "  \x01h\x01c" + slope : ""), 0, 0x20);
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
		"\x01n\x01h~View  \x01n" + (player.puttView === "pov" ? "from player" : "overhead")
	]);
}

function fadeText() {
	var f = puttFade(), v = Math.round(Math.abs(f) * FT * 10) / 10;
	return v < 0.1 ? "Flies straight" : "Fades " + (f < 0 ? "left " : "right ") + v + " ft";
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
	n = 16;
	var uMain = kind === "short" ? uEnd : 1;
	for (i = 1; i <= n; i++) { u = uMain * i / n; pts.push(topCell(puttWorld(u, made ? puttLat(u) * (1 - i / n) : puttLat(u)))); }
	if (kind === "cage") pts.push(topCell(puttWorld(uEnd, lat)));
	else if (!made && kind !== "short") for (i = 1; i <= 5; i++) { u = 1 + (uEnd - 1) * i / 5; pts.push(topCell(puttWorld(u, puttLat(u)))); }
	var pv = topCell(puttWorld(0, 0)), st;   // where it was putted from (S.lie has moved on)
	// trail dots on the overhead view keep the grass behind them
	for (i = 0; i < pts.length; i++) {
		p = pts[i];
		if (p.c === pv.c && p.r === pv.r) continue;
		st = moveTo(pv.c, pv.r) + ((pv.c === TOP.cx && pv.r === TOP.cy) ? text("\xE8", 11) : text(PUTT_TRAIL_CH, PUTT_TRAIL));
		out(st + moveTo(p.c, p.r) + text("\xFE", PUTT_DISC));
		pv = p;
		mswait(PUTT_FRAME_MS);
	}
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

// What the putt did, for the message line
function puttLine(p) {
	if (p.kind === "made") return p.band ? "\x01h\x01gOff the band and in!" : "\x01h\x01gCHAINS!";
	if (p.kind === "short") return "\x01n\x01yShort.";
	if (p.kind === "spit") return "\x01h\x01rSpit out of the chains!";
	if (p.kind === "cage") return "\x01n\x01yHits the cage.";
	if (p.kind === "over") return "\x01n\x01ySailed over the basket.";
	return "\x01n\x01yMissed " + (p.lateral < 0 ? "left." : "right.");
}

// One putt. Returns true when it's in, null to quit the round.
function putt() {
	var d = puttDisc();
	puttSetup();
	drawPuttScreen();
	if (isTapIn()) {
		status("Tap-in range. \x01hSPACE\x01n to drop it in.");
		for (;;) { var k0 = key(); if (k0 === " ") break; }
		tapIn();
		puttFlight("made", 0, 0);
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
			aimPutt(isLeft(k) ? -0.15 : 0.15);
			puttPanel(d);
			drawPuttScene();
			continue;
		}
		if (ku === "Q") { if (confirmQuit("\x01hSPACE\x01n to start your putt")) return null; continue; }
		if (k === " ") break;
	}
	var p = takePutt(swingMeter(R.lag)), line = puttLine(p);
	puttFlight(p.kind === "spit" ? "miss" : p.kind, p.along, p.endLat);
	if (p.ob) {
		msg(line + " \x01h\x01r" + (p.ob === "W" ? "In the water!" : "Out of bounds!") + "\x01n +1, putt again from your spot.");
		waitKey("Press any key");
		return false;
	}
	msg(line + (p.made ? "" : "\x01n  " + ft(pinDist()) + " ft away.  \x01k\x01h" + puttWhy(p.kind, p.need, p.thrown, p.over)));
	waitKey("Press any key");
	return p.made;
}
