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

var TITLE_ITEMS = ["~Play a round", "Player ~setup", "Your ~bag & disc catalog", "House ~rules", "~How to play", "~Quit"];
var titleSel = 0;           // stays where it was when you come back to the title screen

// One menu row: highlighted like the setup screen's answers, with its hotkey when it isn't
function drawTitleItem(i, on) {
	var lab = " " + TITLE_ITEMS[i] + " ";
	out(moveTo(16, 15 + i) + text(on ? ">" : " ", 14) + text(" ", 7) + ca(on ? lab.replace("~", "") : lab, on ? 0x4F : 7)[0] + setAttr(7));
}

// Up/Down moves and ENTER or SPACE picks; the letters pick straight away. Returns the item's letter.
function titleScreen() {
	cls();
	bigText("DISC GOLF", 17, 2, [14, 11]);
	put(17, 8, "\x01n\x01k\x01h" + new Array(47).join("\xC4"));
	put(17, 9, "\x01nA 3-click swing meter disc golf emulator");
	put(17, 11, "\x01hCourses \x01n" + courseOrder().length + " \x01k\x01h- pick one when you play");   // not counting traced versions
	put(17, 12, "\x01hPlayer  \x01h\x01c" + player.name);
	put(17, 13, "\x01n        " + handName(player.hand) + "-handed, " + styleName(player.style).toLowerCase() + " thrower (" + level().name.toLowerCase() + ")");
	var i, n = TITLE_ITEMS.length;
	for (i = 0; i < n; i++) drawTitleItem(i, i === titleSel);
	var hr = houseRows(house, 76);
	for (i = 0; i < hr.length; i++) put(3, 23 + i, hr[i], 76);
	if (notice) { put(17, 14, notice, 62); notice = ""; }
	put(19, 22, "\x01n\x01hUp/Down\x01n move   \x01hENTER\x01n choose");
	for (;;) {
		var k = key(), ku = k.toUpperCase(), old = titleSel;
		if (!k) return "";                                   // hung up: back to the main loop
		if (k === "\r" || k === " ") return hotkeyOf(TITLE_ITEMS[titleSel]);
		for (i = 0; i < n; i++) if (hotkeyOf(TITLE_ITEMS[i]) === ku) { titleSel = i; return ku; }
		if (isUp(k)) titleSel = (titleSel + n - 1) % n;
		else if (isDown(k)) titleSel = (titleSel + 1) % n;
		if (titleSel !== old) { drawTitleItem(old, false); drawTitleItem(titleSel, true); }
	}
}

// ---- Course menu ------------------------------------------------------------------
// Opened by Play: a scrolling list of every course. Up/Down moves (the list
// scrolls when there are more than fit), ENTER or SPACE picks. Left/Right picks what the
// list is sorted by and R reverses it, as on the bag screen; the sort lasts until the player
// hangs up. Returns the course's index in COURSES, or -1 to go back to the title screen. The
// last course played starts highlighted.
//
// A course can have a photo-traced version: a second COURSES entry with traced: true and of: the
// course's name. It isn't a row of its own; the course's row shows which version is picked
// (Drawn or Photo-accurate) and V switches it, like D cycles discs. ENTER plays that version.
var COURSE_ROWS = 5;        // courses shown at once, 3 screen rows each
var COURSE_COLS = [         // label, sort value, sort order names (low first, high first)
	{ h: "NAME",  v: function (C) { return sortName(C.name); }, dir: ["A to Z", "Z to A"] },
	{ h: "CITY",  v: function (C) { return sortName(courseWhere(C)[1]); }, dir: ["A to Z", "Z to A"] },
	{ h: "STATE", v: function (C) { return courseWhere(C)[2] || "\xFF"; }, dir: ["A to Z", "Z to A"] },   // no state: after the states
	{ h: "COUNTRY", v: function (C) { return C.country.toUpperCase(); }, dir: ["A to Z", "Z to A"] },
	{ h: "UDISC RATING", v: function (C) { return -C.rating; }, dir: ["high to low", "low to high"] }
];
var courseSort = { col: 0, rev: false };
var courseTraced = {};      // course index -> true when its photo-traced version is picked

