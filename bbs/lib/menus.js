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

// A message for the next title screen ("Saved for next time."), shown once
var notice = "";

function titleScreen() {
	cls();
	bigText("DISC GOLF", 17, 2, [14, 11]);
	put(17, 8, "\x01n\x01k\x01h" + new Array(47).join("\xC4"));
	put(17, 9, "\x01nA 3-click swing meter disc golf door");
	put(17, 11, "\x01hCourses \x01n" + COURSES.length + " \x01k\x01h- pick one when you play");
	put(17, 12, "\x01hPlayer  \x01h\x01c" + player.name);
	put(17, 13, "\x01n        " + handName(player.hand) + "-handed, " + styleName(player.style).toLowerCase() + " thrower (" + level().name.toLowerCase() + ")");
	var items = ["~Play a round", "Player ~setup", "Your ~bag & disc catalog", "~How to play", "~Quit"];
	for (var i = 0; i < items.length; i++) put(19, 15 + i, "\x01n" + items[i]);
	if (notice) { put(19, 23, notice, 60); notice = ""; }
	put(19, 21, "\x01n\x01k\x01hChoose: ");
	return key().toUpperCase();
}

// ---- Course menu ------------------------------------------------------------------
// Opened by Play: a scrolling list of every course. Up/Down moves (the list
// scrolls when there are more than fit), ENTER or SPACE picks. Returns the
// course's index, or -1 to go back to the title screen. The last course played
// starts highlighted.
var COURSE_ROWS = 5;        // courses shown at once, 3 screen rows each

function courseLines(i) {
	var C = COURSES[i], par = 0, len = 0;
	for (var h = 0; h < C.holes.length; h++) { par += C.holes[h].par; len += C.holes[h].ft; }
	return ["\x01h\x01w" + C.name + "  \x01n\x01k\x01h" + C.where,
		"\x01n" + C.holes.length + " holes   par " + par + "   " + String(len).replace(/\B(?=(\d{3})+$)/g, ",") + " ft"];
}

function drawCourseRow(i, top, on) {
	var y = 5 + (i - top) * 3, L = courseLines(i);
	put(3, y, (on ? "\x01h\x01c> " : "  ") + L[0], 76);
	put(5, y + 1, L[1], 72);
}

// The visible window of courses, starting at top, with "more" hints above and below
function drawCourseList(top, sel) {
	var n = Math.min(COURSE_ROWS, COURSES.length);
	for (var i = top; i < top + n; i++) drawCourseRow(i, top, i === sel);
	put(5, 4, top > 0 ? "\x01n\x01k\x01h(more above)" : "", 20);
	put(5, 5 + n * 3 - 1, top + n < COURSES.length ? "\x01n\x01k\x01h(more below)" : "", 20);
}

function courseMenu() {
	if (COURSES.length === 1) return 0;
	var sel = clamp(player.course, 0, COURSES.length - 1);
	var n = Math.min(COURSE_ROWS, COURSES.length);
	var top = clamp(sel - n + 1, 0, COURSES.length - n);
	cls();
	put(3, 2, "\x01h\x01wCHOOSE A COURSE  \x01n\x01k\x01h" + COURSES.length + " courses");
	drawCourseList(top, sel);
	put(3, 6 + n * 3, "\x01n\x01hUp/Down\x01n move   \x01hENTER\x01n play   ~Quit back to the clubhouse", 76);
	for (;;) {
		var k = key(), ku = k.toUpperCase();
		if (k === "\r" || k === " ") return sel;
		if (ku === "Q" || k === "\x1b") return -1;
		if (isUp(k) || isDown(k)) {
			var old = sel, oldTop = top;
			sel = (sel + (isUp(k) ? COURSES.length - 1 : 1)) % COURSES.length;
			if (sel < top) top = sel;
			if (sel >= top + n) top = sel - n + 1;
			if (top !== oldTop) drawCourseList(top, sel);
			else { drawCourseRow(old, top, false); drawCourseRow(sel, top, true); }
		}
	}
}

