// discgolf.js: Online rounds. Players on the BBS, the terminal version and the web version join the
// same rooms (as IC Zombies' online games): the host makes a room and gets a 4-character code, the
// others join with it, the host starts the round, and everyone polls the room every 1.5 s. Who
// throws when is room.js's (the real game's order); the server keeps the room (api/games.js).
// Loaded by ../discgolf.js. ES5 for Synchronet (no let/const/arrows).
//
// The first part sets a round up from the room (the web version uses it too); the rest is the door's
// screens and its network calls (Synchronet's HTTPRequest, or the terminal version's http_call).

"use strict";

// The online round being played: { code, playerId, hostId (the host only), name, slot, st (the room's
// state), seen (the last state's seq shown), bagBefore }
var ONLINE = null;
var ROOM_POLL_MS = 1500;

// ---- Setting a round up from the room (shared with the web version) ----------------------------

// The slot playing under name (each name in a room is different: see api/games.js), or -1
function onlineSlotOf(players, name) {
	for (var i = 0; i < players.length; i++) if (players[i].name === name) return i;
	return -1;
}

// The host rolls every hole's wind before the round, so everyone plays the same ones
function onlineWinds(windName, holes) {
	var keep = R, w = [];
	R = { rules: { wind: windName } };
	for (var i = 0; i < holes; i++) { var x = newWind(); w.push({ mph: x.mph, to: x.to, x: Math.round(x.x * 1000) / 1000, y: Math.round(x.y * 1000) / 1000 }); }
	R = keep;
	return w;
}

// The round, by the room's rules (the host's house rules). Your bag is cut to the room's bag size
// for the round only, and comes back as it was at the end (onlineEndRound).
function onlineStartRound(st) {
	ONLINE.bagBefore = player.bag.slice();
	var keep = house;
	house = copyHouse(st.rules);
	startRound(COURSES[st.course]);
	house = keep;
	return R;
}

function onlineEndRound() {
	if (R) endRound();
	if (ONLINE && ONLINE.bagBefore) { player.bag = ONLINE.bagBefore; ONLINE.bagBefore = null; bagChanged(); }
}

// The room's hole: its wind, and where you are on it (after a rejoin, partway through)
function onlineStartHole(st) {
	startHole(st.hole);
	var w = st.winds[st.hole], me = st.players[ONLINE.slot];
	S.wind = { mph: w.mph, to: w.to, x: w.x, y: w.y };
	for (var h = 0; h < st.hole; h++) R.strokes[h] = me.strokes[h] || 0;
	S.strokes = me.cur;
	if (me.lie) {
		S.lie = { x: me.lie.x, y: me.lie.y };
		S.aim = { x: S.H.basket.x, y: S.H.basket.y };
		autoPickDisc();
	}
	if (me.done) S.lie = { x: S.H.basket.x, y: S.H.basket.y };
	return S;
}

// Your throw as the room takes it (room.js's roomApply)
function onlineMe(done) {
	return done ? { cur: S.strokes, done: true } : { cur: S.strokes, lie: { x: S.lie.x, y: S.lie.y }, dist: pinDist(), done: false };
}

function onlinePath(points) {
	var p = [];
	for (var i = 0; i < points.length; i++) p.push([points[i].x, points[i].y]);
	return p;
}

// A putt's path on the ground, for the others to watch (as the web version draws it): from the lie to
// where it stopped. res is what takePutt returned; dist the putt's length before it.
function onlinePuttPath(res, dist) {
	var pts = [], n = 20, uEnd = res.made ? 1 : 1 - res.along / Math.max(dist, 0.5);
	for (var i = 0; i <= n; i++) {
		var u = uEnd * i / n;
		pts.push(puttWorld(u, res.kind === "cage" && u > 0.9 ? res.lateral : puttLat(u)));
	}
	return pts;
}

function onlineName(st, slot) { return slot >= 0 && st.players[slot] ? st.players[slot].name : "nobody"; }

// A name without its "(web)" tag, for a narrow column: "Bob (web)" is "Bob", and "Bob (web01)", the second
// Bob on the web, is "Bob 2" (api/_names.js's webName numbers them)
function onlineShortName(name) {
	var m = /^(.*) \(web(\d*)\)$/.exec(String(name));
	return m ? m[1] + (m[2] ? " " + (Number(m[2]) + 1) : "") : String(name);
}

