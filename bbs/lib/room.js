// discgolf.js: The rules of an online round (a room), shared by everything that plays one: the
// server (api/games, which keeps the room and decides whose throw it is), the BBS door, the terminal
// version and the web version. No screen, keys, network or course data here: only the room's state.
// Loaded by ../discgolf.js and by the server (require). ES5 for Synchronet (no let/const/arrows).
//
// A room's state (what the server stores and every player polls):
//   course: COURSES index   holes: how many   rules: the host's house rules (no mulligans online)
//   winds: [{ mph, to, x, y }] one per hole, so everyone plays the same wind
//   hole: the hole being played (0 is the first)   order: slots in tee order for this hole
//   turn: the slot whose throw it is (-1 once the round is over)   turnAt: when that turn began (ms)
//   players: one per slot, as the server's player list:
//     { name, bbs (a BBS login), strokes: [per hole, 0 = not finished], cur: throws on this hole,
//       lie: { x, y } or null (on the tee), dist: meters to the basket or null (on the tee),
//       done: in the basket on this hole, later: skipped once on this hole (throws after the others),
//       gone: left the room, or skipped twice on a hole (passed over until they rejoin) }
//   last: the latest throw, for the others to watch: { slot, hole, kind: "throw" | "putt" | "tap",
//     path: [[x, y], ...], line: what happened (Ctrl-A colors), done: it went in }
//   seq: goes up by one with every change   over: the round is finished
//
// Turn order is the real game's: on the tee, the order of the last hole's scores (honors, lowest
// first; ties keep the order they were in); after that, whoever is farthest from the basket throws.
// A player skipped for taking too long goes to the back of the line on that hole: they keep their lie
// and throw once everyone else is in. Skipped again there, they're out until they rejoin.

"use strict";

var ROOM_MAX_PLAYERS = 6;
var ROOM_MAX_THROWS = 30;        // throws on one hole before the rules stop counting (a stuck player)
var ROOM_SKIP_MS = 3 * 60 * 1000; // a turn this old can be skipped by anyone else in the room
var ROOM_PATH_MAX = 80;           // points kept of a flight, for the others' replay
var ROOM_LINE_MAX = 240;          // characters of a throw's result line

// A fresh round: everyone on the first tee, in the order they joined
function roomNewState(course, holes, rules, winds, names, now) {
	var players = [], order = [], i;
	for (i = 0; i < names.length; i++) {
		players.push(roomNewPlayer(names[i].name, names[i].bbs, holes));
		order.push(i);
	}
	var r = {};
	for (var k in rules) r[k] = rules[k];
	r.mulligans = 0;               // a throw taken back would change whose turn it was
	var st = { v: 1, course: course, holes: holes, rules: r, winds: winds, hole: 0, order: order, turn: 0,
		turnAt: now || 0, players: players, last: null, seq: 1, over: false };
	st.turn = roomNextTurn(st);
	return st;
}

function roomNewPlayer(name, bbs, holes) {
	var s = [];
	for (var h = 0; h < holes; h++) s.push(0);
	return { name: name, bbs: !!bbs, strokes: s, cur: 0, lie: null, dist: null, done: false, later: false, gone: false };
}

// Whose throw it is: the farthest from the basket among those still playing the hole (on the tee
// counts as farthest; ties go by the tee order), the skipped ones (later) only once nobody else is
// left. -1 if nobody is left to throw.
function roomNextTurn(st) {
	for (var pass = 0; pass < 2; pass++) {
		var best = -1, bestD = -1;
		for (var i = 0; i < st.order.length; i++) {
			var s = st.order[i], p = st.players[s];
			if (!p || p.gone || p.done || !!p.later !== (pass === 1)) continue;
			var d = p.dist === null ? 1e9 : p.dist;
			if (d > bestD) { best = s; bestD = d; }
		}
		if (best >= 0) return best;
	}
	return -1;
}

// Everyone still in the room has finished the hole
function roomHoleDone(st) {
	var any = false;
	for (var i = 0; i < st.players.length; i++) {
		var p = st.players[i];
		if (p.gone) continue;
		any = true;
		if (!p.done) return false;
	}
	return any;
}

// After any change: if the hole is finished, record it and move everyone to the next tee
// (or end the round); then work out whose throw it is
function roomAdvance(st, now) {
	var before = st.turn;
	while (roomHoleDone(st) && !st.over) {
		var h = st.hole, i;
		if (h + 1 >= st.holes) { st.over = true; break; }
		// honors: this hole's scores, lowest first; a stable sort keeps ties in the old order
		var ord = st.order.slice(), sc = function (s) { var p = st.players[s]; return p.gone ? 999 : p.strokes[h] || 999; };
		for (i = 1; i < ord.length; i++) {
			var x = ord[i], j = i - 1;
			while (j >= 0 && sc(ord[j]) > sc(x)) { ord[j + 1] = ord[j]; j--; }
			ord[j + 1] = x;
		}
		st.order = ord;
		st.hole = h + 1;
		for (i = 0; i < st.players.length; i++) {
			var p = st.players[i];
			p.cur = 0; p.lie = null; p.dist = null; p.done = false; p.later = false;
		}
	}
	st.turn = st.over ? -1 : roomNextTurn(st);
	if (st.turn === -1 && !st.over) st.over = true;     // everyone left
	if (st.turn !== before || st.turn === -1) st.turnAt = now || 0;
	st.seq++;
	return st;
}

