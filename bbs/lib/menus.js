// discgolf.js: Title screen, player setup, bag and how to play.
// Loaded by ../discgolf.js. ES5 for Synchronet (no let/const/arrows).

"use strict";

// ---- Menus ---------------------------------------------------------------------
var BIG = {
	D: ["#### ", "#   #", "#   #", "#   #", "#### "],
	I: ["###", " # ", " # ", " # ", "###"],
	S: [" ####", "#    ", " ### ", "    #", "#### "],
	C: [" ####", "#    ", "#    ", "#    ", " ####"],
	G: [" ####", "#    ", "#  ##", "#   #", " ####"],
	O: [" ### ", "#   #", "#   #", "#   #", " ### "],
	L: ["#    ", "#    ", "#    ", "#    ", "#####"],
	F: ["#####", "#    ", "#### ", "#    ", "#    "],
	" ": ["   ", "   ", "   ", "   ", "   "]
};

function bigText(str, x, y, colors) {
	for (var r = 0; r < 5; r++) {
		var s = moveTo(x, y + r), ci = 0;
		for (var i = 0; i < str.length; i++) {
			var g = BIG[str.charAt(i)];
			if (str.charAt(i) === " ") ci++;
			s += text(g[r].replace(/#/g, "\xDB") + " ", colors[ci]);
		}
		out(s);
	}
}

function titleScreen() {
	cls();
	bigText("DISC GOLF", 17, 2, [14, 11]);
	put(17, 8, "\x01n\x01k\x01h" + new Array(47).join("\xC4"));
	put(17, 9, "\x01nA 3-click swing meter disc golf door");
	put(17, 11, "\x01hCourses \x01n" + COURSES.length + " \x01k\x01h- pick one when you play");
	put(17, 12, "\x01hPlayer  \x01n" + handName(player.hand) + "-handed, " + styleName(player.style).toLowerCase() + " thrower (" + level().name.toLowerCase() + ")");
	var items = ["~Play a round", "Player ~setup", "Your ~bag & disc catalog", "~How to play", "~Quit"];
	for (var i = 0; i < items.length; i++) put(19, 14 + i, "\x01n" + items[i]);
	put(19, 20, "\x01n\x01k\x01hChoose: ");
	return key().toUpperCase();
}

// ---- Course menu ------------------------------------------------------------------
// Opened by Play: lists every course; 1-9 picks one straight away, or Up/Down
// and Enter. Returns the course's index, or -1 to go back to the title screen.
// The last course played starts highlighted.
function courseLines(i) {
	var C = COURSES[i], par = 0, len = 0;
	for (var h = 0; h < C.holes.length; h++) { par += C.holes[h].par; len += C.holes[h].ft; }
	return ["\x01h\x01w" + C.name + "  \x01n\x01k\x01h" + C.where,
		"\x01n" + C.holes.length + " holes   par " + par + "   " + String(len).replace(/\B(?=(\d{3})+$)/g, ",") + " ft"];
}

function drawCourseRow(i, on) {
	var y = 5 + i * 3, L = courseLines(i);
	put(3, y, (on ? "\x01h\x01c>" : " ") + " \x01h\x01y" + (i + 1) + "  " + L[0], 76);
	put(8, y + 1, L[1], 70);
}

function courseMenu() {
	if (COURSES.length === 1) return 0;
	var sel = clamp(player.course, 0, COURSES.length - 1), i;
	cls();
	put(3, 2, "\x01h\x01wCHOOSE A COURSE");
	for (i = 0; i < COURSES.length; i++) drawCourseRow(i, i === sel);
	put(3, 6 + COURSES.length * 3, "\x01n\x01h1-" + COURSES.length + "\x01n pick   \x01hUp/Down\x01n + \x01hENTER\x01n   ~Quit back to the clubhouse", 76);
	for (;;) {
		var k = key(), ku = k.toUpperCase(), n = Number(k);
		if (n >= 1 && n <= COURSES.length) return n - 1;
		if (k === "\r") return sel;
		if (ku === "Q" || k === "\x1b") return -1;
		if (isUp(k) || isDown(k)) {
			var old = sel;
			sel = (sel + (isUp(k) ? COURSES.length - 1 : 1)) % COURSES.length;
			drawCourseRow(old, false);
			drawCourseRow(sel, true);
		}
	}
}

function setup(first) {
	cls();
	put(3, 2, "\x01h\x01wPLAYER SETUP");
	if (first) put(3, 3, "\x01n\x01k\x01hA few questions before you head to the first tee.");
	put(3, 5, "\x01nWhich hand do you throw with?   ~Right   ~Left");
	for (;;) { var k = key().toUpperCase(); if (k === "R" || k === "L") { player.hand = k; break; } if (k === "\r" && !first) break; }
	put(3, 6, "\x01h\x01c  " + handName(player.hand) + "-handed.\x01n \x01k\x01hYour other hand has about " + Math.round(OFF_HAND * 100) + "% of the power, less accuracy.", 76);
	put(3, 8, "\x01nYour usual throw?   ~Backhand   ~Forehand (sidearm)");
	for (;;) { var k2 = key().toUpperCase(); if (k2 === "B" || k2 === "F") { player.style = k2 === "B" ? "BH" : "FH"; break; } if (k2 === "\r" && !first) break; }
	put(3, 9, "\x01h\x01c  " + styleName(player.style) + ".\x01n \x01k\x01hOn any shot, H switches hands and T cycles BH/FH/hammer.", 76);
	var spin = (player.hand === "R") === (player.style === "BH");
	put(3, 10, "\x01n  Your " + styleName(player.style).toLowerCase() + " fades to the \x01h" + (spin ? "left" : "right") + "\x01n and turns over to the \x01h" + (spin ? "right" : "left") + "\x01n.");
	put(3, 12, "\x01nHow far do you throw?   ~Regular   ~Pro");
	for (;;) { var k3 = key().toUpperCase(); if (k3 === "R" || k3 === "P") { player.level = k3 === "P" ? "pro" : "reg"; break; } if (k3 === "\r") break; }
	put(3, 13, "\x01h\x01c  " + level().name + ".\x01n \x01k\x01h" + (player.level === "pro"
		? "A big arm: drivers fly 400+ ft and turn over at speed."
		: "A typical rec arm: ~300 ft drives; fast drivers barely turn and fade early."), 76);
	waitKey("Press any key");
}

function bagScreen() {
	var sel = 0, top = 0, ROWS = 17;
	for (;;) {
		cls();
		put(3, 1, "\x01h\x01wYOUR BAG & DISC CATALOG  \x01n\x01k\x01h(" + player.bag.length + " of " + BAG_MAX + " slots)", 77);
		put(3, 2, "\x01n\x01k\x01h   DISC          MAKER          TYPE       SPEED GLIDE TURN FADE", 77);
		if (sel < top) top = sel;
		if (sel >= top + ROWS) top = sel - ROWS + 1;
		for (var i = top; i < Math.min(DISCS.length, top + ROWS); i++) {
			var d = DISCS[i], inBag = player.bag.indexOf(d.name) >= 0;
			var line = (inBag ? "\x01h\x01g\xFE " : "\x01n\x01k\x01h\xFA ") + (i === sel ? "\x01h\x01w" : "\x01n") +
				pad(d.name, 14) + pad(d.maker, 15) + pad(TYPE_NAME[d.type], 11) +
				pad(String(d.n[0]), 6) + pad(String(d.n[1]), 6) + pad(String(d.n[2]), 5) + d.n[3];
			put(3, 3 + i - top, (i === sel ? "\x01h\x01c>" : " ") + line, 77);
		}
		put(3, 21, "\x01n\x01k\x01hSpeed = how hard it must be thrown. Glide = how long it floats.", 77);
		put(3, 22, "\x01n\x01k\x01hTurn = drift right early (for RH backhand; negative turns more). Fade = hook left at the end.", 77);
		put(3, 24, "\x01h\x01cUp/Down\x01n move  \x01h\x01cSPACE\x01n add/remove  ~Quit", 77);
		var k = key(), ku = k.toUpperCase();
		if (isUp(k)) sel = Math.max(0, sel - 1);
		else if (isDown(k)) sel = Math.min(DISCS.length - 1, sel + 1);
		else if (k === " " || k === "\r") {
			var nm = DISCS[sel].name, at = player.bag.indexOf(nm);
			if (at >= 0) { if (player.bag.length > 1) player.bag.splice(at, 1); }
			else if (player.bag.length < BAG_MAX) player.bag.push(nm);
			bagChanged();
		}
		else if (ku === "Q" || k === "\x1b") return;
	}
}

function howTo() {
	cls();
	var L = [
		"\x01h\x01wHOW TO PLAY",
		"\x01h\x01cThe meter\x01n   SPACE starts your reach-back. SPACE again sets power: the white",
		"            mark is 100%. Past it you overswing - the disc turns over and",
		"            power drops. SPACE a third time as the marker comes back through",
		"            the yellow: early pulls toward your fade side, late pushes the other way.",
		"\x01h\x01cDiscs\x01n       1-8 or ~D picks a disc. Fast discs fly far but need arm speed.",
		"            On the map, \x01h\x01c\xE9\x01n is where a perfect 100% throw lands, no wind (\x01n\x01c\xE9\x01n: off map).",
		"            The dots are its flight; trees and hazards in its way show on red.",
		"\x01h\x01cThrows\x01n      ~T cycles backhand, forehand and hammer. A hammer flies over the",
		"            trees and comes down hard; it goes about two-thirds as far.",
		"\x01h\x01cHand\x01n        ~H switches hands. Your off hand has less power and accuracy.",
		"\x01h\x01cAngle\x01n       ~A cycles flat, hyzer and anhyzer.",
		"\x01h\x01cTrees\x01n       In the trees you see the view from your lie. Left/Right picks a",
		"            line; the panel shows how wide the gap is. ~Pitch-out is a short,",
		"            safe throw back to the fairway. ~Relief (PDGA optional relief):",
		"            +1 throw, move back along the line from the basket.",
		"\x01h\x01cView\x01n        ~V switches between the map and the view from your lie.",
		"\x01h\x01cPutting\x01n     Inside " + ft(PUTT_M) + " ft you putt. ~V cycles side, overhead and from-the-",
		"            player views. Left/Right aims off the basket to play the wind.",
		"            The meter is marked in feet; the small \x01h\x01y\xE8\x01n on it is the basket.",
		"\x01h\x01cHills\x01n       Downhill throws fly farther; uphill putts need more power.",
		"",
		"\x01n\x01k\x01hMap: \x01h\x01g\xB1\x01n\x01k\x01h fairway  \x01n\x01g\xB0\x01k\x01h rough  \x01h\x01g\xE7\x01n\x01k\x01h tree  \x01h\x01k\xB1\x01n\x01k\x01h road (OB)  \x01n\xB0\x01k\x01h parking (OB)  \x01h\x01y\xE8\x01n\x01k\x01h basket  \x01h\x01w\xFE\x01n\x01k\x01h you"
	];
	for (var i = 0; i < L.length; i++) put(3, 2 + i, L[i], 77);
	waitKey("Press any key");
}
