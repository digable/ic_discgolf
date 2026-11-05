// discgolf.js: Disc flight: how a throw curves, and where it ends up.
// Loaded by ../discgolf.js. ES5 for Synchronet (no let/const/arrows).

"use strict";

// ---- Flight shape (shared by the throw and the range mark on the map) -------
// The shape of a throw before wind and terrain: how far it goes and how much it turns
// and fades, from the disc, throw, hand, power (pf, 0-1) and whether it was overswung.
function throwShape(pf, over) {
	var d = curDisc(), n = d.n, dom = domHand(), pitch = S.pitch, w = wtOf(d);
	if (pitch) pf *= PITCH_POWER;
	var cw = (S.hand === "R") === (S.style !== "FH");    // clockwise spin: fades left
	var ar = armSpeed(S.style, dom) / speedNeed(d) * pf;
	var sh = {
		pf: pf, ar: ar, tomahawk: S.style === "TH",
		fadeSide: cw ? -1 : 1,                           // in right-positive terms
		tomSide: S.hand === "R" ? -1 : 1,                // a righty's tomahawk flips and finishes left
		dist: Math.max(1, discRange(d, S.style, dom) * pf),
		effTurn: n[2] * clamp(ar, 0, 1.4) + 0.6 * w,     // turn shows up only at speed; lighter turns more
		effFade: Math.max(0, n[3] + Math.max(0, 0.8 - ar) * 2 + 0.5 * w),  // underpowered discs fade early; lighter fades less
		angTerm: 0
	};
	if (over) sh.effTurn -= 1;                           // muscled it: turns over
	if (pitch) { sh.effTurn *= 0.5; sh.effFade *= 0.5; }
	return sh;
}

// Hyzer and anhyzer release angles (applied after wind, as the throw always has)
function applyAngle(sh) {
	if (!sh.tomahawk && S.angle === "H") { sh.effTurn *= 0.4; sh.angTerm = 0.08; }
	else if (!sh.tomahawk && S.angle === "A") { sh.effTurn -= 0.8; sh.angTerm = -0.08; }
}

// Sideways offset (meters right of the line) u of the way along a flight of length dist
function curveLat(sh, u, dist, cross) {
	if (sh.tomahawk) return sh.tomSide * dist * 0.12 * u * u + cross * dist * 0.02 * u;
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

// Where a perfect throw of shape sh ends up with no wind, terrain or trees: its curve only.
// u can stop short of 1 to walk back along the flight.
function idealPoint(sh, u) {
	var dir = throwDir(), lat = curveLat(sh, u, sh.dist, 0);
	return { x: S.lie.x + dir.x * sh.dist * u - dir.y * lat, y: S.lie.y + dir.y * sh.dist * u + dir.x * lat };
}

// ---- Flight ------------------------------------------------------------------
// Flies the current disc from S.lie toward S.aim. Returns the path (world
// points), where it ended, and what happened. Changes nothing: takeThrow does that.
function fly(sw) {
	var H = S.H, d = curDisc(), speed = d.n[0];
	var dom = domHand(), pitch = S.pitch;
	var sh = throwShape((sw.power || 0) / 100, sw.over);
	var tomahawk = sh.tomahawk, pf = sh.pf, fadeSide = sh.fadeSide, dist = sh.dist;

	var dir = throwDir(), dx = dir.x, dy = dir.y;
	var rx = -dy, ry = dx;
	var w = wtOf(d), windMul = 1 - 0.6 * w;              // a 150 g disc feels the wind 1.6 times as much
	var head = -(S.wind.x * dx + S.wind.y * dy) * windMul, cross = (S.wind.x * rx + S.wind.y * ry) * windMul;
	sh.effTurn -= head * 0.12;                           // headwind: more turn
	if (head < 0) sh.effFade += -head * 0.1;             // tailwind: more fade
	dist *= 1 - head * 0.02;

	// elevation: downhill flies farther and fades more, uphill comes up short
	var drop = (heightAt(H, S.lie) - heightAt(H, { x: S.lie.x + dx * dist, y: S.lie.y + dy * dist })) / FT;
	dist = Math.max(1, dist + drop);
	if (drop > 0) sh.effFade += drop * 0.05;

	applyAngle(sh);

	// Release timing: early = toward the fade side, late = toward the turn side
	var accMul = (dom ? 1 : OFF_ACC) * (sw.over ? OVER_ACC : 1) * (tomahawk ? 1.4 : 1) * (pitch ? 0.7 : 1);
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
		if (u > 0.5 && bd < 0.7 && !tomahawk) {
			res.basket = true;
			if (rnd() < 0.7) { res.end = { x: H.basket.x, y: H.basket.y }; res.inBasket = true; return finish(res, path); }
			res.end = { x: H.basket.x - fx * (1 + rnd()), y: H.basket.y + (rnd() - 0.5) * 2 };
			return finish(res, path);
		}
		// trees: a tomahawk flies over them until it comes down
		if ((!tomahawk || u > 0.8) && hyp(p.x - S.lie.x, p.y - S.lie.y) > CLEARING_M && trunkAt(H, p, discR)) {
			res.tree = true;
			if (rnd() < 0.3 + 0.1 * w) res.end = { x: p.x + fx * (1 + rnd() * 4) + gx * (rnd() - 0.5) * 5, y: p.y + fy * (1 + rnd() * 4) + gy * (rnd() - 0.5) * 5 };
			else res.end = { x: p.x - fx * (0.5 + rnd() * 2.5) + gx * (rnd() - 0.5) * 4, y: p.y - fy * (0.5 + rnd() * 2.5) + gy * (rnd() - 0.5) * 4 };
			path.push(res.end);
			res.lastIn = isOB(tileAt(H, res.end)) ? lastIn : res.end;
			return finish(res, path);
		}
	}
	var end = path[path.length - 1];
	// skip along the fairway (not tomahawks or pitch-outs)
	if (tileAt(H, end) === "." && !sw.whiff && !tomahawk && !pitch) {
		var sk = speed * 0.4 * pf * (1 + 0.3 * w);       // heavy skips on, light stops
		end = { x: end.x + fx * sk + gx * fadeSide * sk * 0.3, y: end.y + fy * sk + gy * fadeSide * sk * 0.3 };
		path.push(end);
		if (!isOB(tileAt(H, end))) lastIn = end;
	}
	// roll downhill on a slope
	var roll = slopeRoll(H, end, 1 + 0.3 * w);
	if (roll) { end = roll; path.push(end); if (!isOB(tileAt(H, end))) lastIn = end; res.rolled = true; }
	res.end = end;
	res.lastIn = lastIn;
	return finish(res, path);
}

// On a real slope, open ground lets the disc roll a few meters downhill
function slopeRoll(H, p, mul) {
	if (!H.def.elev) return null;
	var t = tileAt(H, p);
	if (t !== "." && t !== ",") return null;
	var e = 1, gx = (heightAt(H, { x: p.x + e, y: p.y }) - heightAt(H, { x: p.x - e, y: p.y })) / (2 * e * FT);
	var gy = (heightAt(H, { x: p.x, y: p.y + e }) - heightAt(H, { x: p.x, y: p.y - e })) / (2 * e * FT);
	var g = hyp(gx, gy);
	if (g < 0.08) return null;
	var m = Math.min(5, g * 25) * (t === "," ? 0.5 : 1) * (mul || 1);
	return { x: p.x - gx / g * m, y: p.y - gy / g * m };
}

function finish(res, path) {
	res.path = path;
	var t = tileAt(S.H, res.end);
	if (!res.inBasket && isOB(t)) { res.ob = true; res.obTile = t; }
	return res;
}