// ---- Player setup -----------------------------------------------------------------
// Every question at once. Up/Down picks a question, Left/Right changes its answer, and its
// letters pick an answer and move on to the next question. ENTER (or Continue at the bottom)
// is done. Answers take effect as they change.
var SETUP_X = 36;           // column the answers start in
var SETUP_GO_Y = 20;        // the Continue button's row
var SETUP = [
	{ y: 5, q: "Which hand do you throw with?", opts: [["R", "~Right"], ["L", "~Left"]],
		get: function () { return player.hand; }, set: function (v) { player.hand = v; },
		note: function () {
			return ["\x01h\x01c" + handName(player.hand) + "-handed.\x01n \x01k\x01hYour other hand has about " + Math.round(OFF_HAND * 100) + "% of the power, less accuracy."];
		} },
	{ y: 8, q: "Your usual throw?", opts: [["BH", "~Backhand"], ["FH", "~Forehand (sidearm)"]],
		get: function () { return player.style; }, set: function (v) { player.style = v; },
		note: function () {
			var spin = (player.hand === "R") === (player.style === "BH");
			return ["\x01h\x01c" + styleName(player.style) + ".\x01n \x01k\x01hOn any shot, H switches hands and T cycles BH/FH/hammer.",
				"\x01nYour " + styleName(player.style).toLowerCase() + " fades to the \x01h" + (spin ? "left" : "right") + "\x01n and turns over to the \x01h" + (spin ? "right" : "left") + "\x01n."];
		} },
	{ y: 12, q: "How far do you throw?", opts: [["reg", "~Regular"], ["pro", "~Pro"]],
		get: function () { return player.level; }, set: function (v) { player.level = v; },
		note: function () {
			return player.level === "pro"
				? ["\x01h\x01cPro.\x01n \x01k\x01hA big arm: drivers fly 400+ ft and turn over at speed."]
				: ["\x01h\x01cRegular.\x01n \x01k\x01hA typical rec arm: about 300 ft drives.", "\x01k\x01hFast drivers barely turn and fade early."];
		} },
	{ y: 16, q: "Flight path on the map?", opts: [[true, "~Show"], [false, "~Hide"]],
		get: function () { return player.flightPath; }, set: function (v) { player.flightPath = v; },
		note: function () {
			return player.flightPath
				? ["\x01h\x01cShown.\x01n \x01k\x01hDots trace a perfect throw out to the range mark \x01n\x01h\x01c\xE9\x01k\x01h;", "\x01k\x01htrees and hazards in its way show on red."]
				: ["\x01h\x01cHidden.\x01n \x01k\x01hThe map shows just the range mark \x01n\x01h\x01c\xE9\x01k\x01h, where a perfect throw lands."];
		} }
];

function hotkeyOf(label) { return label.charAt(label.indexOf("~") + 1).toUpperCase(); }

// Question i (SETUP.length: the Continue button). The answer is highlighted: white on blue on
// the question you're on, black on gray on the others. Hotkeys show only where they work.
function drawSetupRow(i, focus) {
	var mark = text(focus ? ">" : " ", 14) + text(" ", 7);
	if (i === SETUP.length) { out(moveTo(2, SETUP_GO_Y) + mark + text(" Continue ", focus ? 0x4F : 0x70) + setAttr(7)); return; }
	var row = SETUP[i], cur = row.get(), s = moveTo(2, row.y) + mark + ca(row.q, focus ? 15 : 7)[0], col = SETUP_X;
	s += text(blank(SETUP_X - 4 - row.q.length), 7);
	for (var j = 0; j < row.opts.length; j++) {
		var lab = " " + row.opts[j][1] + " ", on = row.opts[j][0] === cur;
		if (on) s += ca(lab.replace("~", ""), focus ? 0x4F : 0x70)[0];
		else s += ca(focus ? lab : lab.replace("~", ""), focus ? 7 : 8)[0];
		s += text(" ", 7);
		col += lab.length;              // the ~ isn't shown; the space after is
	}
	out(s + text(blank(SCR_W - col), 7));
	var notes = row.note();
	for (j = 0; j < 2; j++) put(6, row.y + 1 + j, notes[j] || "", 74);
}

