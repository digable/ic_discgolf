// IC Disc Golf web: online rooms (the menu's Online tab). The same rooms as the BBS door and the
// terminal version (../api/games.js, ../bbs/lib/online.js): host one and share its code or link,
// or join with a code; the host starts the round. Then game.js plays it (GAME.playOnline).
"use strict";

var ROOMS = (function () {
	var $ = function (id) { return document.getElementById(id); };
	var NAME_KEY = "icdg.name", DEVICE_KEY = "icdg.device";
	var room = null;        // the lobby as last polled (api/games.js's public view)
	var timer = 0, msg = "", busy = false, onStart = null, rerender = null;
	var joinCode = "";      // from an invite link (?join=CODE), read when the page starts (resume)

	function stored(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }
	function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
	// The id this browser rejoins with, so a reload (or a dropped connection) gets the same seat back
	function device() {
		var id = stored(DEVICE_KEY);
		if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()).replace(/[^A-Za-z0-9]/g, ""); store(DEVICE_KEY, id); }
		return id;
	}

	// One call to the room server: { code, data }; code 0 if it didn't answer
	function call(method, path, body) {
		return fetch(path, { method: method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined, cache: "no-store" })
			.then(function (r) { return r.json().catch(function () { return null; }).then(function (d) { return { code: r.status, data: d }; }); })
			.catch(function () { return { code: 0, data: null }; });
	}
	function why(r) { return r.data && r.data.error ? r.data.error : (r.code ? "The room server said " + r.code + "." : "The room server didn't answer."); }
	function ok(r) { return r.code >= 200 && r.code < 300; }

	// ---- the tab ------------------------------------------------------------------------------
	function html() {
		if (ONLINE && room) return lobbyHtml();
		// what's typed stays typed when the tab is drawn again (a message under it, say)
		var name = $("roomName") ? $("roomName").value : stored(NAME_KEY);
		var code = $("roomCode") ? $("roomCode").value : joinCode;
		var C = COURSES[player.course] || COURSES[0];
		return "<p class='label'>Play one round together with players on the BBS, in the <a href='../'>terminal</a> and here. " +
			"The host's course and house rules are played (no mulligans online), in the real order: farthest from the basket throws next, best score tees off first.</p>" +
			"<div class='field'><span class='label'>Your name</span><input id='roomName' class='search' maxlength='" + MAX_NAME + "' autocomplete='nickname' value='" + TEXT.esc(name) + "' placeholder='The name on the scorecard'>" +
			"<span class='label'>Shown with (web) after it, so nobody passes for a BBS player.</span></div>" +
			"<div class='field'><span class='label'>Host a round</span><div class='row'><button type='button' class='go' id='hostBtn'>Host " + TEXT.html(C.name) + "</button>" +
			"<button type='button' class='link' data-go='play'>pick another course</button></div></div>" +
			"<div class='field'><span class='label'>Join a round</span><div class='row'><input id='roomCode' class='search code' maxlength='4' autocomplete='off' autocapitalize='characters' placeholder='CODE' value='" + TEXT.esc(code) + "'>" +
			"<button type='button' class='go' id='joinBtn'>Join</button></div></div>" +
			(msg ? "<p class='notice'>" + TEXT.ctrlA(msg) + "</p>" : "");
	}
	function lobbyHtml() {
		var C = COURSES[room.course] || COURSES[0], host = !!ONLINE.hostId, par = 0, i;
		C.holes.forEach(function (h) { par += h.par; });
		var link = location.origin + location.pathname + "?join=" + ONLINE.code;
		var h = "<div class='lobby'><div class='label'>Room code</div><div class='bigcode'>" + ONLINE.code + "</div>" +
			"<div class='row center'><button type='button' class='tg' id='copyLink'>Copy invite link</button></div>" +
			"<p class='label'>On the BBS or in the terminal: Play online, Join, " + ONLINE.code + ".</p></div>";
		h += "<div class='field'><span class='label'>Course</span>";
		if (host) {
			h += "<select id='roomCourse' class='search'>" + courseOrder().map(function (ci) {
				return "<option value='" + ci + "'" + (ci === baseOf(room.course) ? " selected" : "") + ">" + TEXT.html(COURSES[ci].name) + "</option>";
			}).join("") + "</select>";
		} else h += "<b>" + TEXT.html(C.name) + "</b>";
		h += "<span class='label'>" + C.holes.length + " holes · par " + par + "</span></div>";
		h += "<div class='field'><span class='label'>Players (" + room.players.length + " of " + ROOM_MAX_PLAYERS + ")</span><ul class='plist players'>";
		for (i = 0; i < room.players.length; i++) {
			var p = room.players[i];
			h += "<li class='crow'><i class='seat s" + i + "'></i><b>" + TEXT.html(p.name) + "</b><span class='label'>" + (p.bbs ? "BBS" : "web") + (p.host ? " · host" : "") +
				(p.name === ONLINE.name ? " · you" : "") + "</span></li>";
		}
		h += "</ul></div>";
		h += "<p class='label'>" + (host ? "House rules: " + TEXT.html(houseChanges(house).join(", ") || "standard") + " (yours are played)." : "The host's house rules are played.") + "</p>";
		if (msg) h += "<p class='notice'>" + TEXT.ctrlA(msg) + "</p>";
		h += "<div class='row'>" + (host ? "<button type='button' class='go' id='startBtn'" + (busy ? " disabled" : "") + ">Start the round</button>" : "<span class='label'>Waiting for the host to start…</span>") +
			"<button type='button' class='tg quit' id='leaveBtn'>" + (host ? "Close the room" : "Leave") + "</button></div>";
		return h;
	}

	function say(m) { msg = m; if (rerender) rerender(); }

	function nameOk() {
		var n = ($("roomName") ? $("roomName").value : stored(NAME_KEY)).replace(/ +$/, "");
		var p = nameProblem(n);
		if (p) { say("\x01h\x01y" + p); return ""; }
		store(NAME_KEY, n);
		return n;
	}

	function host() {
		var n = nameOk();
		if (!n || busy) return;
		if (bagPutters() < 1) return say("\x01h\x01rYour bag has no putter: add one on the Bag tab.");
		busy = true;
		if (!COURSES[player.course]) player.course = 0;   // nothing picked yet: the course the Play tab shows
		call("POST", "/api/games", { displayName: n, deviceId: device(), course: player.course }).then(function (r) {
			busy = false;
			if (!ok(r)) return say("\x01h\x01rCouldn't make a room: \x01n" + why(r));
			ONLINE = { code: r.data.code, hostId: r.data.hostId, playerId: r.data.playerId, name: r.data.name, slot: 0, st: null, seen: 0 };
			store("icdg.room", JSON.stringify(ONLINE));
			msg = ""; poll();
		});
	}
	function join(code) {
		var n = nameOk();
		code = String(code || "").toUpperCase();
		if (!n || busy) return;
		if (!/^[A-Z0-9]{4}$/.test(code)) return say("\x01h\x01yRoom codes are 4 characters.");
		busy = true;
		call("POST", "/api/games/" + code + "/join", { displayName: n, deviceId: device() }).then(function (r) {
			busy = false;
			if (!ok(r)) return say("\x01h\x01rCouldn't join " + code + ": \x01n" + why(r));
			var keep = ONLINE && ONLINE.code === code ? ONLINE.hostId : undefined;
			ONLINE = { code: code, hostId: keep, playerId: r.data.playerId, name: r.data.name, slot: -1, st: null, seen: 0 };
			store("icdg.room", JSON.stringify(ONLINE));
			joinCode = ""; msg = ""; poll();
		});
	}
	function leave() {
		// (only on purpose: a closed tab keeps its seat, and reopening the page rejoins)
		if (ONLINE) call("POST", "/api/games/" + ONLINE.code + "/leave", { playerId: ONLINE.playerId });
		stop(); ONLINE = null; room = null; store("icdg.room", "");
		if (history.replaceState && location.search) history.replaceState(null, "", location.pathname);
	}
	function start() {
		if (!ONLINE || !ONLINE.hostId || !room || busy) return;
		var C = COURSES[room.course], rules = copyHouse(house);
		if (!C) return;
		fitBag(rules.bagSize);
		busy = true; say("");
		call("POST", "/api/games/" + ONLINE.code + "/start", { hostId: ONLINE.hostId, course: room.course, holes: C.holes.length,
			rules: rules, winds: onlineWinds(rules.wind, C.holes.length) }).then(function (r) {
			busy = false;
			if (!ok(r)) return say("\x01h\x01rCouldn't start: \x01n" + why(r));
			poll();
		});
	}
	function setCourse(ci) {
		if (!ONLINE || !ONLINE.hostId) return;
		ci = pickedVersion(ci);
		player.course = ci; MENU.save();
		room.course = ci;
		call("POST", "/api/games/" + ONLINE.code + "/course", { hostId: ONLINE.hostId, course: ci });
		if (rerender) rerender();
	}

	// ---- polling the lobby (every 1.5 s, as IC Zombies) ----------------------------------------------
	function stop() { clearTimeout(timer); timer = 0; }
	function poll() {
		stop();
		if (!ONLINE) return;
		var me = ONLINE;
		call("GET", "/api/games/" + me.code).then(function (r) {
			if (ONLINE !== me) return;
			if (r.code === 404) { leave(); return say("\x01h\x01yThat room is gone (rooms close after a day with nobody playing)."); }
			if (!ok(r)) { timer = setTimeout(poll, ROOM_POLL_MS); return; }
			var was = room ? JSON.stringify([room.players, room.course, room.status]) : "";
			room = r.data;
			if (room.status === "done") { leave(); return say("\x01h\x01yThe host closed that room."); }
			ONLINE.slot = onlineSlotOf(room.players, ONLINE.name);
			if (room.status === "playing" && room.state) { stop(); return onStart(room.state); }
			if (rerender && JSON.stringify([room.players, room.course, room.status]) !== was && !(document.activeElement && document.activeElement.id === "roomCourse")) rerender();
			timer = setTimeout(poll, ROOM_POLL_MS);
		});
	}

	// The tab's buttons (menu.js passes clicks on to here); true if it was one of ours
	function click(t) {
		if (t.id === "hostBtn") { host(); return true; }
		if (t.id === "joinBtn") { join($("roomCode").value); return true; }
		if (t.id === "startBtn") { start(); return true; }
		if (t.id === "leaveBtn") { leave(); say(""); return true; }
		if (t.id === "copyLink") {
			var link = location.origin + location.pathname + "?join=" + ONLINE.code;
			(navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(function () { t.textContent = "Link copied"; }, function () { t.textContent = link; });
			return true;
		}
		return false;
	}
	function change(t) { if (t.id === "roomCourse") { setCourse(+t.value); return true; } return false; }
	function key(e) {
		if (e.key !== "Enter") return false;
		if (e.target.id === "roomCode") { join(e.target.value); return true; }
		if (e.target.id === "roomName") { if ($("roomCode") && $("roomCode").value) join($("roomCode").value); else host(); return true; }
		return false;
	}

	// Opening the page: an invite link (?join=CODE) or a room this browser was in (after a reload)
	function resume() {
		joinCode = (new URLSearchParams(location.search).get("join") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
		var saved = null;
		try { saved = JSON.parse(stored("icdg.room") || "null"); } catch (e) {}
		if (joinCode && (!saved || saved.code !== joinCode)) return stored(NAME_KEY) ? (join(joinCode), "online") : "online";
		if (saved && saved.code && saved.playerId) { ONLINE = saved; ONLINE.st = null; ONLINE.seen = 0; poll(); return "online"; }
		return joinCode ? "online" : "";
	}

	function init(opts) { onStart = opts.onStart; rerender = opts.rerender; }

	return { init: init, html: html, click: click, change: change, key: key, resume: resume, leave: leave, call: call, why: why, ok: ok, device: device, inRoom: function () { return !!(ONLINE && room); } };
})();