// The index of course i's photo-traced version, or -1
function tracedOf(i) {
	for (var j = 0; j < COURSES.length; j++) if (COURSES[j].of === COURSES[i].name) return j;
	return -1;
}
// The course a traced version belongs to (or i itself)
function baseOf(i) {
	if (!COURSES[i] || !COURSES[i].of) return i;
	for (var j = 0; j < COURSES.length; j++) if (COURSES[j].name === COURSES[i].of) return j;
	return i;
}
// The version of course i the list would play
function pickedVersion(i) { var t = tracedOf(i); return courseTraced[i] && t >= 0 ? t : i; }

// [the place, city, state] from a course's where, which ends in ", City, ST" (outside the USA, ", City")
function courseWhere(C) {
	var p = C.where.split(", ");
	return C.country === "USA" ? p.slice(-3) : [p[0], p[p.length - 1], ""];
}

// COURSES indices in the current sort order. Ties go by name, A to Z.
function courseOrder() {
	var c = COURSE_COLS[courseSort.col], order = [], i;
	for (i = 0; i < COURSES.length; i++) if (!COURSES[i].of) order.push(i);   // traced versions share their course's row
	order.sort(function (a, b) {
		var x = c.v(COURSES[a]), y = c.v(COURSES[b]);
		if (x !== y) return (x < y ? -1 : 1) * (courseSort.rev ? -1 : 1);
		return sortName(COURSES[a].name) < sortName(COURSES[b].name) ? -1 : 1;
	});
	return order;
}

// on: the row is highlighted (only then does it say V switches the version)
function courseLines(i, on) {
	var C = COURSES[pickedVersion(i)], par = 0, len = 0;
	for (var h = 0; h < C.holes.length; h++) { par += C.holes[h].par; len += C.holes[h].ft; }
	var version = tracedOf(i) < 0 ? "" : "   \x01h\x01g" + (C.traced ? "Photo-accurate" : "Drawn") + (on ? "  \x01n\x01k\x01h(V switches)" : "");
	return ["\x01h\x01w" + COURSES[i].name + "  \x01n\x01k\x01h" + C.where + ", " + C.country,
		"\x01n" + C.holes.length + " holes   par " + par + "   " + String(len).replace(/\B(?=(\d{3})+$)/g, ",") + " ft   UDisc " + C.rating.toFixed(1) + version];
}

// Row i of the list (an index into order)
function drawCourseRow(order, i, top, on) {
	var y = 5 + (i - top) * 3, L = courseLines(order[i], on);
	put(3, y, (on ? "\x01h\x01c> " : "  ") + L[0], 76);
	put(5, y + 1, L[1], 72);
}

// The visible window of courses, starting at top, with "more" hints above and below
function drawCourseList(order, top, sel) {
	var n = Math.min(COURSE_ROWS, order.length);
	for (var i = top; i < top + n; i++) drawCourseRow(order, i, top, i === sel);
	put(5, 4, top > 0 ? "\x01n\x01k\x01h(more above)" : "", 20);
	put(5, 5 + n * 3 - 1, top + n < order.length ? "\x01n\x01k\x01h(more below)" : "", 20);
}

// The keys line. Version is dimmed when the highlighted course has only one version.
function drawCourseKeys(y, versions) {
	put(3, y, "\x01n\x01hUp/Down\x01n move  \x01hENTER\x01n play  \x01hLeft/Right\x01n sort by  " +
		(versions ? "~Version" : "\x01n\x01k\x01hVersion\x01n") + "  ~Reverse  ~Quit back", 76);
}

// What the list can sort by, with the current one lit, and which way it's sorted
function drawCourseSort() {
	var s = "\x01n\x01k\x01hSort by  ";
	for (var i = 0; i < COURSE_COLS.length; i++) s += (i === courseSort.col ? "\x01h\x01c" : "\x01n\x01k\x01h") + COURSE_COLS[i].h + "  ";
	put(3, 3, s + "\x01n\x01k\x01h(" + COURSE_COLS[courseSort.col].dir[courseSort.rev ? 1 : 0] + ")", 76);
}