function setup(first) {
	cls();
	put(3, 2, "\x01h\x01wPLAYER SETUP");
	put(3, 3, "\x01n\x01k\x01h" + (!player.canSave ? (player.handle ? "The save server isn't answering: these settings won't be saved."
		: "Settings aren't saved on the web version.")
		: (first ? "A few questions before you head to the first tee. Saved for next time." : "Changes are saved for next time.")), 76);
	put(3, 22, "\x01n\x01hUp/Down\x01n pick a question   \x01hLeft/Right\x01n or a letter: answer   \x01hENTER\x01n continue", 76);
	var f = 0, i;
	for (i = 0; i <= SETUP.length; i++) drawSetupRow(i, i === f);
	for (;;) {
		var k = key(), ku = k.toUpperCase(), row = SETUP[f], old = f, changed = false, j, hit = -1;
		if (k === "\r" || k === "\x1b") return;
		if (row) for (j = 0; j < row.opts.length; j++) if (hotkeyOf(row.opts[j][1]) === ku) hit = j;
		if (hit >= 0) { row.set(row.opts[hit][0]); changed = true; f++; }     // letters before arrows: L is also Right (isRight)
		else if (isUp(k)) f = Math.max(0, f - 1);
		else if (isDown(k)) f = Math.min(SETUP.length, f + 1);
		else if (row && (isLeft(k) || isRight(k))) {
			for (j = 0; j < row.opts.length; j++) if (row.opts[j][0] === row.get()) break;
			j = clamp(j + (isLeft(k) ? -1 : 1), 0, row.opts.length - 1);
			if (row.opts[j][0] !== row.get()) { row.set(row.opts[j][0]); changed = true; }
		}
		if (changed) { for (i = 0; i <= SETUP.length; i++) drawSetupRow(i, i === f); }   // the throw's note depends on the hand
		else if (f !== old) { drawSetupRow(old, false); drawSetupRow(f, true); }
	}
}

// ---- Signing in ----------------------------------------------------------------------
// Who's playing. A BBS user plays under their alias and gets their saved settings back (or
// sets them up the first time); a web player types a name, and nothing is saved.
function signIn() {
	if (typeof user === "undefined" || !user.number) {   // the web version: nobody's logged in
		player.name = askName();
		setup(true);
		return;
	}
	player.name = user.alias;
	player.handle = slugOf(user.alias);
	var got = loadSettings();
	player.canSave = got !== "off";
	if (got === "off") notice = "\x01h\x01ySave server not answering: settings won't be saved today.";
	if (got === "loaded" && welcomeBack() === "play") return;
	setup(got !== "loaded");
	saveSetup();
}

// After player setup: saves its answers (the bag and putting view save on their own)
function saveSetup() {
	if (!player.canSave) return;
	notice = saveSettings(["hand", "style", "level", "flightPath"]) ? "\x01h\x01gSaved for next time."
		: "\x01h\x01yCouldn't save: the save server didn't answer.";
}

// Leaving the bag screen with a different bag: offers to save it (ENTER or Y saves)
function offerBagSave(before) {
	if (!player.canSave || player.bag.join("|") === before) return;
	put(3, 24, "\x01h\x01wSave this bag for next time? \x01h\x01cY\x01n/N", 77);
	for (;;) {
		var k = key().toUpperCase();
		if (k === "N" || k === "\x1b") return;
		if (k === "Y" || k === "\r") break;
	}
	notice = saveSettings(["bag"]) ? "\x01h\x01gBag saved for next time." : "\x01h\x01yCouldn't save: the save server didn't answer.";
}

// A BBS player with saved settings: play with them (ENTER) or change them first.
// Returns "play" or "change".
var PUTT_VIEW_NAMES = { side: "Side", top: "Overhead", pov: "From the player" };

function welcomeBack() {
	cls();
	put(3, 2, "\x01h\x01wWELCOME BACK, " + player.name.toUpperCase());
	put(3, 3, "\x01n\x01k\x01hYour saved settings");
	var rows = [["Hand", handName(player.hand) + "-handed"], ["Usual throw", styleName(player.style)],
		["Level", level().name], ["Flight path", player.flightPath ? "Shown" : "Hidden"],
		["Putting view", PUTT_VIEW_NAMES[player.puttView]]], i, j;
	for (i = 0; i < rows.length; i++) put(5, 5 + i, "\x01n\x01k\x01h" + pad(rows[i][0], 14) + "\x01n" + rows[i][1]);
	var bag = [], line = "";                  // the bag, wrapped to fit
	for (i = 0; i < player.bag.length; i++) {
		var add = (line ? ", " : "") + player.bag[i];
		if (line && line.length + add.length > 58) { bag.push(line + ","); line = player.bag[i]; }
		else line += add;
	}
	bag.push(line);
	for (i = 0; i < bag.length; i++) put(5, 11 + i, "\x01n\x01k\x01h" + (i ? blank(14) : pad("Bag", 14)) + "\x01n" + bag[i]);
	var opts = [" ~Play with these ", " ~Change settings "], sel = 0;
	put(5, 18, "\x01h\x01cLeft/Right\x01n pick   \x01h\x01cENTER\x01n choose", 70);
	for (;;) {
		var s = moveTo(5, 16);
		for (j = 0; j < opts.length; j++)
			s += ca(j === sel ? opts[j].replace("~", "") : opts[j], j === sel ? 0x4F : 7)[0] + text("   ", 7);
		out(s);
		var k = key(), ku = k.toUpperCase();
		if (ku === "P") return "play";                       // letters before arrows: L is also Right (isRight)
		if (ku === "C") return "change";
		if (k === "\r") return sel ? "change" : "play";
		if (isLeft(k) || isRight(k)) sel = 1 - sel;
	}
}

