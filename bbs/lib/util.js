// discgolf.js: Basics: math, text padding and seeded random numbers.
// Loaded by ../discgolf.js. ES5 for Synchronet (no let/const/arrows).

"use strict";

// ---- Basics ---------------------------------------------------------------
function rnd() { return Math.random(); }
function hyp(x, y) { return Math.sqrt(x * x + y * y); }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function blank(n) { return n > 0 ? new Array(n + 1).join(" ") : ""; }
function pad(s, n) { s = String(s); return s.length >= n ? s.substr(0, n) : s + blank(n - s.length); }
function ft(m) { return Math.round(m * FT); }
function angDiff(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
function cycle(list, cur) { return list[(list.indexOf(cur) + 1) % list.length]; }   // the item after cur, wrapping

// Seeded random numbers so each hole's woods come out the same every time
function seeded(seed) {
	var a = seed % 4294967296;
	return function () {          // plain LCG; exact in doubles, works in ES5
		a = (a * 1664525 + 1013904223) % 4294967296;
		return a / 4294967296;
	};
}
