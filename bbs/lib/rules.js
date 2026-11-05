// discgolf.js: The rules of a round, with no screen, keys or waiting: starting a hole, aiming,
// throwing, relief and putting. Each one changes R, S or PT (state.js) and returns what
// happened. The door's screens (round.js, shot.js, putt.js) call these and draw the results;
// another front end can call the same ones and play by exactly the same rules.
// Loaded by ../discgolf.js. ES5 for Synchronet (no let/const/arrows).

"use strict";

// ---- Round and hole ---------------------------------------------------------
function startRound(course) {
	R = { course: course, holes: [], strokes: [], lost: [] };
	S = null;
	bagChanged();
	for (var i = 0; i < course.holes.length; i++) { R.holes.push(buildHole(course.holes[i], i)); R.strokes.push(0); }
	return R;
}

// The round is over: discs lost in the water go back in the bag
function endRound() {
	R = null;
	bagChanged();
}

// Puts the player on hole idx's tee (0 is the first hole), aimed at the basket, with the
// disc picked for it. The hand and throw carry over from the last hole, but a tomahawk goes back
// to the usual throw. S.found lists any lost discs that washed up on this hole.
function startHole(idx) {
	var H = R.holes[idx], prev = S;
	S = {
		H: H, lie: { x: H.tee.x, y: H.tee.y }, aim: { x: H.basket.x, y: H.basket.y }, strokes: 0, disc: 0,
		hand: prev ? prev.hand : player.hand,
		style: prev ? (prev.style === "TH" ? player.style : prev.style) : player.style,
		angle: "F", wind: newWind(), pitch: false, found: washedUp(H)
	};
	PT = null;
	autoPickDisc();
	return S;
}

// Lost discs that turn up on hole H, on the same water they went into. They go back in the bag.
function washedUp(H) {
	var found = [];
	for (var i = R.lost.length - 1; i >= 0; i--) {
		var l = R.lost[i];
		if (l.body && holeHasWater(H, l.body) && rnd() < WASHUP_CHANCE) { found.push(l.disc); R.lost.splice(i, 1); }
	}
	if (found.length) bagChanged();
	return found;
}

// Moves the aim dc map columns right and dr rows down. It stays within the map's columns, but can
// go up to AIM_PAST_ROWS rows past the top or bottom, for a throw at a steeper angle.
function moveAim(dc, dr) {
	var H = S.H;
	S.aim = {
		x: clamp(S.aim.x + dc * H.S, 0, (MAP_W - 1) * H.S),
		y: clamp(S.aim.y + dr * 2 * H.S, -AIM_PAST_ROWS * 2 * H.S, (MAP_H - 1 + AIM_PAST_ROWS) * 2 * H.S)
	};
}

// ---- Throwing ---------------------------------------------------------------
// One throw from S.lie toward S.aim with the swing sw (from the meter: { power, over,
// accuracy } or { whiff, power }). Counts it (and an OB penalty), moves the lie and gets
// ready for the next throw: aim back on the basket, the disc picked for it, no pitch-out. Returns
//   { sw, disc, style, pitch, from, dist (meters), flight (what fly returned),
//     outcome: "in" (in the basket), "ob" (+1, now at flight.lastIn) or "lie",
//     water: what waterFate returned, if it went in the water }
function takeThrow(sw) {
	var H = S.H, from = { x: S.lie.x, y: S.lie.y };
	var shot = { sw: sw, disc: curDisc(), style: S.style, pitch: S.pitch, from: from };
	S.strokes++;
	var f = fly(sw);
	shot.flight = f;
	shot.dist = hyp(f.end.x - from.x, f.end.y - from.y);
	S.pitch = false;
	if (f.inBasket) {
		S.lie = { x: H.basket.x, y: H.basket.y };
		shot.outcome = "in";
		return shot;
	}
	if (f.ob) {
		S.strokes++;
		S.lie = f.lastIn || from;
		shot.outcome = "ob";
		if (f.obTile === "W") shot.water = waterFate(H, f.end, shot.disc);
	}
	else { S.lie = f.end; shot.outcome = "lie"; }
	S.aim = { x: H.basket.x, y: H.basket.y };
	autoPickDisc();
	return shot;
}

// The chance of getting disc d back from depth meters out in the water
function retrieveChance(depth, d) {
	return clamp(WATER_BEST - WATER_PER_M * depth - WATER_LIGHT * wtOf(d), WATER_WORST, WATER_BEST);
}

// Disc d went in the water at p: is it lost for the round? The putter never is (so a missed putt
// can't lose a disc either). Returns { depth (meters from dry ground), lost, putter }.
function waterFate(H, p, d) {
	var depth = waterDepth(H, p), putter = d.key === puttDisc().key;
	var lost = !putter && rnd() >= retrieveChance(depth, d);
	if (lost) {
		R.lost.push({ disc: d, hole: H.num, body: waterBody(H, p) });
		bagChanged();
	}
	return { depth: depth, lost: lost, putter: putter };
}

// ---- Relief (PDGA optional relief: +1, back along the line of play) -------
// The spots relief can move to, a map column apart, from the lie (spots[0]) straight back
// from the basket to the edge of the map. Each is { x, y, back (meters behind the lie) }.
function reliefSpots() {
	var H = S.H, bx = S.lie.x - H.basket.x, by = S.lie.y - H.basket.y, L = hyp(bx, by) || 1;
	bx /= L; by /= L;
	var step = Math.max(0.5, H.S), spots = [];
	for (var back = 0; back < 200; back += step) {
		var p = { x: S.lie.x + bx * back, y: S.lie.y + by * back, back: back };
		if (!inMap(cellOf(H, p))) break;
		spots.push(p);
	}
	return spots;
}

