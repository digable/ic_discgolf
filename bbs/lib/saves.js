// discgolf.js: Saved settings for BBS players, kept by the disc golf service (../server.js).
// Loaded by ../discgolf.js. ES5 for Synchronet (no let/const/arrows).
//
// The door finds the service in ctrl/discgolf.ini (readable only by the BBS):
//   [api]
//   url = http://127.0.0.1:3002
//   key = the service's DOOR_KEY
// Web players have no BBS login and never save (see signIn() in menus.js).

"use strict";

var SAVED_KEYS = ["hand", "style", "level", "flightPath", "puttView", "bag"];
var saveApi = null;          // { url, key } once ctrl/discgolf.ini is read; false if saving is off
var savedSettings = null;    // what the service has for this player, so saving one thing keeps the rest

// A short, stable tag for a name: lowercase letters, digits and _ (the same as IC Zombies)
function slugOf(who) {
	return String(who || "local").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "local";
}

function apiConfig() {
	if (saveApi !== null) return saveApi;
	saveApi = false;
	if (typeof File === "undefined") return saveApi;
	var f = new File(system.ctrl_dir + "discgolf.ini");
	if (!f.open("r")) return saveApi;
	var url = f.iniGetValue("api", "url", "http://127.0.0.1:3002"), key = f.iniGetValue("api", "key", "");
	f.close();
	if (key) saveApi = { url: String(url).replace(/\/+$/, ""), key: String(key) };
	return saveApi;
}

// One request to the service: { code, data }, or null if it couldn't be reached
function apiRequest(method, path, body) {
	var cfg = apiConfig();
	if (!cfg) return null;
	try {
		if (typeof HTTPRequest === "undefined") load("http.js");
		var req = new HTTPRequest(undefined, undefined, { "X-Door-Key": cfg.key }, 5);
		var text = method === "POST"
			? req.Post(cfg.url + path, JSON.stringify(body), undefined, undefined, "application/json")
			: req.Get(cfg.url + path);
		var data = null;
		try { data = JSON.parse(text); } catch (e) { }
		return { code: req.response_code, data: data };
	} catch (e) {
		log("discgolf: save service: " + e);
		return null;
	}
}

function currentSettings() {
	return { hand: player.hand, style: player.style, level: player.level, flightPath: player.flightPath,
		puttView: player.puttView, bag: player.bag.slice() };
}

// Puts saved settings into player, skipping anything that's no longer valid (a disc that's left
// the catalog, say), so an old save never breaks the game
function applySettings(s) {
	if (HANDS.indexOf(s.hand) >= 0) player.hand = s.hand;
	if (s.style === "BH" || s.style === "FH") player.style = s.style;
	if (LEVELS.hasOwnProperty(s.level)) player.level = s.level;
	if (typeof s.flightPath === "boolean") player.flightPath = s.flightPath;
	if (PUTT_VIEWS.indexOf(s.puttView) >= 0) player.puttView = s.puttView;
	var bag = [], i;
	for (i = 0; s.bag && i < s.bag.length && bag.length < BAG_MAX; i++)
		if (discByName(s.bag[i]) && bag.indexOf(s.bag[i]) < 0) bag.push(s.bag[i]);
	if (bag.length) { player.bag = bag; bagChanged(); }
}

// This BBS player's saved settings, into player. "loaded", "none" (first visit) or "off" (the
// service isn't set up or didn't answer: play on without saving).
function loadSettings() {
	var r = apiRequest("GET", "/api/players/" + player.handle);
	if (r && r.code === 200 && r.data) {
		applySettings(r.data);
		savedSettings = currentSettings();
		return "loaded";
	}
	if (r && r.code === 404 && r.data && r.data.saved === false) return "none";
	return "off";
}

// Saves the given settings (names from SAVED_KEYS; all of them on a first save) and keeps the
// rest as they were saved. True if the service took it.
function saveSettings(keys) {
	if (!player.canSave) return false;
	var cur = currentSettings(), s = savedSettings ? JSON.parse(JSON.stringify(savedSettings)) : cur, i;
	for (i = 0; i < keys.length; i++) s[keys[i]] = cur[keys[i]];
	s.name = player.name;
	var r = apiRequest("POST", "/api/players/" + player.handle, s);
	if (!r || r.code !== 200) return false;
	delete s.name;
	savedSettings = s;
	return true;
}

// The putting view is remembered quietly once a round is over, if it changed
function savePuttView() {
	if (player.canSave && savedSettings && player.puttView !== savedSettings.puttView) saveSettings(["puttView"]);
}
