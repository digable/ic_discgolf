// discgolf.js: Basics, raw ANSI output (tracks cursor and color) and key input.
// Loaded by ../discgolf.js. ES5 for Synchronet (no let/const/arrows).

"use strict";

// ---- Basics ---------------------------------------------------------------
function now() { return system.timer; }
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

// ---- Lean screen output (raw ANSI, tracks cursor and color) --------------
// Colors use ANSI order: 0 black 1 red 2 green 3 brown 4 blue 5 magenta
// 6 cyan 7 gray, +8 bright (10 lt green, 11 yellow, 15 white), +16*n
// background, +128 underline, +256 blink.
var scr = { row: 0, col: 0, attr: -1 };

function setAttr(a) {
	if (a === scr.attr) return "";
	var p = [], o = scr.attr;
	if (o < 0 || ((o & 8) && !(a & 8)) || ((o & 0x70) && !(a & 0x70)) || ((o & 0x80) && !(a & 0x80)) || ((o & 0x100) && !(a & 0x100))) { p.push(0); o = 7; }
	if ((a & 8) && !(o & 8)) p.push(1);
	if ((a & 0x80) && !(o & 0x80)) p.push(4);
	if ((a & 0x100) && !(o & 0x100)) p.push(5);
	if ((a & 7) !== (o & 7)) p.push(30 + (a & 7));
	if ((a & 0x70) !== (o & 0x70)) p.push(40 + ((a >> 4) & 7));
	scr.attr = a;
	return p.length ? "\x1b[" + p.join(";") + "m" : "";
}

function moveTo(x, y) {
	if (y === scr.row && x === scr.col) return "";
	var s, d = scr.col - x;
	if (y === scr.row && d > 0 && d <= 3) s = new Array(d + 1).join("\b");
	else if (y === scr.row && d > 0) s = "\x1b[" + d + "D";
	else if (y === scr.row && d < 0) s = "\x1b[" + (-d) + "C";
	else s = "\x1b[" + y + ";" + x + "H";
	scr.row = y; scr.col = x;
	return s;
}

function text(str, attr) {
	var s = (attr === undefined ? "" : setAttr(attr)) + str;
	scr.col += str.length;
	if (scr.col > SCR_W) scr.row = 0;   // hit the right edge: next move is absolute
	return s;
}

function out(s) { if (s) console.write(s); }

// Ctrl-A color codes to raw ANSI. "~X" draws X as a hotkey (HOT_ATTR).
// Stops after max visible characters.
// Returns [ansi, visibleLength].
function ca(str, base, max) {
	var o = "", a = base === undefined ? 7 : base, buf = "", vis = 0;
	if (!max) max = 999;
	for (var i = 0; i < str.length && vis + buf.length < max; i++) {
		var ch = str.charAt(i);
		if (ch === "~" && i + 1 < str.length) {
			if (buf) { o += text(buf, a); vis += buf.length; buf = ""; }
			o += text(str.charAt(++i), HOT_ATTR); vis++;
			continue;
		}
		if (ch === "\x01" && i + 1 < str.length) {
			if (buf) { o += text(buf, a); vis += buf.length; buf = ""; }
			var c = str.charAt(++i).toLowerCase(), k = "krgybmcw".indexOf(c);
			if (c === "n") a = 7;
			else if (c === "h") a |= 8;
			else if (k >= 0) a = (a & 0x78) | k;
			continue;
		}
		buf += ch;
	}
	if (buf) { o += text(buf, a); vis += buf.length; }
	return [o, vis];
}

// Writes a Ctrl-A string at x,y, cut or padded to exactly width characters
function put(x, y, str, width, base) {
	var m = moveTo(x, y), r = ca(str, base, width);   // move first: ca() advances the cursor record
	out(m + r[0] + (width ? text(blank(width - r[1]), 7) : ""));
}

function cls() {
	out(setAttr(7) + "\x1b[2J\x1b[H");
	scr.row = 1; scr.col = 1;
}

function key() { return console.getkey(K_NONE); }

function waitKey(msg) {
	if (msg) put(BAR_X, STATUS_Y, "\x01n\x01h" + msg, BAR_W + 2);
	return key();
}

function isLeft(k) { return k === KEY_LEFT || k === "j" || k === "J"; }
function isRight(k) { return k === KEY_RIGHT || k === "l" || k === "L"; }
function isUp(k) { return k === KEY_UP || k === "i" || k === "I"; }
function isDown(k) { return k === KEY_DOWN || k === "k" || k === "K"; }