// Takes relief at spot p (one of reliefSpots): +1 throw. False if p is out of bounds.
function takeRelief(p) {
	var H = S.H;
	if (isOB(tileAt(H, p))) return false;
	S.strokes++;
	S.lie = { x: p.x, y: p.y };
	S.pitch = false;                             // out of the woods: no pitch-out
	S.aim = { x: H.basket.x, y: H.basket.y };
	autoPickDisc();
	return true;
}

// ---- Putting ------------------------------------------------------------------
// Sets up a putt from the current lie (call it when inPuttRange()). PT holds:
//   dist (meters), bx,by: from the basket back toward the player, rx,ry: the player's right,
//   dz: how far the basket is above the lie (ft), aim: meters right of the basket,
//   cross: the wind across the line (m/s, + to the right), comp: set by the putt
function puttSetup() {
	var H = S.H, dist = pinDist();
	var bx = (S.lie.x - H.basket.x) / (dist || 1), by = (S.lie.y - H.basket.y) / (dist || 1);
	PT = { dist: dist, bx: bx, by: by, rx: by, ry: -bx, dz: heightAt(H, H.basket) - heightAt(H, S.lie), aim: 0 };
	PT.cross = S.wind.x * PT.rx + S.wind.y * PT.ry;
	return PT;
}

function isTapIn() { return PT.dist < 1.2; }

// Nudges the aim d meters right (negative: left), up to 3 m either side
function aimPutt(d) { PT.aim = clamp(PT.aim + d, -3, 3); }

// How much the putter fades at the end, in meters (negative = left). Backhand from the
// right hand (or forehand from the left) spins clockwise and fades left; the others fade right.
function puttFade() {
	var dir = ((S.hand === "R") === (S.style !== "FH")) ? -1 : 1;
	return dir * puttDisc().n[3] * 0.06 * clamp(PT.dist / 10, 0.3, 1.5);
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

// A tap-in (isTapIn): always goes in
function tapIn() {
	PT.comp = { aim: 0, timing: 0, drift: 0, fade: 0 };
	S.strokes++;
	S.lie = { x: S.H.basket.x, y: S.H.basket.y };
}

// One putt with the swing sw. Counts it and moves the lie to where the disc stops; a miss
// that ends out of bounds (an island green, say) is +1 and stays where it was putted from.
// Returns { made, kind, band, lateral, along, endLat, need, thrown, over, ob }:
//   kind: "made" (band: off the band and in), "short", "spit", "cage", "over" or "miss"
//   lateral: meters right of the basket as it got there; along: where it ends, meters short of
//   the basket (negative = past it); endLat: meters right of the line where it ends;
//   need/thrown/over: meters it needed, went and went too far; ob: the OB tile it ended on, or ""
function takePutt(sw) {
	var H = S.H, from = { x: S.lie.x, y: S.lie.y };
	S.strokes++;
	var dom = domHand(), accMul = (dom ? 1 : OFF_ACC) * (sw.over ? OVER_ACC : 1);
	var need = PT.dist + PT.dz / FT;                          // uphill plays longer
	var thrown = (sw.power / 100) * PUTT_M * (sw.whiff ? 0.6 : 1);
	var over = thrown - need;
	var err = sw.whiff ? (rnd() - 0.5) * 0.4 : sw.accuracy * 0.03 * accMul + (rnd() - 0.5) * 0.01;
	PT.comp = { aim: PT.aim, timing: Math.sin(err) * PT.dist, drift: PT.cross * PT.dist * 0.025 * (1 - 0.4 * wtOf(puttDisc())), fade: puttFade() };
	var lateral = puttLat(1);                                 // meters right of the basket
	var made = false, band = false, kind;
	if (over < -0.15) kind = "short";
	else if (Math.abs(lateral) <= 0.35 && over <= 6) {
		var spit = over <= 1.5 ? 0.04 : 0.04 + (over - 1.5) * 0.08;
		if (rnd() < spit) kind = "spit";
		else { made = true; kind = "made"; }
	} else if (Math.abs(lateral) <= 0.55 && over <= 6) {
		if (rnd() < 0.35) { made = true; band = true; kind = "made"; }
		else kind = "cage";
	} else if (over > 6) kind = "over";
	else kind = "miss";

	var along;
	if (made) along = 0;
	else if (over < -0.15) along = -over;
	else if (kind === "cage") along = 0.3 + rnd() * 1.2;
	else along = -Math.min(Math.max(over, 1), 8) * 0.6;
	if (!made && along < 0 && PT.dz < -2) along -= 1 + rnd() * 2;   // past a downhill basket it rolls away
	var endLat = made ? 0 : (kind === "cage" ? lateral : puttLat(1 - along / Math.max(PT.dist, 0.5)));

	var res = { made: made, kind: kind, band: band, lateral: lateral, along: along, endLat: endLat, need: need, thrown: thrown, over: over, ob: "" };
	if (made) S.lie = { x: H.basket.x, y: H.basket.y };
	else {
		S.lie = { x: H.basket.x + PT.bx * along + PT.rx * endLat, y: H.basket.y + PT.by * along + PT.ry * endLat };
		var endT = tileAt(H, S.lie);
		if (isOB(endT)) { S.strokes++; S.lie = from; res.ob = endT; }
	}
	return res;
}
