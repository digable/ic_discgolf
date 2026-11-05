// discgolf.js: The door's throw (swing, flight on the map, what happened) and relief screens.
// The rules for both are in rules.js.
// Loaded by ../discgolf.js. ES5 for Synchronet (no let/const/arrows).

"use strict";

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

function scoreName(strokes, par) {
	if (strokes === 1) return "\x01h\x01yACE!!";
	var d = strokes - par;
	return ["\x01h\x01yAlbatross!", "\x01h\x01yEagle!", "\x01h\x01gBirdie!", "\x01hPar.", "\x01n\x01yBogey.", "\x01n\x01rDouble bogey."][d + 3] || ("\x01n\x01r+" + d + ".");
}

function obWhere(t) {
	return t === "R" ? "on the road" : (t === "P" ? "in the parking lot" : (t === "W" ? "in the water" : "off the course"));
}

// A throw into the water: how far out, and whether the disc came back
function waterLine(shot) {
	var w = shot.water;
	return "\x01h\x01c" + discLabel(shot.disc) + "\x01n \x01h\x01rin the water, " + Math.max(1, ft(w.depth)) + " ft out!\x01n +1, " +
		(w.lost ? "\x01h\x01rgone for the round." : (w.putter ? "you got your putter." : "\x01h\x01gyou fished it out."));
}

// One full throw. Returns "in" if it went in the basket.
function throwShot() {
	var H = S.H;
	if (V.view === "pov") povSetAim();
	var sw = swingMeter(R.lag);
	// the flight is always shown on the map
	var wasPov = V.view === "pov", oldAim = aimMapCell(S.aim);
	V.showAim = false;
	if (wasPov) { V.view = "map"; cls(); header(); drawMap(); helpLine(); drawMeter(); panel(); msg(); }
	else { out(drawCell(oldAim.c, oldAim.r)); updateRangeMark(); }
	var shot = takeThrow(sw), f = shot.flight;
	var fromLie = cellOf(H, shot.from);
	var trail = animate(f.path);
	var how = shot.pitch ? "pitch-out" : (shot.style === "TH" ? "tomahawk" : "");
	var line = "\x01h\x01c" + discLabel(shot.disc) + (how ? " " + how : "") + "\x01n " + (sw.whiff ? "\x01h\x01rshanked\x01n, " : "") + ft(shot.dist) + " ft. ";
	if (sw.over) line = "\x01h\x01rOverswing! \x01n" + line;
	if (shot.outcome === "in") {
		msg(line + "\x01h\x01g" + (S.strokes === 1 ? "IN THE CHAINS - ACE!!" : "IN THE CHAINS!"));
		header();
		waitKey("Press any key");
		return "in";
	}
	if (shot.water) line = waterLine(shot);
	else if (shot.outcome === "ob") line += "\x01h\x01rOB " + obWhere(f.obTile) + "!\x01n +1, play from where it went out.";
	else {
		if (f.tree) line += "\x01h\x01yTree hit! \x01n";
		if (f.basket) line += "\x01h\x01yOff the cage. \x01n";
		if (f.rolled) line += "Rolled downhill. ";
		line += "Lying " + lieName(tileAt(H, S.lie)) + ", " + ft(pinDist()) + " ft to go.";
	}
	var sb = "";
	for (var i = 0; i < trail.length; i++) sb += drawCell(trail[i].c, trail[i].r);
	sb += drawCell(fromLie.c, fromLie.r);
	var endC = cellOf(H, f.end);
	sb += drawCell(endC.c, endC.r);
	V.showAim = true;
	var lc = cellOf(H, S.lie), ac = aimMapCell(S.aim);
	sb += drawCell(lc.c, lc.r) + drawCell(ac.c, ac.r);
	out(sb);
	msg(line);
	header();
	panel();
	if (inPuttRange()) status("\x01hIn putting range.\x01n Press any key to line up your putt.");
	else if (lieInTrees()) status("\x01hIn the trees.\x01n Press any key for your view from the lie.");
	else status("Press any key");
	key();
	return "";
}

// ---- Relief screen ------------------------------------------------------------
// Slide back along the line, ENTER to take relief there. True if taken.
function relief() {
	var H = S.H, spots = reliefSpots();
	var savedView = V.view;
	V.view = "map";
	V.showAim = false;
	cls();
	header("RELIEF");
	drawMap();
	var s = "", i;
	for (i = 1; i < spots.length; i++) { var c = cellOf(H, spots[i]); s += moveTo(MAP_X + c.c, MAP_Y + c.r) + text("\xFA", 13); }
	out(s);
	msg("\x01h\x01mOptional relief\x01n (PDGA): +1 throw, move back along the line from the basket.");
	helpLine("relief");
	drawMeter();
	var at = spots.length < 2 ? 0 : Math.min(spots.length - 1, Math.max(1, Math.round(4 / spots[1].back)));
	function show(prev) {
		if (prev !== undefined && prev > 0) { var pc = cellOf(H, spots[prev]); out(moveTo(MAP_X + pc.c, MAP_Y + pc.r) + text("\xFA", 13)); }
		var sp = spots[at], c2 = cellOf(H, sp), t = tileAt(H, sp);
		out(moveTo(MAP_X + c2.c, MAP_Y + c2.r) + text("\xFE", 13));
		var lines = [
			"\x01n\x01h\x01mRelief  +1 throw",
			"\x01n\x01hBack  \x01n" + ft(sp.back) + " ft",
			"\x01n\x01hLie   \x01n" + (isOB(t) ? "\x01h\x01rout of bounds" : lieName(t).replace(/^in the |^on the /, "")),
			"\x01n\x01hPin   \x01n" + ft(hyp(H.basket.x - sp.x, H.basket.y - sp.y)) + " ft",
			"", ""
		];
		showPanel(lines);
		status(isOB(t) ? "\x01h\x01rThat spot is out of bounds." : "Slide to a clear spot, then \x01hENTER");
	}
	if (spots.length < 2) { status("No room to move back here."); key(); V.view = savedView; V.showAim = true; return false; }
	show();
	for (;;) {
		var k = key(), prev = at;
		if (isLeft(k) || isDown(k)) at = Math.min(spots.length - 1, at + 1);
		else if (isRight(k) || isUp(k)) at = Math.max(1, at - 1);
		else if (k === "\r" && takeRelief(spots[at])) {
			V.showAim = true;
			V.pov = null;
			V.view = null;
			msg("\x01h\x01mTook relief.\x01n +1 throw, " + ft(spots[at].back) + " ft back. " + ft(pinDist()) + " ft to go.");
			return true;
		}
		else if (k === "\x1b" || k === "r" || k === "R" || k === "q" || k === "Q") { V.view = savedView; V.showAim = true; return false; }
		if (at !== prev) show(prev);
	}
}
