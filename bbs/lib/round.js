// discgolf.js: Playing a hole, the scorecard and a full round.
// Loaded by ../discgolf.js. ES5 for Synchronet (no let/const/arrows).

"use strict";

// ---- Playing a hole --------------------------------------------------------
function playHole(idx) {
	var H = startHole(idx).H;
	V = { view: null, pov: null, marks: null, showAim: true, lastMsg: "\x01n" + H.def.note };
	if (S.found.length) V.lastMsg = "\x01h\x01gWashed up here: " + discList(S.found) + "!\x01n " + (S.found.length > 1 ? "They're" : "It's") + " back in your bag.";
	for (;;) {
		var r = holeTurn();
		if (r !== "turn") return r;
	}
}

// One turn on the hole: the keys before a throw or putt, and then it. Returns the strokes once
// it's in the basket, null to quit the round, or "turn" when the throw is done and it isn't in
// (an online round pushes it then: see online.js). Relief, a mulligan or the scorecard stay in the turn.
function holeTurn() {
	var H = S.H, needDraw = true;
	if (inPuttRange()) {
		var made = putt();
		if (made === null) return null;
		if (made) return S.strokes;
		if (!inPuttRange()) {
			S.aim = { x: H.basket.x, y: H.basket.y };
			V.view = null; V.pov = null;
		}
		return "turn";
	}
	for (;;) {
		if (needDraw) {
			if (!V.view) { V.view = lieInTrees() ? "pov" : "map"; V.pov = null; }
			if (V.view === "pov" && V.lastMsg.indexOf("trees") < 0 && !V.pov)
				V.lastMsg = V.lastMsg ? V.lastMsg + " \x01n\x01yIn the trees." : "\x01n\x01yIn the trees.\x01n Find a gap, tomahawk, pitch out (~Throw) or take relief.";
			drawShotScreen();
			needDraw = false;
		}
		var k = key(), ku = k.toUpperCase(), oldAim = { x: S.aim.x, y: S.aim.y };
		if (k === " ") {
			var r = throwShot();
			if (r === "in") return S.strokes;
			V.view = null; V.pov = null;
			if (r === "mulligan") { needDraw = true; continue; }   // back where it was thrown from
			return "turn";
		}
		if (ku >= "1" && ku <= "9" && Number(ku) <= bagDiscs().length) S.disc = Number(ku) - 1;
		else if (ku === "D") S.disc = (S.disc + 1) % bagDiscs().length;
		else if (ku === "T") nextThrow();
		else if (ku === "H") S.hand = cycle(HANDS, S.hand);
		else if (ku === "A") S.angle = cycle(ANGLES, S.angle);
		else if (ku === "V") {
			if (V.view === "pov") { V.view = "map"; povSetAim(); }
			else { V.view = "pov"; povStart(); }
			needDraw = true;
			continue;
		}
		else if (ku === "R") { relief(); needDraw = true; continue; }
		else if (ku === "S") { scorecard(idx, false); needDraw = true; continue; }
		else if (ku === "Q") { if (confirmQuit("\x01hSPACE\x01n to throw")) return null; continue; }
		else if (V.view === "pov" && (isLeft(k) || isRight(k))) { povTurn(isLeft(k) ? -1 : 1); panel(); continue; }
		else if (V.view !== "pov" && (isLeft(k) || isRight(k) || isUp(k) || isDown(k))) {
			moveAim(isLeft(k) ? -1 : (isRight(k) ? 1 : 0), isUp(k) ? -1 : (isDown(k) ? 1 : 0));
			var a0 = aimMapCell(oldAim), a1 = aimMapCell(S.aim);
			if (a0.c !== a1.c || a0.r !== a1.r || a0.past !== a1.past) out(drawCell(a0.c, a0.r) + drawCell(a1.c, a1.r));
		}
		else continue;
		if (V.view !== "pov") updateRangeMark();
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
// Up to 11 holes fit across the screen, so longer courses are split into even
// blocks (21 holes: 11 + 10). Each block but the last ends with OUT (its own
// subtotal); the last ends with TOT for the whole round.
var CARD_MAX = 11;

function scorecard(cur, final) {
	cls();
	var n = R.holes.length, nb = Math.ceil(n / CARD_MAX), per = Math.ceil(n / nb), b;
	var rows = cardRows(), tall = rows.length > 4;
	put(3, 2, "\x01h\x01w" + upperName(R.course.name) + "  \x01n\x01k\x01h" + R.course.where, 76);
	put(3, 3, "\x01n\x01k\x01h" + (final ? "Final scorecard" : "Scorecard"), 76);
	var gap = nb === 1 && !tall ? 2 : 1;                 // one block: roomy rows, as before
	for (b = 0; b < nb; b++) scoreBlock(b * per, Math.min(n, (b + 1) * per), b === nb - 1, cur, (nb === 1 ? 6 : 5 + b * (rows.length + 1)), gap, rows);
	var rel = roundToPar();
	var y = nb === 1 ? (tall ? 7 + rows.length : 15) : 5 + nb * (rows.length + 1);
	put(3, y, "\x01h\x01wTo par: " + (rel === 0 ? "E" : (rel > 0 ? "\x01r+" + rel : "\x01g" + rel)) +
		(R.rules.mulligans ? "\x01n\x01k\x01h    Mulligans used: \x01n" + R.mullTotal : ""), 60);
	var hr = houseRows(R.rules, 76);                    // the rules this round is played by, if not standard
	for (var i = 0; i < hr.length; i++) put(3, ++y, hr[i], 76);
	lostLines(y + 1);
	waitKey(final ? "Press any key to return to the clubhouse" : "Press any key to keep playing");
}

// House rules h that aren't standard, as screen rows of at most width characters:
// ["House rules: no OB penalty, free relief, ...", "more, ..."], or [] with the standard rules
function houseRows(h, width) {
	var c = houseChanges(h), rows = [], line = "House rules: ", i;
	for (i = 0; i < c.length; i++) {
		var add = c[i] + (i < c.length - 1 ? "," : "");
		if (line.length + add.length > width && line.length > 13) { rows.push(line); line = "             "; }
		line += add + " ";
	}
	if (c.length) rows.push(line);
	for (i = 0; i < rows.length; i++) rows[i] = i ? "\x01n" + rows[i] : "\x01n\x01yHouse rules: \x01n" + rows[i].slice(13);
	return rows;
}

function discList(discs) {
	var names = [];
	for (var i = 0; i < discs.length; i++) names.push(discLabel(discs[i]));
	return names.join(", ");
}

// The discs lost in the water so far, wrapped from screen row y: "Lost: Zone 175g (hole 7), ..."
function lostLines(y) {
	var line = "";
	for (var i = 0; i < R.lost.length; i++) {
		var add = discLabel(R.lost[i].disc) + " (hole " + R.lost[i].hole + ")";
		if (line && line.length + add.length > 66) { put(3, y++, "\x01n\x01r" + line + ",", 76); line = "      " + add; }
		else line += (line ? ", " : "Lost: ") + add;
	}
	if (line) put(3, y, "\x01n\x01r" + line, 76);
}

// The card's rows: [label, color, strokes per hole (score rows only)]. An online round has a row
// for everyone in the room (yours in cyan); with more than two, the FEET row makes room for them.
function cardRows() {
	var rows = [["HOLE", "\x01h"], ["FEET", "\x01n\x01k\x01h"], ["PAR", "\x01n"]];
	var room = typeof ONLINE !== "undefined" && ONLINE && ONLINE.st ? ONLINE.st : null;
	if (!room) return rows.concat([[player.name || "YOU", "\x01h\x01c", R.strokes]]);
	if (room.players.length > 2) rows.splice(1, 1);
	for (var i = 0; i < room.players.length; i++) {
		var p = room.players[i], me = i === ONLINE.slot;
		rows.push([onlineShortName(p.name), me ?"\x01h\x01c" : (p.gone ? "\x01n\x01k\x01h" : "\x01n\x01w"), me ? R.strokes : p.strokes]);
	}
	return rows;
}

// One block of the card: holes a..z-1, at screen row y, gap rows apart
function scoreBlock(a, z, last, cur, y, gap, rows) {
	var i0 = last ? 0 : a, i, ft_ = 0, par = 0;
	for (i = i0; i < z; i++) { ft_ += R.holes[i].ft; par += R.holes[i].par; }
	for (var r = 0; r < rows.length; r++) {
		var tot = 0, sc = rows[r][2];
		if (sc) for (i = i0; i < z; i++) tot += sc[i] || 0;
		var line = rows[r][1] + pad(rows[r][0].substr(0, 8), 9);
		for (i = a; i < z; i++) {
			var v;
			var lab = rows[r][0];
			if (lab === "HOLE" && !sc) v = String(i + 1);
			else if (lab === "FEET" && !sc) v = String(R.holes[i].ft);
			else if (lab === "PAR" && !sc) v = String(R.holes[i].par);
			else {
				var st = sc[i];
				if (!st) v = i === cur ? "\x01n\x01k\x01h.." : "";
				else {
					var dd = st - R.holes[i].par;
					v = (dd < 0 ? "\x01h\x01g" : (dd > 0 ? "\x01n\x01r" : "\x01h\x01w")) + st;
				}
			}
			var vis = v.replace(/\x01./g, "");
			line += blank(5 - vis.length) + v + rows[r][1];
		}
		var tv = sc ? (tot ? String(tot) : "") : (rows[r][0] === "HOLE" ? (last ? "TOT" : "OUT") : (rows[r][0] === "FEET" ? String(ft_) : String(par)));
		line += "  " + blank(5 - tv.length) + tv;
		put(3, y + r * gap, line, 77);
	}
}


// ---- Round ---------------------------------------------------------------------
function playRound(course) {
	cls();
	put(3, 3, "\x01h\x01w" + course.name + "\x01n  " + course.where);
	put(3, 5, "\x01nMeasuring your connection...");
	var lag = measureLag();
	put(3, 5, "\x01nLag compensation: " + Math.round(lag * 1000) + " ms", 60);
	startRound(course).lag = lag;
	mswait(600);
	for (var i = 0; i < R.holes.length; i++) {
		var st = playHole(i);
		if (st === null) break;
		R.strokes[i] = st;
		msg(scoreName(st, R.holes[i].par) + "\x01n  " + st + " on a par " + R.holes[i].par + ".");
		waitKey("Press any key for the scorecard");
		scorecard(i + 1 < R.holes.length ? i + 1 : -1, i + 1 === R.holes.length);
	}
	endRound();
}
