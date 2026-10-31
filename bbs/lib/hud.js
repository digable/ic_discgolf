// discgolf.js: Header, messages, key help and the disc/throw/wind panel.
// Loaded by ../discgolf.js. ES5 for Synchronet (no let/const/arrows).

"use strict";

// ---- Screen pieces -------------------------------------------------------
// Strokes over (+) or under (-) par for the holes finished so far
function roundToPar() {
	var rel = 0;
	for (var i = 0; i < R.strokes.length; i++) if (R.strokes[i]) rel += R.strokes[i] - R.holes[i].par;
	return rel;
}

function header(extra) {
	var rel = roundToPar(), rs = rel === 0 ? "E" : (rel > 0 ? "+" + rel : String(rel));
	var h = " " + R.course.name.toUpperCase() + "   HOLE " + S.H.num + "   PAR " + S.H.par + "   " + S.H.ft + " FT" +
		"   THROW " + (S.strokes + 1) + "   ROUND " + rs;
	if (extra) h += "   " + extra;
	else {
		var e = Math.round(heightAt(S.H, S.H.basket) - heightAt(S.H, S.H.tee));
		if (Math.abs(e) >= 2) h += "   BASKET " + (e > 0 ? "+" : "") + e + " FT";
	}
	out(moveTo(1, 1) + text(pad(h, SCR_W), 0x4F) + setAttr(7));
}

function msg(m) {
	if (m !== undefined) S.lastMsg = m;
	put(1, MSG_Y, " " + S.lastMsg, SCR_W);
}

function helpLine(mode) {
	var t;
	if (mode === "putt") t = " ~View  ~Hand  ~Scorecard  ~Quit   \x01k\x01hLeft/Right aim   SPACE putt";
	else if (mode === "relief") t = " \x01hArrows\x01n slide back/forward   \x01hENTER\x01n take this spot   \x01hESC\x01n cancel";
	else t = " ~Disc ~Throw ~Hand ~Angle ~Pitch ~View ~Relief ~Scorecard ~Quit  \x01k\x01h1-8 disc  Arrows " + (S.view === "pov" ? "turn" : "aim");
	put(1, HELP_Y, "\x01n\x01w" + t, 79);
}

function throwLabel() {
	if (S.pitch) return "Pitch-out \x01k\x01h" + (S.style === "HM" ? "BH" : S.style);
	if (S.style === "HM") return "Hammer";
	return styleName(S.style) + " \x01k\x01h" + angleName(S.angle);
}

// Panel lines shared by the throw and putt panels
// How far this disc flies at 100% for the current throw and hand (matches the range mark on the map)
function maxRange(d) { return discRange(d, S.style, domHand()) * (S.pitch ? PITCH_POWER : 1); }
function discSpecLine(d) { return "\x01n\x01k\x01hMax \x01n\x01c" + pad(ft(maxRange(d)) + " ft", 7) + "\x01n" + d.n.join("/"); }
function handLine() { return "\x01n\x01h~Hand  \x01n" + handName(S.hand) + (domHand() ? "" : " \x01h\x01r(off)"); }

function showPanel(lines) { for (var i = 0; i < lines.length; i++) put(PANEL_X, PANEL_Y + i, lines[i], 20); }

function panel() {
	var d = curDisc(), pin = pinDist();
	var lines = [
		"\x01n\x01h~Disc  \x01c" + d.name,
		discSpecLine(d),
		handLine(),
		"\x01n\x01h~Throw \x01n" + throwLabel()
	];
	if (S.view === "pov" && S.pov) {
		var gi = gapInfo(S.pov.aimCol);
		lines.push("\x01n\x01hGap \x01n" + ft(gi.width) + " ft, clear " + (gi.clear > POV.maxD ? "far" : ft(gi.clear)));
		lines.push("\x01n\x01hBasket \x01n" + bearingText());
	} else {
		var up = elevText(heightAt(S.H, S.H.basket) - heightAt(S.H, S.lie));
		lines.push("\x01n\x01hWind  \x01n" + windText());
		lines.push("\x01n\x01hPin \x01n" + ft(pin) + " ft " + (up ? "\x01k\x01h" + up : "\x01k\x01hAim \x01n" + ft(hyp(S.aim.x - S.lie.x, S.aim.y - S.lie.y))));
	}
	showPanel(lines);
}
