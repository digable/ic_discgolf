// discgolf.js: Round and shot state, wind and disc range.
// Loaded by ../discgolf.js. ES5 for Synchronet (no let/const/arrows).

"use strict";

// ---- Round state ------------------------------------------------------------
// The game itself, with nothing about the screen in it (the door's view is V, in hud.js).
var R = null;   // the round: { course, holes[], strokes[], lost[], rules, mullUsed{}, mullTotal } (the door adds lag); lost: { disc, hole, body }
var S = null;   // the hole being played: { H, lie, aim, strokes, disc, hand, style, angle, wind, pitch, found[] }
var PT = null;  // the putt being lined up (see puttSetup)

// ---- House rules ------------------------------------------------------------
// The player picks these on the House rules screen. Each round copies them (R.rules) and the rules
// read only that copy, so a round plays by one set from start to finish (and, with more players,
// everyone in it plays by the same set).
//   obPenalty: OB costs a stroke   reliefStroke: optional relief costs a stroke
//   bagSize: discs in the bag besides the putter (a game rule, not a house rule: every bag has
//     one, see fitBag), so the standard bag of 8 is 7 + the putter
//   mulligans: rethrows allowed per mullPer holes (0: per round)   wind: a WINDS name
var HOUSE_DEFAULT = { obPenalty: true, reliefStroke: true, bagSize: 7, mulligans: 0, mullPer: 0, wind: "normal" };
var house = copyHouse(HOUSE_DEFAULT);

function copyHouse(h) {
	var c = {};
	for (var k in HOUSE_DEFAULT) c[k] = h.hasOwnProperty(k) ? h[k] : HOUSE_DEFAULT[k];
	return c;
}

function mullPerName(per) { return per ? "per " + per + " holes" : "per round"; }

// How house rules h differ from the standard ones, as short phrases ("no OB penalty", ...)
function houseChanges(h) {
	var c = [];
	if (!h.obPenalty) c.push("no OB penalty");
	if (!h.reliefStroke) c.push("free relief");
	if (h.bagSize !== HOUSE_DEFAULT.bagSize) c.push(h.bagSize ? (h.bagSize + 1) + "-disc bag" : "putter only");
	if (h.mulligans) c.push(h.mulligans + (h.mulligans > 1 ? " mulligans per " : " mulligan per ") + (h.mullPer ? h.mullPer : "round"));
	if (h.wind !== HOUSE_DEFAULT.wind) c.push(h.wind);
	return c;
}

function newWind() {
	var dirs = [[0, -1, "N"], [1, -1, "NE"], [1, 0, "E"], [1, 1, "SE"], [0, 1, "S"], [-1, 1, "SW"], [-1, 0, "W"], [-1, -1, "NW"]];
	var w = WINDS[R.rules.wind] || WINDS.normal;
	var d = dirs[Math.floor(rnd() * 8)], mph = w[0] + Math.floor(rnd() * (w[1] - w[0] + 1)), L = hyp(d[0], d[1]);
	return { mph: mph, to: d[2], x: d[0] / L * mph * MPH_TO_MS, y: d[1] / L * mph * MPH_TO_MS };
}

function windText() { return S.wind.mph ? S.wind.mph + " mph to " + S.wind.to : "calm"; }

// How far a disc flies at 100% power for this thrower (meters, flat, no wind)
function discRange(d, style, dom) {
	var arm = armSpeed(style, dom);
	var r = (30 + d.n[0] * 7 + d.n[1] * 4) * Math.min(1, 0.6 + 0.4 * arm / speedNeed(d)) * level().dist;
	return style === "TH" ? r * TOMAHAWK_RANGE : r;
}

// The disc picked for each throw: the slowest in the bag that reaches the basket with room to spare
function autoPickDisc() {
	var b = bagDiscs(), pin = pinDist(), dom = domHand();
	S.disc = b.length - 1;
	for (var i = 0; i < b.length; i++) if (discRange(b[i], S.style, dom) >= pin * 1.1) { S.disc = i; break; }
}

// The throws ~T cycles through. In the woods there's one more: a pitch-out ("PO"), a short,
// safe backhand back to the fairway (S.pitch; it lasts one throw).
function throwChoices() { return lieInTrees() ? STYLES.concat(["PO"]) : STYLES; }
function nextThrow() {
	var t = cycle(throwChoices(), S.pitch ? "PO" : S.style);
	S.pitch = t === "PO";
	S.style = S.pitch ? "BH" : t;
}

function curDisc() { var b = bagDiscs(); return b[clamp(S.disc, 0, b.length - 1)]; }
function pinDist() { return hyp(S.H.basket.x - S.lie.x, S.H.basket.y - S.lie.y); }
function inPuttRange() { return pinDist() <= PUTT_M; }
function lieInTrees() { return isTrees(tileAt(S.H, S.lie)); }

function lieName(t) {
	if (t === ".") return "in the fairway";
	if (t === ",") return "in the rough";
	if (isTrees(t)) return "in the trees";
	if (t === "S") return "on the tee";
	if (t === "B") return "at the basket";
	return "";
}

// Strokes over (+) or under (-) par for the holes finished so far
function roundToPar() {
	var rel = 0;
	for (var i = 0; i < R.strokes.length; i++) if (R.strokes[i]) rel += R.strokes[i] - R.holes[i].par;
	return rel;
}