// The server's clock: every answer carries its time (now), so a turn's age doesn't depend on this
// machine's clock being right. ONLINE.skew is the server's time less ours.
function onlineClock(data) { if (ONLINE && data && typeof data.now === "number") ONLINE.skew = data.now - Date.now(); }
function onlineTurnAge(st) { return st.turnAt ? Date.now() + ((ONLINE && ONLINE.skew) || 0) - st.turnAt : 0; }

// ---- The door: network ------------------------------------------------------------------------
// One request to the room server: { code, data }, or null if it didn't answer. The terminal version
// has no HTTPRequest, so it passes its own http_call (scripts/runtime.js), which goes to the site.
function roomCall(method, path, body) {
	if (typeof http_call === "function") return http_call(method, path, body);
	var cfg = roomConfig();
	if (!cfg) return null;
	try {
		if (typeof HTTPRequest === "undefined") load("http.js");
		var hdr = cfg.key ? { "X-Door-Key": cfg.key } : {};
		var req = new HTTPRequest(undefined, undefined, hdr, 8);
		var text = method === "POST"
			? req.Post(cfg.url + path, JSON.stringify(body || {}), undefined, undefined, "application/json")
			: req.Get(cfg.url + path);
		var data = null;
		try { data = JSON.parse(text); } catch (e) { }
		return { code: req.response_code, data: data };
	} catch (e) {
		log("discgolf: room server: " + e);
		return null;
	}
}

// The server's address and the door key (ctrl/discgolf.ini, as the saves: see saves.js), and the
// site's address for invite links ([api] site)
var roomCfg = null;
function roomConfig() {
	if (roomCfg !== null) return roomCfg;
	roomCfg = false;
	// only on a BBS: the terminal version has its own http_call (and the browser's File is something else)
	if (typeof http_call === "function" || typeof File === "undefined" || typeof system === "undefined" || !system.ctrl_dir) return roomCfg;
	var url = "http://127.0.0.1:3002", key = "", site = SITE_URL;
	var f = new File(system.ctrl_dir + "discgolf.ini");
	if (f.open("r")) {
		url = f.iniGetValue("api", "url", url); key = f.iniGetValue("api", "key", ""); site = f.iniGetValue("api", "site", site);
		f.close();
	}
	roomCfg = { url: String(url).replace(/\/+$/, ""), key: String(key), site: String(site).replace(/\/+$/, "") };
	return roomCfg;
}

// The site's address for invite links: the BBS's ctrl/discgolf.ini ([api] site), else the real site
// (the terminal version too, wherever it's opened from)
var SITE_URL = "https://discgolf.sodamachine.net";
function siteUrl() {
	var c = roomConfig();
	return c && c.site ? c.site : SITE_URL;
}

function onBbs() { return typeof user !== "undefined" && !!user.number; }

// A stable id for this player's device, so a dropped connection rejoins the same seat. On the BBS the
// server uses the alias instead; the terminal version keeps one in the browser (device_id).
var roomDevice = "";
function deviceId() {
	if (typeof device_id === "string" && device_id) return device_id;
	if (!roomDevice) { var c = "abcdefghijklmnopqrstuvwxyz0123456789"; roomDevice = "door"; for (var i = 0; i < 20; i++) roomDevice += c.charAt(Math.floor(Math.random() * c.length)); }
	return roomDevice;
}

// What went wrong with a call, in a sentence
function roomError(r) {
	if (!r) return "The room server didn't answer.";
	if (r.data && r.data.error) return String(r.data.error).substr(0, 70);
	return "The room server said " + r.code + ".";
}

function roomPost(path, body) {
	var r = roomCall("POST", path, body);
	return r && r.code >= 200 && r.code < 300 ? r : { failed: true, why: roomError(r) };
}

function roomPoll() {
	var r = roomCall("GET", "/api/games/" + ONLINE.code);
	if (!r || r.code !== 200 || !r.data) return null;
	onlineClock(r.data);
	return r.data;
}

function roomLeave() {
	if (!ONLINE || ONLINE.left) return;
	ONLINE.left = true;
	roomCall("POST", "/api/games/" + ONLINE.code + "/leave", { playerId: ONLINE.playerId });
}