// Web players type the name they'll play under (BBS players use their alias), with the same rules
// as a new BBS user's alias (Synchronet's check_name; the server's copy is in ../api/_names.js).
var MAX_NAME = 25;   // Synchronet's LEN_ALIAS

// Why a name can't be used, or "" if it can
function nameProblem(name) {
	if (!name) return "Type your name first.";
	if (name.length > MAX_NAME) return "At most " + MAX_NAME + " characters.";
	if (!/^[\x20-\x7e]*$/.test(name)) return "Letters, digits, spaces and punctuation only.";
	if (!/^[A-Za-z]/.test(name)) return "Start with a letter.";
	if (name.charAt(name.length - 1) === " ") return "No space at the end.";
	if (name.indexOf("  ") >= 0) return "No double spaces.";
	return "";
}

function askName() {
	cls();
	put(3, 2, "\x01h\x01wWELCOME TO DISC GOLF");
	put(3, 4, "\x01nWhat's your name? It goes on your scorecard.");
	put(3, 5, "\x01n\x01k\x01hUp to " + MAX_NAME + " characters, starting with a letter.");
	put(3, 11, "\x01h\x01cENTER\x01n continue   \x01h\x01cBACKSPACE\x01n erase", 76);
	var name = "", hint = "";
	for (;;) {
		out(moveTo(5, 7) + text(" " + name, 0x4F) + text("_", 0x4B) + text(blank(MAX_NAME - name.length), 0x4F) + setAttr(7));
		put(5, 9, hint ? "\x01h\x01y" + hint : "", 70);
		var k = key(), c = k.length === 1 ? k.charCodeAt(0) : 0, add = name + k;
		hint = "";
		if (k === "\r") {
			name = name.replace(/ +$/, "");                 // a space at the end is just dropped
			hint = nameProblem(name);
			if (!hint) return name;
		}
		else if (k === "\b" || k === "\x7f") name = name.slice(0, -1);
		else if (c < 32 || c > 126) continue;              // arrows and other keys
		else if (k === " " && (name === "" || name.charAt(name.length - 1) === " ")) hint = name ? "No double spaces." : "Start with a letter.";
		else if ((hint = nameProblem(add.replace(/ +$/, ""))) === "") name = add;
	}
}

// The screen is drawn once; after that only the rows that change are redrawn
// (a full clear on every key made the whole screen flash).
// Left/Right picks the column the list is sorted by, R reverses it. Ties keep
// catalog order. The sort lasts until the player hangs up.
var BAG_ROWS = 17;          // discs shown at once
var TYPE_ORDER = { P: 0, A: 1, M: 2, F: 3, D: 4 };
var BAG_COLS = [            // header, width, sort value, sort order names (low first, high first)
	{ h: "DISC",  w: 14, v: function (d) { return d.name.toUpperCase(); }, dir: ["A to Z", "Z to A"] },
	{ h: "MAKER", w: 15, v: function (d) { return d.maker.toUpperCase(); }, dir: ["A to Z", "Z to A"] },
	{ h: "TYPE",  w: 11, v: function (d) { return TYPE_ORDER[d.type]; }, dir: ["putters first", "drivers first"] },
	{ h: "SPEED", w: 6,  v: function (d) { return d.n[0]; }, dir: ["low to high", "high to low"] },
	{ h: "GLIDE", w: 6,  v: function (d) { return d.n[1]; }, dir: ["low to high", "high to low"] },
	{ h: "TURN",  w: 5,  v: function (d) { return d.n[2]; }, dir: ["low to high", "high to low"] },
	{ h: "FADE",  w: 4,  v: function (d) { return d.n[3]; }, dir: ["low to high", "high to low"] }
];
var bagSort = { col: 2, rev: false };   // catalog order: by type

// DISCS indices in the current sort order
function bagOrder() {
	var c = BAG_COLS[bagSort.col], order = [], i;
	for (i = 0; i < DISCS.length; i++) order.push(i);
	order.sort(function (a, b) {
		var x = c.v(DISCS[a]), y = c.v(DISCS[b]);
		if (x !== y) return (x < y ? -1 : 1) * (bagSort.rev ? -1 : 1);
		return a - b;                               // ties: catalog order (sort() may not be stable)
	});
	return order;
}

