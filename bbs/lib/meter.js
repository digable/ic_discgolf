// discgolf.js: Lag measurement and the 3-click swing meter.
// Loaded by ../discgolf.js. ES5 for Synchronet (no let/const/arrows).

"use strict";

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
