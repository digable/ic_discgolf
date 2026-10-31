// discgolf.js: Playing a hole, the scorecard and a full round.
// Loaded by ../discgolf.js. ES5 for Synchronet (no let/const/arrows).

"use strict";

// ---- Playing a hole --------------------------------------------------------
function playHole(idx) {
	var H = R.holes[idx];
	S = {
		H: H, lie: { x: H.tee.x, y: H.tee.y }, aim: { x: H.basket.x, y: H.basket.y },
		strokes: 0, disc: 0, hand: S ? S.hand : player.hand, style: S ? (S.style === "HM" ? player.style : S.style) : player.style,
		angle: "F", wind: newWind(), showAim: true, pitch: false, view: null, pov: null, marks: null, lastMsg: ""
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
		if (S.view !== "pov") updateRangeMark();
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
	put(3, 2, "\x01h\x01w" + R.course.name.toUpperCase() + "  \x01n\x01k\x01h" + R.course.where, 76);
	put(3, 3, "\x01n\x01k\x01h" + (final ? "Final scorecard" : "Scorecard"), 76);
	var gap = nb === 1 ? 2 : 1;                          // one block: roomy rows, as before
	for (b = 0; b < nb; b++) scoreBlock(b * per, Math.min(n, (b + 1) * per), b === nb - 1, cur, (nb === 1 ? 6 : 5 + b * 5), gap);
	var rel = roundToPar();
	put(3, nb === 1 ? 15 : 5 + nb * 5, "\x01h\x01wTo par: " + (rel === 0 ? "E" : (rel > 0 ? "\x01r+" + rel : "\x01g" + rel)), 60);
	waitKey(final ? "Press any key to return to the clubhouse" : "Press any key to keep playing");
}

// One block of the card: holes a..z-1, at screen row y, gap rows apart
function scoreBlock(a, z, last, cur, y, gap) {
	var rows = [["HOLE", "\x01h"], ["FEET", "\x01n\x01k\x01h"], ["PAR", "\x01n"], [player.name || "YOU", "\x01h\x01c"]];
	var i0 = last ? 0 : a, i, ft_ = 0, par = 0, tot = 0;
	for (i = i0; i < z; i++) { ft_ += R.holes[i].ft; par += R.holes[i].par; tot += R.strokes[i] || 0; }
	for (var r = 0; r < rows.length; r++) {
		var line = rows[r][1] + pad(rows[r][0].substr(0, 8), 9);
		for (i = a; i < z; i++) {
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
		var tv = r === 0 ? (last ? "TOT" : "OUT") : (r === 1 ? String(ft_) : (r === 2 ? String(par) : (tot ? String(tot) : "")));
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
