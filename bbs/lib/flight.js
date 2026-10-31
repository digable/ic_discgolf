// discgolf.js: Disc flight, throwing a shot and PDGA optional relief.
// Loaded by ../discgolf.js. ES5 for Synchronet (no let/const/arrows).

"use strict";

// ---- Flight ------------------------------------------------------------------
// Throws the current disc from S.lie toward S.aim. Returns the path (world
// points), where it ended, and what happened.
// ---- Flight shape (shared by the throw and the range mark on the map) -------
// The shape of a throw before wind and terrain: how far it goes and how much it turns
// and fades, from the disc, throw, hand, power (pf, 0-1) and whether it was overswung.
function throwShape(pf, over) {
	var d = curDisc(), n = d.n, dom = domHand(), pitch = S.pitch;
	if (pitch) pf *= PITCH_POWER;
	var cw = (S.hand === "R") === (S.style !== "FH");    // clockwise spin: fades left
	var ar = armSpeed(S.style, dom) / n[0] * pf;
	var sh = {
		pf: pf, ar: ar, hammer: S.style === "HM",
		fadeSide: cw ? -1 : 1,                           // in right-positive terms
		hamSide: S.hand === "R" ? 1 : -1,                // a righty's hammer curves right
		dist: Math.max(1, discRange(d, S.style, dom) * pf),
		effTurn: n[2] * clamp(ar, 0, 1.4),               // turn shows up only at speed
		effFade: n[3] + Math.max(0, 0.8 - ar) * 2,       // underpowered discs fade early
		angTerm: 0
	};
	if (over) sh.effTurn -= 1;                           // muscled it: turns over
	if (pitch) { sh.effTurn *= 0.5; sh.effFade *= 0.5; }
	return sh;
}

// Hyzer and anhyzer release angles (applied after wind, as the throw always has)
function applyAngle(sh) {
	if (!sh.hammer && S.angle === "H") { sh.effTurn *= 0.4; sh.angTerm = 0.08; }
	else if (!sh.hammer && S.angle === "A") { sh.effTurn -= 0.8; sh.angTerm = -0.08; }
}

// Sideways offset (meters right of the line) u of the way along a flight of length dist
function curveLat(sh, u, dist, cross) {
	if (sh.hammer) return sh.hamSide * dist * 0.12 * u * u + cross * dist * 0.02 * u;
	var ts = u < 0.75 ? (u / 0.75) * (u / 0.75) : 1;
	var fs = u < 0.55 ? 0 : ((u - 0.55) / 0.45) * ((u - 0.55) / 0.45);
	return (sh.effFade * dist * 0.05 * fs + sh.effTurn * dist * 0.035 * ts + sh.angTerm * dist * u * u) * sh.fadeSide + cross * dist * 0.012 * u;
}

// Unit direction of the throw: toward the aim, or the basket if the aim is on the lie
function throwDir() {
	var dx = S.aim.x - S.lie.x, dy = S.aim.y - S.lie.y, L = hyp(dx, dy);
	if (L < 0.5) { dx = S.H.basket.x - S.lie.x; dy = S.H.basket.y - S.lie.y; L = hyp(dx, dy) || 1; }
	return { x: dx / L, y: dy / L };
}

// Where a perfect 100% throw ends up with no wind, terrain or trees: the disc's curve only.
// u can stop short of 1 to walk back along the flight.
function idealPoint(sh, u) {
	var dir = throwDir(), lat = curveLat(sh, u, sh.dist, 0);
	return { x: S.lie.x + dir.x * sh.dist * u - dir.y * lat, y: S.lie.y + dir.y * sh.dist * u + dir.x * lat };
}

function fly(sw) {
	var H = S.H, d = curDisc(), speed = d.n[0];
	var dom = domHand(), pitch = S.pitch;
	var sh = throwShape((sw.power || 0) / 100, sw.over);
	var hammer = sh.hammer, pf = sh.pf, fadeSide = sh.fadeSide, dist = sh.dist;

	var dir = throwDir(), dx = dir.x, dy = dir.y;
	var rx = -dy, ry = dx;
	var head = -(S.wind.x * dx + S.wind.y * dy), cross = S.wind.x * rx + S.wind.y * ry;
	sh.effTurn -= head * 0.12;                           // headwind: more turn
	if (head < 0) sh.effFade += -head * 0.1;             // tailwind: more fade
	dist *= 1 - head * 0.02;

	// elevation: downhill flies farther and fades more, uphill comes up short
	var drop = (heightAt(H, S.lie) - heightAt(H, { x: S.lie.x + dx * dist, y: S.lie.y + dy * dist })) / FT;
	dist = Math.max(1, dist + drop);
	if (drop > 0) sh.effFade += drop * 0.05;

	applyAngle(sh);

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

	var path = [], lastIn = { x: S.lie.x, y: S.lie.y }, res = { tree: false, basket: false, ob: false };
	var steps = Math.max(2, Math.ceil(dist / 0.5)), discR = pitch ? 0.04 : 0.11;
	for (var i = 1; i <= steps; i++) {
		var s = dist * i / steps, u = s / dist, lat = curveLat(sh, u, dist, cross);
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
	else { var oldAim = cellOf(H, S.aim); out(drawCell(oldAim.c, oldAim.r)); updateRangeMark(); }
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