function roomNum(v, lo, hi) { return typeof v === "number" && isFinite(v) && v >= lo && v <= hi; }

// A throw's result line, safe to show on a terminal: printable characters and Ctrl-A colors only
function roomCleanLine(s) {
	s = String(s || "").replace(/\x01[^krgybmcwhn]/gi, "").replace(/[^\x01\x20-\x7e\x80-\xfe]/g, "");
	return s.length > ROOM_LINE_MAX ? s.substr(0, ROOM_LINE_MAX) : s;
}

// The player in slot `slot` pushes their throw. me: { cur, lie, dist, done } after it; last: { kind,
// path, line }. Checks it's their turn and that it adds up, then moves the room on. Returns "" or why not.
function roomApply(st, slot, me, last, now) {
	if (st.over) return "The round is over";
	if (slot !== st.turn) return "Not your turn";
	var p = st.players[slot];
	if (!me || typeof me !== "object") return "Missing your throw";
	if (!roomNum(me.cur, p.cur + 1, Math.min(p.cur + 4, ROOM_MAX_THROWS + 4)) || Math.floor(me.cur) !== me.cur) return "Bad throw count";
	var done = !!me.done || me.cur >= ROOM_MAX_THROWS;
	if (!done) {
		if (!me.lie || !roomNum(me.lie.x, -500, 2000) || !roomNum(me.lie.y, -500, 2000)) return "Bad lie";
		if (!roomNum(me.dist, 0, 2000)) return "Bad distance";
	}
	var kinds = { "throw": 1, "putt": 1, "tap": 1 }, l = last || {};
	var path = [];
	if (l.path && l.path.length) {
		var step = Math.max(1, Math.ceil(l.path.length / ROOM_PATH_MAX));
		for (var i = 0; i < l.path.length; i += step) {
			var q = l.path[i];
			if (q && roomNum(q[0], -500, 2000) && roomNum(q[1], -500, 2000)) path.push([Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10]);
		}
		var e = l.path[l.path.length - 1];
		if (e && roomNum(e[0], -500, 2000) && roomNum(e[1], -500, 2000)) path.push([Math.round(e[0] * 10) / 10, Math.round(e[1] * 10) / 10]);
	}
	p.cur = me.cur;
	p.done = done;
	p.later = false;               // back from a skip: they're throwing again
	p.lie = done ? null : { x: Math.round(me.lie.x * 100) / 100, y: Math.round(me.lie.y * 100) / 100 };
	p.dist = done ? 0 : Math.round(me.dist * 100) / 100;
	if (done) p.strokes[st.hole] = p.cur;
	st.last = { slot: slot, hole: st.hole, kind: kinds[l.kind] ? l.kind : "throw", path: path,
		line: roomCleanLine(l.line), done: done, seq: st.seq + 1 };
	roomAdvance(st, now);
	return "";
}

// A player leaves (or is skipped for taking too long): their scores stay, they throw no more
function roomLeave(st, slot, now) {
	var p = st.players[slot];
	if (!p || p.gone) return st;
	p.gone = true;
	return roomAdvance(st, now);
}

// The player whose turn it is took too long (the server checks how long): the first time on a hole
// they go to the back of the line, keeping their lie; the second time they're out until they rejoin.
// Either way their clock starts again, so a turn that comes straight back gets its full time.
// Returns "later" or "out".
function roomSkip(st, slot, now) {
	var p = st.players[slot];
	if (!p || p.gone) return "";
	var how = p.later ? "out" : "later";
	if (how === "out") { p.later = false; p.gone = true; }
	else p.later = true;
	roomAdvance(st, now);
	st.turnAt = now || 0;
	return how;
}

// A player who left comes back by rejoining: they play on from the next hole
function roomRejoin(st, slot, now) {
	var p = st.players[slot];
	if (!p || !p.gone || st.over) return st;
	p.gone = false;
	p.done = true;                 // sits out the rest of this hole
	if (!p.strokes[st.hole]) p.strokes[st.hole] = 0;
	return roomAdvance(st, now);
}

// Total strokes and how many holes a player has finished
function roomTotals(st, slot) {
	var p = st.players[slot], t = 0, n = 0;
	for (var h = 0; h < p.strokes.length; h++) if (p.strokes[h]) { t += p.strokes[h]; n++; }
	return { total: t, holes: n };
}

if (typeof module !== "undefined" && module.exports) {
	module.exports = { ROOM_MAX_PLAYERS: ROOM_MAX_PLAYERS, ROOM_MAX_THROWS: ROOM_MAX_THROWS, ROOM_SKIP_MS: ROOM_SKIP_MS,
		roomNewState: roomNewState, roomNextTurn: roomNextTurn, roomAdvance: roomAdvance, roomApply: roomApply,
		roomLeave: roomLeave, roomSkip: roomSkip, roomRejoin: roomRejoin, roomTotals: roomTotals, roomCleanLine: roomCleanLine };
}
