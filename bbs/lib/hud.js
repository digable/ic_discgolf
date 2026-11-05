// discgolf.js: Header, messages, key help and the disc/throw/wind panel.
// Loaded by ../discgolf.js. ES5 for Synchronet (no let/const/arrows).

"use strict";

// ---- What the door is showing --------------------------------------------
// Kept apart from the game (R and S in state.js) so the rules never depend on the screen.
// Set up for each hole by playHole.
var V = null;  // { view: "map" | "pov" | null (pick one), pov, marks, showAim, lastMsg }

// ---- Screen pieces -------------------------------------------------------
function header(extra) {
	var rel = roundToPar(), rs = rel === 0 ? "E" : (rel > 0 ? "+" + rel : String(rel));
	var h = " " + upperName(R.course.name) + "   HOLE " + S.H.num + "   PAR " + S.H.par + "   " + S.H.ft + " FT" +
		"   THROW " + (S.strokes + 1) + "   ROUND " + rs;
	if (extra) h += "   " + extra;
	else {
		var e = Math.round(heightAt(S.H, S.H.basket) - heightAt(S.H, S.H.tee));
		if (Math.abs(e) >= 2) h += "   BASKET " + (e > 0 ? "+" : "") + e + " FT";
	}
	out(moveTo(1, 1) + text(pad(h, SCR_W), 0x4F) + setAttr(7));
}

function msg(m) {
	if (m !== undefined) V.lastMsg = m;
	put(1, MSG_Y, " " + V.lastMsg, SCR_W);
}

// Keys not already shown in the panel (Disc, Hand, Throw, Angle and the putting View are hotkeys
// there). The panel starts on this row, so the help stops short of it.
function helpLine(mode) {
	var t;
	if (mode === "putt") t = " ~Scorecard  ~Quit   \x01k\x01hLeft/Right aim   SPACE putt";
	else if (mode === "relief") t = " \x01hArrows\x01n slide   \x01hENTER\x01n take this spot   \x01hESC\x01n cancel";
	else t = " ~View ~Relief ~Scorecard ~Quit  \x01k\x01h1-8 disc  Arrows " + (V.view === "pov" ? "turn" : "aim");
	put(1, HELP_Y, "\x01n\x01w" + t, PANEL_X - 2);
}

function throwLabel() { return S.pitch ? "Pitch-out" : styleName(S.style); }

// A tomahawk ignores the release angle (see applyAngle)
function angleLine() { return "\x01n\x01h~Angle \x01n" + (S.style === "TH" ? "\x01k\x01h- (tomahawk)" : angleName(S.angle)); }

// Panel lines shared by the throw and putt panels
// How far this disc flies at 100% for the current throw and hand (matches the range mark on the map)
function maxRange(d) { return discRange(d, S.style, domHand()) * (S.pitch ? PITCH_POWER : 1); }
function discSpecLine(d) { return "\x01n\x01k\x01hMax \x01n\x01c" + pad(ft(maxRange(d)) + " ft", 7) + "\x01n" + d.n.join("/"); }
// "Disc  Leopard3 150g": the weight after the name, shortened to fit the panel's 20 columns
function discNameLine(label, d) {
	var room = 20 - label.replace("~", "").length, g = String(d.g || MAX_G);
	var wt = d.name.length + 1 + g.length + 1 <= room ? g + "g" : g;
	return "\x01n\x01h" + label + "\x01c" + d.name.slice(0, room - 1 - wt.length) + " \x01n\x01c" + wt;
}
function handLine() { return "\x01n\x01h~Hand  \x01n" + handName(S.hand) + (domHand() ? "" : " \x01h\x01r(off)"); }

// Draws the panel; rows it doesn't use are cleared
function showPanel(lines) { for (var i = 0; i < PANEL_H; i++) put(PANEL_X, PANEL_Y + i, lines[i] || "", 20); }

function panel() {
	var d = curDisc(), pin = pinDist();
	var lines = [
		discNameLine("~Disc  ", d),
		discSpecLine(d),
		handLine(),
		"\x01n\x01h~Throw \x01n" + throwLabel(),
		angleLine()
	];
	if (V.view === "pov" && V.pov) {
		var gi = gapInfo(V.pov.aimCol);
		lines.push("\x01n\x01hGap \x01n" + ft(gi.width) + " ft, clear " + (gi.clear > POV.maxD ? "far" : ft(gi.clear)));
		lines.push("\x01n\x01hBasket \x01n" + bearingText());
	} else {
		var up = elevText(heightAt(S.H, S.H.basket) - heightAt(S.H, S.lie));
		lines.push("\x01n\x01hWind  \x01n" + windText());
		lines.push("\x01n\x01hPin \x01n" + ft(pin) + " ft " + (up ? "\x01k\x01h" + up : "\x01k\x01hAim \x01n" + ft(hyp(S.aim.x - S.lie.x, S.aim.y - S.lie.y))));
	}
	showPanel(lines);
}