function courseMenu() {
	if (COURSES.length === 1) return 0;
	var last = baseOf(player.course);
	if (last !== player.course) courseTraced[last] = true;   // last played the traced version: start on it
	var order = courseOrder(), sel = Math.max(0, order.indexOf(last)), total = order.length;
	var n = Math.min(COURSE_ROWS, total);
	var top = clamp(sel - n + 1, 0, total - n);
	cls();
	put(3, 2, "\x01h\x01wCHOOSE A COURSE  \x01n\x01k\x01h" + total + " courses");
	drawCourseSort();
	drawCourseList(order, top, sel);
	var keysY = 6 + n * 3;
	drawCourseKeys(keysY, tracedOf(order[sel]) >= 0);
	for (;;) {
		var k = key(), ku = k.toUpperCase();
		if (k === "\r" || k === " ") return pickedVersion(order[sel]);
		if (ku === "V" && tracedOf(order[sel]) >= 0) {
			courseTraced[order[sel]] = !courseTraced[order[sel]];
			drawCourseRow(order, sel, top, true);
			continue;
		}
		if (ku === "Q" || k === "\x1b") return -1;
		if (ku === "R" || isLeft(k) || isRight(k)) {
			if (ku === "R") courseSort.rev = !courseSort.rev;
			else { courseSort.col = (courseSort.col + (isLeft(k) ? COURSE_COLS.length - 1 : 1)) % COURSE_COLS.length; courseSort.rev = false; }
			var cur = order[sel];                   // keep the same course selected, scrolled into view
			order = courseOrder();
			sel = order.indexOf(cur);
			top = clamp(top, Math.max(0, sel - n + 1), sel);
			drawCourseSort();
			drawCourseList(order, top, sel);
		}
		else if (isUp(k) || isDown(k)) {
			var old = sel, oldTop = top;
			sel = (sel + (isUp(k) ? total - 1 : 1)) % total;
			if (sel < top) top = sel;
			if (sel >= top + n) top = sel - n + 1;
			if (top !== oldTop) drawCourseList(order, top, sel);
			else { drawCourseRow(order, old, top, false); drawCourseRow(order, sel, top, true); }
			if ((tracedOf(order[old]) >= 0) !== (tracedOf(order[sel]) >= 0)) drawCourseKeys(keysY, tracedOf(order[sel]) >= 0);
		}
	}
}