// ---- The door: screens ---------------------------------------------------------------------------
var ROOM_CODE_CHARS = "ACDEFGHJKLMNPQRSTUVWXYZ23456789";
var ROOM_COLORS = [11, 13, 10, 12, 9, 14];   // each seat's letter on the map

// Waits up to ms for a key: "" if none (and on a hang-up)
function keyWithin(ms) { return console.inkey(K_NONE, ms) || ""; }
function hungUp() { return !bbs.online || js.terminated; }

function onlineHeader(title) {
	cls();
	out(moveTo(1, 1) + text(pad(" DISC GOLF ONLINE" + (title ? "   " + title : ""), SCR_W), 0x4F) + setAttr(7));
}

// Title screen's Online: host a round or join one (Up/Down and ENTER, or the letters, as the title screen)
var ONLINE_ITEMS = ["~Host a round", "~Join a round with its code", "~Back to the clubhouse"];
var onlineSel = { i: 0 };   // stays where it was when you come back
function drawOnlineItem(i, on) {
	drawMenuItem(ONLINE_ITEMS[i], on, 3, 11 + i);
	if (i === 0) put(20, 11,"\x01n\x01k\x01h(you pick the course)");
}

function onlineMenu() {
	for (;;) {
		onlineHeader("");
		put(3, 3, "\x01h\x01wPlay a round together");
		put(3, 5, "\x01nPlayers on this BBS, in the terminal version and on the web version", 76);
		put(3, 6, "\x01n(\x01h" + (siteUrl() || "the website").replace(/^https?:\/\//, "").substr(0, 40) + "\x01n) all join the same rooms.", 76);
		put(3, 7, "\x01nThe host gets a 4-character code to share.", 76);
		put(3, 8, "\x01n\x01k\x01hThe host's course and house rules are played (no mulligans online).", 76);
		put(3, 9, "\x01n\x01k\x01hReal order: farthest from the basket throws next, best score tees off first.", 76);
		for (var i = 0; i < ONLINE_ITEMS.length; i++) drawOnlineItem(i, i === onlineSel.i);
		put(5, 15, "\x01n\x01hUp/Down\x01n move   \x01hENTER\x01n choose");
		if (notice) { put(3, 17, notice, 76); notice = ""; }
		var k = menuPick(ONLINE_ITEMS, onlineSel, drawOnlineItem);
		if (!k || hungUp()) return;
		if (k === "H") onlineHost();
		else if (k === "J") { var code = askCode(); if (code) onlineJoin(code); }
		else if (k === "B" || k === "Q" || k === "\x1b") return;
	}
}

function onlineHost() {
	var ci = courseMenu();
	if (ci < 0) return;
	player.course = ci;
	onlineHeader("NEW ROOM");
	put(3, 3, "\x01nMaking a room...");
	var r = roomPost("/api/games", { displayName: player.name, bbs: onBbs(), deviceId: deviceId(), course: ci });
	if (r.failed) { notice = "\x01h\x01rCouldn't make a room: \x01n" + r.why; return; }
	ONLINE = { code: r.data.code, hostId: r.data.hostId, playerId: r.data.playerId, name: r.data.name, slot: 0, st: null, seen: 0 };
	onlineLobby();
}

function onlineJoin(code) {
	onlineHeader("JOINING " + code);
	put(3, 3, "\x01nJoining room \x01h" + code + "\x01n...");
	var r = roomPost("/api/games/" + code + "/join", { displayName: player.name, bbs: onBbs(), deviceId: deviceId() });
	if (r.failed) { notice = "\x01h\x01rCouldn't join " + code + ": \x01n" + r.why; return; }
	ONLINE = { code: code, playerId: r.data.playerId, name: r.data.name, slot: -1, st: null, seen: 0 };
	onlineLobby();
}

// The room's code: 4 characters, as the server makes them. "" to go back.
function askCode() {
	onlineHeader("JOIN A ROUND");
	put(3, 3, "\x01nType the room's code (the host sees it on their screen).");
	put(3, 9, "\x01h\x01cENTER\x01n join   \x01h\x01cBACKSPACE\x01n erase   \x01h\x01cESC\x01n back", 76);
	var code = "", hint = "";
	for (;;) {
		out(moveTo(5, 5) + text(" " + code, 0x4F) + text(code.length < 4 ? "_" : " ", 0x4B) + text(blank(4 - code.length), 0x4F) + setAttr(7));
		put(5, 7, hint ? "\x01h\x01y" + hint : "", 70);
		var k = key(), ku = k.toUpperCase();
		hint = "";
		if (!k || hungUp() || k === "\x1b") return "";
		if (k === "\r") { if (code.length === 4) return code; hint = "Codes are 4 characters."; }
		else if (k === "\b" || k === "\x7f") code = code.slice(0, -1);
		else if (ku.length === 1 && ROOM_CODE_CHARS.indexOf(ku) >= 0 && code.length < 4) code += ku;
		else if (ku === "0" || ku === "O" || ku === "1" || ku === "I" || ku === "B") hint = "Codes have no 0, O, 1, I or B.";
	}
}

// The lobby: the room's code and who's in it, until the host starts. The host can change the course
// (C) or start (ENTER); anyone can leave (Q). Polls the room every 1.5 s.
function onlineLobby() {
	var room = null, last = 0, drawn = "", isHost = !!ONLINE.hostId;
	for (;;) {
		if (hungUp()) { roomLeave(); ONLINE = null; return; }
		if (!room || system.timer - last >= ROOM_POLL_MS / 1000) {
			last = system.timer;
			var got = roomPoll();
			if (got) room = got;
			else if (!room) { notice = "\x01h\x01rThe room server didn't answer."; roomLeave(); ONLINE = null; return; }
		}
		if (room.status === "done") { notice = "\x01h\x01yThe host closed room " + ONLINE.code + "."; ONLINE = null; return; }
		ONLINE.slot = onlineSlotOf(room.players, ONLINE.name);
		if (room.status === "playing" && room.state) { onlineRound(room.state); return; }
		var key_ = JSON.stringify(room.players) + room.course;
		if (key_ !== drawn) { drawn = key_; drawLobby(room, isHost); }
		var k = keyWithin(250), ku = k.toUpperCase();
		if (ku === "Q" || k === "\x1b") { roomLeave(); ONLINE = null; return; }
		if (isHost && ku === "C") {
			var ci = courseMenu();
			if (ci >= 0) { player.course = ci; roomPost("/api/games/" + ONLINE.code + "/course", { hostId: ONLINE.hostId, course: ci }); room.course = ci; }
			drawn = "";
		}
		else if (isHost && k === "\r") {
			var C = COURSES[room.course], rules = copyHouse(house);
			fitBag(rules.bagSize);
			var r = roomPost("/api/games/" + ONLINE.code + "/start", { hostId: ONLINE.hostId, course: room.course, holes: C.holes.length,
				rules: rules, winds: onlineWinds(rules.wind, C.holes.length) });
			if (r.failed) { put(3, 22, "\x01h\x01rCouldn't start: \x01n" + r.why, 76); continue; }
			last = 0;   // poll right away: the round is on
		}
	}
}

function drawLobby(room, isHost) {
	onlineHeader("ROOM " + ONLINE.code);
	var C = COURSES[room.course] || COURSES[0], par = 0, i;
	for (i = 0; i < C.holes.length; i++) par += C.holes[i].par;
	put(3, 4, "\x01nRoom code");
	out(moveTo(14, 4) + text("  " + ONLINE.code.split("").join("  ") + "  ", 0x4B) + setAttr(7));
	put(3, 6, "\x01n\x01k\x01hShare it: anyone can join until the host starts.", 76);
	// the web version's invite link, the whole address so it can be pasted as it is; the BBS and the
	// terminal version join with the code
	put(3, 8, "\x01n\x01k\x01hOn the web:       \x01n" + siteUrl() + "/web/?join=" + ONLINE.code, 76);
	put(3, 9, "\x01n\x01k\x01hBBS or terminal:  \x01nPlay online, Join, " + ONLINE.code, 76);
	put(3, 11, "\x01hCourse  \x01n" + C.name + " \x01k\x01h- " + C.holes.length + " holes, par " + par, 76);
	put(3, 13, "\x01hPlayers \x01n\x01k\x01h(" + room.players.length + " of " + ROOM_MAX_PLAYERS + ")");
	for (i = 0; i < ROOM_MAX_PLAYERS; i++) {
		var p = room.players[i];
		put(5, 14 + i, p ? ("\x01h" + (i === ONLINE.slot ? "\x01c" : "\x01w") + p.name + "\x01n\x01k\x01h  " + (p.bbs ? "BBS" : "web") + (p.host ? ", host" : "")) : "\x01n\x01k\x01h-", 70);
	}
	if (isHost) {
		var hr = houseRows(house, 76);
		put(3, 21, hr.length ? hr[0] : "\x01n\x01k\x01hHouse rules: standard (yours are played)", 76);
		put(3, 23, "\x01h\x01cENTER\x01n start the round   \x01h\x01cC\x01n change course   \x01h\x01cQ\x01n close the room", 76);
	} else {
		put(3, 21, "\x01n\x01k\x01hThe host's house rules are played.", 76);
		put(3, 23, "\x01nWaiting for the host to start...   \x01h\x01cQ\x01n leave", 76);
	}
}

// The others' lies on the map: each player's first letter, in their seat's color
function onlineOthers(st) {
	var o = {}, H = S.H;
	for (var i = 0; i < st.players.length; i++) {
		var p = st.players[i];
		if (i === ONLINE.slot || p.gone || p.done) continue;
		var c = cellOf(H, p.lie || H.tee);
		if (inMap(c)) o[c.c + "," + c.r] = [(p.name.charAt(0) || "?").toUpperCase(), ROOM_COLORS[i % ROOM_COLORS.length]];
	}
	return o;
}

// A new room state: keep it, and show the last throw if it's someone else's we haven't seen
function onlineTake(st, watching) {
	var old = ONLINE.st, l = st.last;
	ONLINE.st = st;
	if (!l || l.seq <= ONLINE.seen || l.slot === ONLINE.slot) { ONLINE.seen = st.seq; return; }
	ONLINE.seen = st.seq;
	var who = "\x01h\x01w" + onlineName(st, l.slot) + ":\x01n ";
	if (watching && old && l.hole === old.hole && S && S.H.num - 1 === l.hole && l.path.length > 1) {
		V.others = onlineOthers(old);
		var pts = [];
		for (var i = 0; i < l.path.length; i++) pts.push({ x: l.path[i][0], y: l.path[i][1] });
		animate(pts);
	}
	V.lastMsg = who + l.line;
}

// Watching someone else's turn. Returns "changed" when the room moves on, or "quit".
function onlineWatch() {
	var st = ONLINE.st, last = system.timer;
	V.showAim = false; V.view = "map"; V.pov = null; V.others = onlineOthers(st);
	drawShotScreen();
	var shown = "";
	for (;;) {
		if (hungUp()) return "quit";
		// skipped (too long over a throw): out until you rejoin. Otherwise, after 3 minutes, anyone can skip.
		var out_ = st.players[ONLINE.slot].gone, can = !out_ && onlineTurnAge(st) > ROOM_SKIP_MS;
		var line = out_ ? "\x01h\x01yYou were skipped.\x01n  ~Rejoin  ~Scorecard ~Quit"
			: "Waiting for \x01h" + onlineName(st, st.turn) + "\x01n" + (can ? "  \x01h\x01y~K\x01n skip them" : "") + "  ~Scorecard ~Quit";
		if (line !== shown) { shown = line; status(line); }
		var k = keyWithin(250), ku = k.toUpperCase();
		if (ku === "S") { scorecard(st.hole, false); drawShotScreen(); shown = ""; continue; }
		if (ku === "Q") { if (confirmQuit("Waiting")) return "quit"; shown = ""; continue; }
		if (ku === "K" && can) {
			var r = roomPost("/api/games/" + ONLINE.code + "/skip", { playerId: ONLINE.playerId });
			if (r.failed) msg("\x01h\x01y" + r.why);
			last = 0;
		}
		if (ku === "R" && out_) {
			var rj = roomPost("/api/games/" + ONLINE.code + "/join", { displayName: player.name, bbs: onBbs(), deviceId: deviceId() });
			msg(rj.failed ? "\x01h\x01yCouldn't rejoin: \x01n" + rj.why : "\x01h\x01gBack in:\x01n you play on from the next hole.");
			last = 0;
		}
		if (system.timer - last >= ROOM_POLL_MS / 1000) {
			last = system.timer;
			var got = roomPoll();
			if (got && got.state && got.state.seq !== st.seq) {
				onlineTake(got.state, true);
				return "changed";
			}
		}
	}
}

// Your throw, to the room. Tries again until it goes through (or you quit). True once it's in, false if
// you quit, "skipped" if the room took the turn from you meanwhile (too long over it): it doesn't count.
function onlinePush(done) {
	var ls = V.lastShot || { kind: "throw", path: [], line: "" };
	var body = { playerId: ONLINE.playerId, me: onlineMe(done), last: { kind: ls.kind, path: onlinePath(ls.path), line: ls.line } };
	for (;;) {
		var r = roomPost("/api/games/" + ONLINE.code, body);
		if (!r.failed) { onlineClock(r.data); ONLINE.st = r.data.state; ONLINE.seen = r.data.state.seq; return true; }
		var got = roomPoll();
		if (got && got.state) {
			// already taken (the first try got through but its answer was lost): the room has moved on
			if (got.state.players[ONLINE.slot].cur >= body.me.cur) { onlineTake(got.state, false); return true; }
			if (got.state.turn !== ONLINE.slot) {
				onlineTake(got.state, false);
				V.lastMsg = "\x01h\x01yYou were skipped\x01n for taking too long: that throw didn't count.";
				return "skipped";
			}
		}
		status("\x01h\x01rCouldn't send your throw:\x01n " + r.why + "  Any key retries, ~Quit");
		var k = key().toUpperCase();
		if (!k || hungUp() || k === "Q") return false;
	}
}

// One online round, from the room's state when it started (or when you rejoined)
function onlineRound(st) {
	ONLINE.st = st; ONLINE.seen = st.seq;
	ONLINE.slot = onlineSlotOf(st.players, ONLINE.name);
	var course = COURSES[st.course];
	cls();
	put(3, 3, "\x01h\x01w" + course.name + "\x01n  " + course.where);
	put(3, 5, "\x01nMeasuring your connection...");
	var lag = measureLag();
	onlineStartRound(st).lag = lag;
	var hole = -1;
	try {
		for (;;) {
			st = ONLINE.st;
			if (st.hole !== hole || st.over) {
				if (hole >= 0) {
					R.strokes[hole] = st.players[ONLINE.slot].strokes[hole] || R.strokes[hole];
					msg(V.lastMsg);
					waitKey("Hole " + (hole + 1) + " is done. Press any key for the scorecard");
					scorecard(st.over ? -1 : st.hole, st.over);
				}
				if (st.over) break;
				hole = st.hole;
				onlineStartHole(st);
				V = { view: null, pov: null, marks: null, showAim: true, others: null,
					lastMsg: "\x01n" + (S.H.def.note || "") + (hole === 0 ? "" : "  \x01k\x01hHonors: \x01n" + onlineName(st, st.order[0])) };
			}
			if (st.turn === ONLINE.slot) {
				V.showAim = true; V.others = onlineOthers(st); V.lastShot = null;
				if (!S.strokes && !V.lastMsg) V.lastMsg = "\x01h\x01cYour throw.";
				var r = holeTurn();
				if (r === null) break;
				// at the room's limit of throws the hole stops counting (room.js): it's over for you
				var done = r !== "turn", capped = !done && S.strokes >= ROOM_MAX_THROWS;
				if (capped) { done = true; S.lie = { x: S.H.basket.x, y: S.H.basket.y }; }
				if (done) R.strokes[hole] = S.strokes;
				var sent = onlinePush(done);
				if (!sent) break;
				if (sent === "skipped") { R.strokes[hole] = 0; continue; }
				if (capped) V.lastMsg = "\x01h\x01y" + S.strokes + " throws:\x01n the hole stops counting there.";
				else if (done) V.lastMsg = scoreName(S.strokes, S.H.par) + "\x01n  " + S.strokes + " on a par " + S.H.par + ".";
				continue;
			}
			if (onlineWatch() === "quit") break;
		}
	} finally {
		roomLeave();
		onlineEndRound();
		ONLINE = null;
	}
}

// The terminal version opened with ?join=CODE: straight to that room
function onlineAutoJoin() {
	if (typeof join_code !== "string" || !/^[A-Z0-9]{4}$/.test(join_code)) return;
	var code = join_code;
	join_code = "";
	onlineJoin(code);
}