function drawBagTitle() {
	put(3, 1, "\x01h\x01wYOUR BAG & DISC CATALOG  \x01n\x01k\x01h(" + player.bag.length + " of " + BAG_MAX + " slots)", 44);
}

// Column headers with the sorted one lit, and how it's sorted
function drawBagSort() {
	var s = "\x01n\x01k\x01h   ";
	for (var i = 0; i < BAG_COLS.length; i++)
		s += (i === bagSort.col ? "\x01h\x01c" : "\x01n\x01k\x01h") + pad(BAG_COLS[i].h, BAG_COLS[i].w);
	put(3, 2, s, 77);
	var c = BAG_COLS[bagSort.col];
	put(47, 1, "\x01n\x01k\x01hSorted by \x01h\x01c" + c.h.toLowerCase() + "\x01n\x01k\x01h, " + c.dir[bagSort.rev ? 1 : 0], 33);
}

// Row i of the list (an index into order)
function drawBagRow(order, i, top, sel) {
	var d = DISCS[order[i]], inBag = player.bag.indexOf(d.name) >= 0;
	var line = (inBag ? "\x01h\x01g\xFE " : "\x01n\x01k\x01h\xFA ") + (i === sel ? "\x01h\x01w" : "\x01n") +
		pad(d.name, 14) + pad(d.maker, 15) + pad(TYPE_NAME[d.type], 11) +
		pad(String(d.n[0]), 6) + pad(String(d.n[1]), 6) + pad(String(d.n[2]), 5) + d.n[3];
	put(3, 3 + i - top, (i === sel ? "\x01h\x01c>" : " ") + line, 77);
}

function drawBagList(order, top, sel) {
	for (var i = top; i < Math.min(DISCS.length, top + BAG_ROWS); i++) drawBagRow(order, i, top, sel);
}

function bagScreen() {
	var order = bagOrder(), sel = 0, top = 0;
	cls();
	drawBagTitle();
	drawBagSort();
	drawBagList(order, top, sel);
	put(3, 21, "\x01n\x01k\x01hSpeed = how hard it must be thrown. Glide = how long it floats.", 77);
	put(3, 22, "\x01n\x01k\x01hTurn = drift right early (for RH backhand; negative turns more). Fade = hook left at the end.", 77);
	put(3, 24, "\x01h\x01cUp/Down\x01n move  \x01h\x01cSPACE\x01n add/remove  \x01h\x01cLeft/Right\x01n sort by  ~Reverse  ~Quit", 77);
	for (;;) {
		var k = key(), ku = k.toUpperCase();
		if (isUp(k) || isDown(k)) {
			var old = sel, oldTop = top;
			sel = isUp(k) ? Math.max(0, sel - 1) : Math.min(DISCS.length - 1, sel + 1);
			if (sel === old) continue;
			if (sel < top) top = sel;
			if (sel >= top + BAG_ROWS) top = sel - BAG_ROWS + 1;
			if (top !== oldTop) drawBagList(order, top, sel);
			else { drawBagRow(order, old, top, sel); drawBagRow(order, sel, top, sel); }
		}
		else if (isLeft(k) || isRight(k) || ku === "R") {
			if (ku === "R") bagSort.rev = !bagSort.rev;
			else { bagSort.col = (bagSort.col + (isLeft(k) ? BAG_COLS.length - 1 : 1)) % BAG_COLS.length; bagSort.rev = false; }
			var disc = order[sel];                  // keep the same disc selected, scrolled into view
			order = bagOrder();
			sel = order.indexOf(disc);
			top = clamp(top, Math.max(0, sel - BAG_ROWS + 1), sel);
			drawBagSort();
			drawBagList(order, top, sel);
		}
		else if (k === " " || k === "\r") {
			var nm = DISCS[order[sel]].name, at = player.bag.indexOf(nm);
			if (at >= 0) { if (player.bag.length > 1) player.bag.splice(at, 1); }
			else if (player.bag.length < BAG_MAX) player.bag.push(nm);
			bagChanged();
			drawBagTitle();
			drawBagRow(order, sel, top, sel);
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
		"            the yellow: early pulls to your fade side, late pushes away.",
		"\x01h\x01cDiscs\x01n       1-8 or ~D picks a disc. Fast discs fly far but need arm speed.",
		"            On the map, \x01h\x01c\xE9\x01n is where a perfect 100% throw lands, no wind; dots",
		"            trace its flight, obstacles on red (Player setup can hide them).",
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