// ---- Player setup -----------------------------------------------------------------
// Every question at once. Up/Down picks a question, Left/Right changes its answer, and its
// letters pick an answer and move on to the next question. ENTER (or Continue at the bottom)
// is done. Answers take effect as they change.
// The same screen does house rules (HOUSE_FORM). A form is { x: the answers' column, goY: the
// Continue button's row, rows }. A row is { y, q, get, set, note } plus either opts (answers:
// [value, "~Label"]) or num ({ min, max, label(value) }: Left/Right counts up and down).
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
			return ["\x01h\x01c" + styleName(player.style) + ".\x01n \x01k\x01hOn any shot, H switches hands and T cycles BH/FH/tomahawk.",
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
var SETUP_FORM = { x: 36, goY: 20, rows: SETUP };

function hotkeyOf(label) { return label.charAt(label.indexOf("~") + 1).toUpperCase(); }

// Row i of form F (F.rows.length: the Continue button). The answer is highlighted: white on blue
// on the question you're on, black on gray on the others. Hotkeys show only where they work.
function drawFormRow(F, i, focus) {
	var mark = text(focus ? ">" : " ", 14) + text(" ", 7);
	if (i === F.rows.length) { out(moveTo(2, F.goY) + mark + text(" Continue ", focus ? 0x4F : 0x70) + setAttr(7)); return; }
	var row = F.rows[i], cur = row.get(), s = moveTo(2, row.y) + mark + ca(row.q, focus ? 15 : 7)[0], col = F.x, j;
	s += text(blank(F.x - 4 - row.q.length), 7);
	if (row.num) {                       // a number: < 8 discs + putter >
		var lab = " " + row.num.label(cur) + " ";
		s += text(focus && cur > row.num.min ? "<" : " ", 14) + text(lab, focus ? 0x4F : 0x70) + text(focus && cur < row.num.max ? ">" : " ", 14);
		col += lab.length + 2;
	}
	else for (j = 0; j < row.opts.length; j++) {
		var lab2 = " " + row.opts[j][1] + " ", on = row.opts[j][0] === cur;
		if (on) s += ca(lab2.replace("~", ""), focus ? 0x4F : 0x70)[0];
		else s += ca(focus ? lab2 : lab2.replace("~", ""), focus ? 7 : 8)[0];
		s += text(" ", 7);
		col += lab2.length;             // the ~ isn't shown; the space after is
	}
	out(s + text(blank(SCR_W - col), 7));
	var notes = row.note();
	for (j = 0; j < 2; j++) put(6, row.y + 1 + j, notes[j] || "", 74);
}

// Up/Down picks a question, Left/Right changes its answer, a letter picks an answer and moves on.
// Returns on ENTER or ESC. Answers take effect as they change.
function runForm(F) {
	var n = F.rows.length, f = 0, i;
	for (i = 0; i <= n; i++) drawFormRow(F, i, i === f);
	for (;;) {
		var k = key(), ku = k.toUpperCase(), row = F.rows[f], old = f, changed = false, j, hit = -1;
		if (!k || k === "\r" || k === "\x1b") return;
		if (row && row.opts) for (j = 0; j < row.opts.length; j++) if (hotkeyOf(row.opts[j][1]) === ku) hit = j;
		if (hit >= 0) { row.set(row.opts[hit][0]); changed = true; f++; }     // letters before arrows: L is also Right (isRight)
		else if (isUp(k)) f = Math.max(0, f - 1);
		else if (isDown(k)) f = Math.min(n, f + 1);
		else if (row && row.num && (isLeft(k) || isRight(k))) {
			var v = clamp(row.get() + (isLeft(k) ? -1 : 1), row.num.min, row.num.max);
			if (v !== row.get()) { row.set(v); changed = true; }
		}
		else if (row && (isLeft(k) || isRight(k))) {
			for (j = 0; j < row.opts.length; j++) if (row.opts[j][0] === row.get()) break;
			j = clamp(j + (isLeft(k) ? -1 : 1), 0, row.opts.length - 1);
			if (row.opts[j][0] !== row.get()) { row.set(row.opts[j][0]); changed = true; }
		}
		if (changed) { for (i = 0; i <= n; i++) drawFormRow(F, i, i === f); }   // one answer's note can depend on another
		else if (f !== old) { drawFormRow(F, old, false); drawFormRow(F, f, true); }
	}
}

function setup(first) {
	cls();
	put(3, 2, "\x01h\x01wPLAYER SETUP");
	put(3, 3, "\x01n\x01k\x01h" + (!player.canSave ? (player.handle ? "The save server isn't answering: these settings won't be saved."
		: "Settings aren't saved on the web version.")
		: (first ? "A few questions before you head to the first tee. Saved for next time." : "Changes are saved for next time.")), 76);
	put(3, 22, "\x01n\x01hUp/Down\x01n pick a question   \x01hLeft/Right\x01n or a letter: answer   \x01hENTER\x01n continue", 76);
	runForm(SETUP_FORM);
}

// ---- House rules ---------------------------------------------------------------------
// The rules the next round is played by (house in state.js); each round keeps its own copy.
var HOUSE_FORM = { x: 24, goY: 22, rows: [
	{ y: 4, q: "Out of bounds", opts: [[true, "~Penalty stroke"], [false, "~No penalty"]],
		get: function () { return house.obPenalty; }, set: function (v) { house.obPenalty = v; },
		note: function () {
			return house.obPenalty ? ["\x01h\x01cPenalty stroke.\x01n \x01k\x01hOB costs +1; play from where it went out (PDGA)."]
				: ["\x01h\x01cNo penalty.\x01n \x01k\x01hOB costs nothing: just play from where it went out."];
		} },
	{ y: 7, q: "Optional relief", opts: [[true, "~Costs a stroke"], [false, "~Free"]],
		get: function () { return house.reliefStroke; }, set: function (v) { house.reliefStroke = v; },
		note: function () {
			return house.reliefStroke ? ["\x01h\x01cCosts a stroke.\x01n \x01k\x01hR on a shot moves you back along the line for +1 (PDGA)."]
				: ["\x01h\x01cFree.\x01n \x01k\x01hR on a shot moves you back along the line, no stroke added."];
		} },
	{ y: 10, q: "Bag size", num: { min: 0, max: BAG_MOST, label: function (v) { return v ? (v + 1) + " discs (" + v + " + putter)" : "1 disc (putter only)"; } },
		get: function () { return house.bagSize; }, set: function (v) { house.bagSize = v; },
		note: function () {
			var over = bagOthers() - house.bagSize;
			return [house.bagSize ? "\x01h\x01c" + (house.bagSize + 1) + " discs.\x01n \x01k\x01hOne is always your putter. Standard is " + (HOUSE_DEFAULT.bagSize + 1) + ", up to " + (BAG_MOST + 1) + "."
				: "\x01h\x01cPutter only.\x01n \x01k\x01hEvery throw with your putter, tee to basket.",
				over > 0 ? "\x01h\x01yYour bag is " + over + " over: the fastest " + (over > 1 ? over + " discs come" : "disc comes") + " out when you continue." : ""];
		} },
	{ y: 13, q: "Mulligans", opts: [[0, "~None"], [1, "~One"], [2, "~Two"]],
		get: function () { return house.mulligans; }, set: function (v) { house.mulligans = v; },
		note: function () {
			return house.mulligans ? ["\x01h\x01c" + house.mulligans + (house.mulligans > 1 ? " mulligans " : " mulligan ") + mullPerName(house.mullPer) + ".\x01n \x01k\x01hAfter a throw, M takes it back to throw again.", "\x01k\x01hNot on putts."]
				: ["\x01h\x01cNone.\x01n \x01k\x01hEvery throw counts."];
		} },
	{ y: 16, q: "Mulligans are", opts: [[9, "per ~9 holes"], [18, "per 1~8"], [27, "per 2~7"], [0, "per ~round"]],
		get: function () { return house.mullPer; }, set: function (v) { house.mullPer = v; },
		note: function () {
			if (!house.mulligans) return ["\x01k\x01hNo mulligans, so this doesn't matter."];
			return [house.mullPer ? "\x01h\x01cPer " + house.mullPer + " holes.\x01n \x01k\x01hHoles 1-" + house.mullPer + " get " + house.mulligans + ", the next " + house.mullPer + " get " + house.mulligans + " more, and so on."
				: "\x01h\x01cPer round.\x01n \x01k\x01h" + house.mulligans + " for the whole round, however many holes it has."];
		} },
	{ y: 19, q: "Wind", opts: [["calm", "~Calm"], ["normal", "~Normal"], ["windy", "~Windy"]],
		get: function () { return house.wind; }, set: function (v) { house.wind = v; },
		note: function () {
			var w = WINDS[house.wind];
			return ["\x01h\x01c" + house.wind.charAt(0).toUpperCase() + house.wind.slice(1) + ".\x01n \x01k\x01h" +
				(w[1] ? "Each hole gets a wind of " + w[0] + "-" + w[1] + " mph." : "No wind on any hole.")];
		} }
] };

// After it, the bag is cut down to the new size if it has to be, and changes are saved
function houseRules() {
	cls();
	put(3, 1, "\x01h\x01wHOUSE RULES  \x01n\x01k\x01hThe rules your rounds are played by.", 76);
	put(3, 2, "\x01n\x01k\x01h" + (player.canSave ? "Changes are saved for next time." : "Not saved: " +
		(player.handle ? "the save server isn't answering." : "settings aren't saved on the web version.")), 76);
	put(3, 24, "\x01n\x01hUp/Down\x01n pick a rule   \x01hLeft/Right\x01n or a letter: change   \x01hENTER\x01n continue", 76);
	var before = JSON.stringify(house), bagBefore = player.bag.join("|");
	runForm(HOUSE_FORM);
	var removed = fitBag(house.bagSize), names = [], i;
	for (i = 0; i < removed.length; i++) names.push(discLabel(bagDisc(removed[i])));
	if (names.length) notice = "\x01h\x01yTook out of your bag: " + (names.length > 2 ? names.length + " discs, fastest first" : names.join(", "));
	if (!player.canSave || (JSON.stringify(house) === before && player.bag.join("|") === bagBefore)) return;
	if (!saveSettings(["house", "bag"])) notice = "\x01h\x01yCouldn't save: the save server didn't answer.";
	else if (!names.length) notice = "\x01h\x01gHouse rules saved for next time.";
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
var PUTT_VIEW_NAMES = { top: "Overhead", pov: "From the player" };

function welcomeBack() {
	cls();
	put(3, 2, "\x01h\x01wWELCOME BACK, " + player.name.toUpperCase());
	put(3, 3, "\x01n\x01k\x01hYour saved settings");
	var rows = [["Hand", handName(player.hand) + "-handed"], ["Usual throw", styleName(player.style)],
		["Level", level().name], ["Flight path", player.flightPath ? "Shown" : "Hidden"],
		["Putting view", PUTT_VIEW_NAMES[player.puttView]], ["House rules", houseChanges(house).join(", ") || "Standard"]], i, j;
	for (i = 0; i < rows.length; i++) put(5, 5 + i, "\x01n\x01k\x01h" + pad(rows[i][0], 14) + "\x01n" + rows[i][1], 74);
	var bag = [], line = "";                  // the bag, wrapped to fit in 4 rows
	var discs = bagDiscs();
	for (i = 0; i < discs.length; i++) {
		var add = (line ? ", " : "") + discLabel(discs[i]);
		if (line && line.length + add.length > (bag.length === 3 ? 44 : 58)) {   // the last row keeps room for "and N more"
			if (bag.length === 3) { line += ", and " + (discs.length - i) + " more"; break; }
			bag.push(line + ","); line = discLabel(discs[i]);
		}
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
	put(3, 1, "\x01h\x01wYOUR BAG & DISC CATALOG  \x01n\x01k\x01h(" + player.bag.length + (bagPutters() ? " of " : "/") + (house.bagSize + 1) +
		(bagPutters() ? ")" : ", \x01h\x01rno putter\x01n\x01k\x01h)"), 43);
}

// Column headers with the sorted one lit, and how it's sorted
function drawBagSort() {
	var s = "\x01n\x01k\x01h   ";
	for (var i = 0; i < BAG_COLS.length; i++)
		s += (i === bagSort.col ? "\x01h\x01c" : "\x01n\x01k\x01h") + pad(BAG_COLS[i].h, BAG_COLS[i].w);
	s += "\x01n\x01k\x01h  IN BAG (g)";
	put(3, 2, s, 77);
	var c = BAG_COLS[bagSort.col];
	put(47, 1, "\x01n\x01k\x01hSorted by \x01h\x01c" + c.h.toLowerCase() + "\x01n\x01k\x01h, " + c.dir[bagSort.rev ? 1 : 0], 33);
}

// Row i of the list (an index into order)
function drawBagRow(order, i, top, sel) {
	var d = DISCS[order[i]], inBag = false, wts = "", j;
	for (j = 0; j < WEIGHTS.length; j++) {          // the weights of this disc in the bag, lit
		var has = player.bag.indexOf(bagKey(d.name, WEIGHTS[j])) >= 0;
		if (has) inBag = true;
		wts += (has ? "\x01h\x01g" : "\x01n\x01k\x01h") + WEIGHTS[j] + " ";
	}
	var line = (inBag ? "\x01h\x01g\xFE " : "\x01n\x01k\x01h\xFA ") + (i === sel ? "\x01h\x01w" : "\x01n") +
		pad(d.name, 14) + pad(d.maker, 15) + pad(TYPE_NAME[d.type], 11) +
		pad(String(d.n[0]), 6) + pad(String(d.n[1]), 6) + pad(String(d.n[2]), 5) + pad(String(d.n[3]), 4) + "  " + wts;
	put(3, 3 + i - top, (i === sel ? "\x01h\x01c>" : " ") + line, 77);
}

function drawBagList(order, top, sel) {
	for (var i = top; i < Math.min(DISCS.length, top + BAG_ROWS); i++) drawBagRow(order, i, top, sel);
}

// SPACE: add the disc at max weight, or take every copy of it out. 1 2 3: add or remove the
// Light / Mid / Max copy (the same mold can be in the bag at more than one weight).
// The putter has its own slot: the other discs never go past the house rules' bag size, and a
// putter always fits when the bag has none. (The screen can't be left without a putter.)
// Returns why it couldn't, or what's missing, or "".
function toggleBag(name, k) {
	var keys = [], j, at;
	if (k >= "1" && k <= "3") keys.push(bagKey(name, WEIGHTS[Number(k) - 1]));
	else for (j = 0; j < WEIGHTS.length; j++) if (player.bag.indexOf(bagKey(name, WEIGHTS[j])) >= 0) keys.push(bagKey(name, WEIGHTS[j]));
	if (!keys.length) keys.push(bagKey(name, MAX_G));
	at = player.bag.indexOf(keys[0]);
	if (at >= 0) {
		for (j = 0; j < keys.length; j++) {
			at = player.bag.indexOf(keys[j]);
			if (at >= 0) player.bag.splice(at, 1);
		}
	}
	else if ((isPutterKey(keys[0]) && !bagPutters()) || bagOthers() < house.bagSize) player.bag.push(keys[0]);
	else return "Your bag is full (" + (house.bagSize + 1) + " with the putter). House rules sets the size.";
	return bagPutters() ? "" : "No putter in your bag: add one before you leave (every bag needs one).";
}

function bagScreen() {
	var order = bagOrder(), sel = 0, top = 0;
	cls();
	drawBagTitle();
	drawBagSort();
	drawBagList(order, top, sel);
	put(3, 21, "\x01n\x01k\x01hSpeed = how hard it must be thrown. Glide = how long it floats.", 77);
	put(3, 22, "\x01n\x01k\x01hTurn = drift right early (for RH backhand; negative turns more). Fade = hook left at the end.", 77);
	put(3, 23, "\x01n\x01k\x01hWeight: lighter discs are easier to throw far, turn more and feel more wind.", 77);
	put(3, 24, "\x01h\x01cUp/Down\x01n move  \x01h\x01cSPACE\x01n add/remove  \x01h\x01c1 2 3\x01n weight  \x01h\x01cLeft/Right\x01n sort  ~Reverse  ~Quit", 77);
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
		else if (k === " " || k === "\r" || (ku >= "1" && ku <= "3")) {
			put(3, 20, "\x01h\x01y" + toggleBag(DISCS[order[sel]].name, k), 77);
			bagChanged();
			drawBagTitle();
			drawBagRow(order, sel, top, sel);
		}
		else if (ku === "Q" || k === "\x1b") {
			if (bagPutters()) return;
			put(3, 20, "\x01h\x01rYou can't leave without a putter.\x01n\x01h\x01y Pick one (sort by type: putters first).", 77);
		}
		else if (!k) return;                            // hung up
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
		"\x01h\x01cDiscs\x01n       1-9 or ~D picks a disc. Fast discs fly far but need arm speed.",
		"            On the map, \x01h\x01c\xE9\x01n is where a perfect 100% throw lands, no wind; dots",
		"            trace its flight, obstacles on red (Player setup can hide them).",
		"\x01h\x01cWeight\x01n      150, 165 or 175 g (bag screen). Lighter: farther for slow arms,",
		"            more turn, more wind. Heavier holds its line and skips farther.",
		"\x01h\x01cThrows\x01n      ~T cycles backhand, forehand and tomahawk. A tomahawk flies over",
		"            the trees, curls left (righty) and goes about two-thirds as far.",
		"\x01h\x01cHand/Angle\x01n  ~H switches hands (the off hand is weaker). ~A: flat/hyzer/anhyzer.",
		"\x01h\x01cTrees\x01n       In the trees you see the view from your lie. Left/Right picks a",
		"            line; the panel shows the gap. ~Throw adds a pitch-out: short and",
		"            safe, back to the fairway. ~Relief (PDGA optional relief): +1",
		"            throw, move back along the line from the basket.",
		"\x01h\x01cView\x01n        ~V switches between the map and the view from your lie.",
		"\x01h\x01cPutting\x01n     Inside " + ft(PUTT_M) + " ft you putt. ~V: overhead or from the player. Left/Right",
		"            aims off the basket for wind. The meter's small \x01h\x01y\xE8\x01n is the basket.",
		"\x01h\x01cHills\x01n       Downhill throws fly farther; uphill putts need more power.",
		"\x01h\x01cWater\x01n       Dark water: a disc is likely lost for the round (putters never).",
		"\x01n\x01k\x01hMap: \x01h\x01g\xB1\x01n\x01k\x01h fairway  \x01n\x01g\xB0\x01k\x01h rough  \x01h\x01g\xE7\x01n\x01k\x01h tree  \x01h\x01k\xB1\x01n\x01k\x01h road (OB)  \x01n\xB0\x01k\x01h parking (OB)  \x01h\x01y\xE8\x01n\x01k\x01h basket  \x01h\x01w\xFE\x01n\x01k\x01h you"
	];
	for (var i = 0; i < L.length; i++) put(3, 2 + i, L[i], 77);
	waitKey("Press any key");
}
