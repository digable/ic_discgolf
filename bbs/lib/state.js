// discgolf.js: Round and shot state, wind and disc range.
// Loaded by ../discgolf.js. ES5 for Synchronet (no let/const/arrows).

"use strict";

// ---- Round state ------------------------------------------------------------
var R = null;  // { course, holes[], strokes[], lag }
var S = null;  // current hole/shot state

function newWind() {
	var dirs = [[0, -1, "N"], [1, -1, "NE"], [1, 0, "E"], [1, 1, "SE"], [0, 1, "S"], [-1, 1, "SW"], [-1, 0, "W"], [-1, -1, "NW"]];
	var d = dirs[Math.floor(rnd() * 8)], mph = Math.floor(rnd() * 13), L = hyp(d[0], d[1]);
	return { mph: mph, to: d[2], x: d[0] / L * mph * MPH_TO_MS, y: d[1] / L * mph * MPH_TO_MS };
}

function windText() { return S.wind.mph ? S.wind.mph + " mph to " + S.wind.to : "calm"; }

// How far a disc flies at 100% power for this thrower (meters, flat, no wind)
function discRange(d, style, dom) {
	var arm = armSpeed(style, dom);
	var r = (30 + d.n[0] * 7 + d.n[1] * 4) * Math.min(1, 0.6 + 0.4 * arm / d.n[0]) * level().dist;
	return style === "HM" ? r * HAMMER_RANGE : r;
}

// Caddie: the slowest disc in the bag that reaches the basket with room to spare
function caddiePick() {
	var b = bagDiscs(), pin = pinDist(), dom = domHand();
	S.disc = b.length - 1;
	for (var i = 0; i < b.length; i++) if (discRange(b[i], S.style, dom) >= pin * 1.1) { S.disc = i; break; }
}

function curDisc() { var b = bagDiscs(); return b[clamp(S.disc, 0, b.length - 1)]; }
function pinDist() { return hyp(S.H.basket.x - S.lie.x, S.H.basket.y - S.lie.y); }
function lieInTrees() { return isTrees(tileAt(S.H, S.lie)); }
