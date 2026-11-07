// IC Disc Golf web: the screens, controls and animation around the game's own rules
// (../bbs/lib: startRound, startHole, takeThrow, puttSetup, takePutt...). The rules decide
// everything; this file only takes the player's input and says what to draw (draw.js: the map,
// pov.js: the view from the lie).
//
// Drawing: a frame is drawn only when something changed (kick()), and frames keep coming only
// while something moves (the meter, a disc in the air).
"use strict";

(function () {
	var $ = function (id) { return document.getElementById(id); };
	var cv = $("map"), g = cv.getContext("2d"), dpr = 1;
	var pic = null, vw = null, box = null;   // the hole's picture, the map's view of it, and the box it's drawn in
	var phase = "menu";        // menu, aim, meter, fly, putt, rolling, holeDone, roundDone
	var holeIdx = 0, anim = null, meter = null, lastPath = null;
	var reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
	var view = "map";          // throwing: "map", or "pov" (the view from the lie)
	var pov = null;            // the view from the lie: { ang, drag }
	var puttCam = null;        // where a putt is seen from (it stays put while the putt flies)
	var cardOpen = false;      // the scorecard is open over the hole

	// ---- text -----------------------------------------------------------------------------------
	function esc(t) { return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
	var CP437 = { "\x80": "Ç", "\x81": "ü", "\x82": "é", "\x83": "â", "\x84": "ä", "\x85": "à", "\x86": "å", "\x87": "ç", "\x88": "ê", "\x89": "ë", "\x8a": "è",
		"\x8b": "ï", "\x8c": "î", "\x8d": "ì", "\x8e": "Ä", "\x8f": "Å", "\x90": "É", "\x91": "æ", "\x92": "Æ", "\x93": "ô", "\x94": "ö", "\x95": "ò", "\x96": "û",
		"\x97": "ù", "\x98": "ÿ", "\x99": "Ö", "\x9a": "Ü", "\xa0": "á", "\xa1": "í", "\xa2": "ó", "\xa3": "ú", "\xa4": "ñ", "\xa5": "Ñ" };
	function cp(t) { return String(t).replace(/[\x80-\xa5]/g, function (c) { return CP437[c] || c; }); }
	function html(t) { return esc(cp(t)); }   // the game's own text (CP437) as HTML
	// The door's wording, with its Ctrl-A colour codes, as HTML
	var CA = { k: "c-k", r: "c-r", g: "c-g", y: "c-y", b: "c-b", m: "c-m", c: "c-c", w: "c-w" };
	function ctrlA(s) {
		s = cp(s);
		var out = "", cls = [], open = false, i, ch;
		for (i = 0; i < s.length; i++) {
			ch = s[i];
			if (ch === "\x01" && i + 1 < s.length) {
				var c = s[++i].toLowerCase();
				if (c === "n") cls = []; else if (c === "h") cls.push("hi"); else if (CA[c]) cls = cls.filter(function (x) { return x === "hi"; }).concat([CA[c]]);
				if (open) { out += "</span>"; open = false; }
				if (cls.length) { out += '<span class="' + cls.join(" ") + '">'; open = true; }
				continue;
			}
			out += esc(ch);
		}
		return out + (open ? "</span>" : "");
	}
	// Sets an element's HTML only when it changed (no layout work for the same text every frame)
	function setHtml(el, h) { if (el._html !== h) { el._html = h; el.innerHTML = h; } }
	function say(s) {
		$("msg").innerHTML = ctrlA(s); $("msg").hidden = !s;
		if (S) layout();
	}
	function relText(rel) { return rel === 0 ? "E" : (rel > 0 ? "+" + rel : String(rel)); }

	// ---- settings, kept in this browser -----------------------------------------------------------
	var SETTINGS = "icdg.settings";
	function loadSettings() {
		try {
			var s = JSON.parse(localStorage.getItem(SETTINGS) || "{}");
			if (!s.puttView) s.puttView = localStorage.getItem("icdg.puttView");   // kept on its own before
			if (s.hand === "R" || s.hand === "L") player.hand = s.hand;
			if (s.style === "BH" || s.style === "FH") player.style = s.style;
			if (LEVELS.hasOwnProperty(s.level)) player.level = s.level;
			if (s.puttView === "pov" || s.puttView === "top") player.puttView = s.puttView;
		} catch (e) {}
	}
	function saveSettings() {
		try {
			localStorage.setItem(SETTINGS, JSON.stringify({ hand: player.hand, style: player.style, level: player.level, puttView: player.puttView }));
		} catch (e) {}
	}

	// ---- layout -----------------------------------------------------------------------------
	function layout() {
		dpr = Math.min(window.devicePixelRatio || 1, 2);
		var w = window.innerWidth, h = window.innerHeight;
		cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
		cv.style.width = w + "px"; cv.style.height = h + "px";
		var top = $("top").getBoundingClientRect(), pan = $("panel").getBoundingClientRect();
		document.documentElement.style.setProperty("--msgTop", Math.round(top.bottom + 6) + "px");
		var side = pan.left > w * 0.35;                         // short screens: the panels are a column at the right
		if (side) box = { x: 8, y: 8, w: Math.max(80, pan.left - 20), h: h - 16 };
		else {
			// phones: the hole goes below the message too, so nothing sits on top of it
			var under = top.bottom, msg = $("msg");
			if (!msg.hidden) under = Math.max(under, msg.getBoundingClientRect().bottom);
			box = { x: 8, y: under + 6, w: w - 16, h: Math.max(80, pan.top - under - 12) };
		}
		if (S) { vw = DRAW.view(S.H, box); hud(); }
		kick();
	}
	window.addEventListener("resize", layout);

	// ---- the course menu ----------------------------------------------------------------------
	var traced = {};          // course index -> its photo-traced version's index
	COURSES.forEach(function (C, i) { if (C.of) COURSES.forEach(function (B, j) { if (B.name === C.of) traced[j] = i; }); });
	var useTraced = {};
	function courseRow(i) {
		var C = COURSES[useTraced[i] ? traced[i] : i], par = 0, len = 0;
		C.holes.forEach(function (h) { par += h.par; len += h.ft; });
		var li = document.createElement("li");
		var b = document.createElement("button"); b.type = "button"; b.className = "course";
		b.innerHTML = "<b></b><span class='label'></span><span class='meta'></span>";
		b.querySelector("b").textContent = cp(COURSES[i].name);
		b.querySelector(".label").textContent = cp(C.where + ", " + C.country);
		b.querySelector(".meta").textContent = C.holes.length + " holes · par " + par + " · " + len.toLocaleString() + " ft · UDisc " + C.rating.toFixed(1);
		b.addEventListener("click", function () { play(useTraced[i] ? traced[i] : i); });
		li.appendChild(b);
		if (traced[i] !== undefined) {
			var v = document.createElement("button"); v.type = "button"; v.className = "tg ver" + (useTraced[i] ? " on" : "");
			v.textContent = useTraced[i] ? "photo-accurate" : "drawn";
			v.title = "Switch between the drawn course and the one traced from aerial photos";
			v.setAttribute("aria-pressed", useTraced[i] ? "true" : "false");
			v.setAttribute("aria-label", "Photo-accurate version of " + cp(COURSES[i].name));
			v.addEventListener("click", function () { useTraced[i] = !useTraced[i]; listCourses(); });
			li.appendChild(v);
		}
		return li;
	}
	function listCourses() {
		var q = $("search").value.trim().toLowerCase(), ul = $("courses");
		ul.innerHTML = "";
		COURSES.map(function (C, i) { return i; }).filter(function (i) { return !COURSES[i].of; })
			.sort(function (a, b) { var x = sortName(COURSES[a].name), y = sortName(COURSES[b].name); return x < y ? -1 : (x > y ? 1 : 0); })
			.filter(function (i) { return !q || cp(COURSES[i].name + " " + COURSES[i].where).toLowerCase().indexOf(q) >= 0; })
			.forEach(function (i) { ul.appendChild(courseRow(i)); });
	}
	function syncOpts() {
		document.querySelectorAll("[data-opt]").forEach(function (b) {
			var on = String(player[b.dataset.opt]) === b.dataset.v;
			b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false");
		});
	}
	document.querySelectorAll("[data-opt]").forEach(function (b) {
		b.addEventListener("click", function () { player[b.dataset.opt] = b.dataset.v; syncOpts(); saveSettings(); });
	});
	$("search").addEventListener("input", listCourses);
	function showMenu() {
		phase = "menu"; $("menu").hidden = false; $("done").hidden = true; syncOpts(); listCourses();
	}

	// ---- a round ----------------------------------------------------------------------------
	function play(ci) {
		$("menu").hidden = true;
		player.name = "You";
		startRound(COURSES[ci]);
		holeIdx = 0;
		beginHole();
	}
	function beginHole() {
		startHole(holeIdx);
		pic = DRAW.holePicture(S.H);
		layout();
		say(S.H.def.note ? "\x01h\x01wHole " + S.H.num + ".\x01n " + S.H.def.note : "");
		readyToThrow();
	}
	function readyToThrow() {
		if (inPuttRange()) { puttSetup(); if (isTapIn()) { tapIn(); say("Tap-in."); return holeOut(); } phase = "putt"; }
		else phase = "aim";
		view = "map"; pov = null;
		puttCam = phase === "putt" ? { from: { x: S.lie.x, y: S.lie.y }, ang: Math.atan2(-PT.by, -PT.bx) } : null;
		if (phase === "aim" && lieInTrees()) startPov();
		meterReset(); hud(); syncView();
	}
	// Back to the course menu, from the end of a round or partway through one
	function leaveRound() {
		anim = null; meter = null; cardOpen = false; pov = null; puttCam = null;
		$("cardBtn").setAttribute("aria-expanded", "false");
		endRound(); S = null; pic = null; vw = null;
		$("gapChip").hidden = true;
		showMenu();
		kick();
	}

	// ---- the panel: called when what it shows changes ----------------------------------------
	function hud() {
		if (!S) return;
		var d = curDisc(), putting = phase === "putt", pd = putting ? puttDisc() : d;
		$("hCourse").textContent = cp(R.course.name); $("hHole").textContent = S.H.num + "/" + R.holes.length;
		$("hPar").textContent = S.H.par; $("hPin").textContent = ft(pinDist()) + " ft";
		// the throw coming up; once it's in (the rules put the lie exactly on the basket), the hole's score
		var done = S.lie.x === S.H.basket.x && S.lie.y === S.H.basket.y;
		$("hThrowLabel").textContent = done ? "score" : "throw";
		$("hThrow").textContent = done ? S.strokes : S.strokes + 1;
		$("hRound").textContent = relText(roundToPar());
		$("dName").textContent = pd.name; $("dWeight").textContent = (pd.g || MAX_G) + "g";
		setHtml($("dNums"), pd.n.map(function (n) { return "<span>" + n + "</span>"; }).join(""));
		$("dRange").textContent = putting ? "putting · " + puttAimText("")
			: "max " + ft(discRange(d, S.style, domHand()) * (S.pitch ? PITCH_POWER : 1)) + " ft";
		$("discDot").style.background = discColor(pd);
		$("discDot").setAttribute("aria-label", "Disc: " + pd.name + ". Next disc (D)");
		chipText("tStyle", "Throw", S.pitch ? "pitch-out" : styleName(S.style).toLowerCase(), "T");
		chipText("tHand", "Hand", handName(S.hand).toLowerCase() + (domHand() ? "" : " (off)"), "H");
		chipText("tAngle", "Angle", S.style === "TH" ? "-" : angleName(S.angle).toLowerCase(), "A");
		$("tStyle").disabled = $("tAngle").disabled = $("discDot").disabled = putting;
		$("wText").textContent = S.wind.mph ? S.wind.mph + " mph" : "calm";
		windArrow();
		kick();
	}
	// Where the putt is aimed, in whole feet ("3 ft left" + of, or "straight at it" under half a foot)
	function puttAimText(of) {
		var f = Math.round(Math.abs(PT.aim) * FT);
		return f ? f + " ft " + (PT.aim < 0 ? "left" : "right") + of : "straight at it";
	}
	function chipText(id, what, val, key) {
		var b = $(id); b.textContent = val; b.setAttribute("aria-label", what + ": " + val + ". Change (" + key + ")");
	}
	// The wind arrow points the way the wind blows: on the map as the map is drawn, and in the
	// view from the lie as you face (straight up is a wind at your back)
	function windArrow() {
		var el = $("wArrow"), face = facing(), deg = null;
		if (face !== null) deg = (Math.atan2(S.wind.y, S.wind.x) - face) * 180 / Math.PI;
		else if (vw) {
			var a = vw.w2s({ x: 0, y: 0 }), b = vw.w2s({ x: S.wind.x, y: S.wind.y });
			deg = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI + 90;
		}
		if (deg !== null) el.style.transform = "rotate(" + deg + "deg)";
		el.style.opacity = S.wind.mph ? 1 : 0.3;
		el.title = face !== null ? "Wind, as you face" : "Wind, on the map";
	}
	var TYPE_COL = { P: "#f2f2f2", A: "#7fd3ff", M: "#ffd84d", F: "#ff9f43", D: "#ff5d5d" };
	function discColor(d) { return "radial-gradient(circle at 35% 30%, #fff, " + (TYPE_COL[d.type] || "#ffd84d") + " 55%, rgba(0,0,0,.35))"; }

	// ---- the meter (the same 3 clicks and timing as the door: meter.js's posAt and powerAt) --------
	function meterReset() {
		meter = null;
		setTicks(phase === "putt");
		$("mark").style.left = pctOf(0); $("pressP").hidden = true;
		$("mLabel").innerHTML = phase === "putt" ? "Putt: tap <b>PUTT</b><span class='kb'> (or SPACE)</span> to start" : "Tap <b>THROW</b><span class='kb'> (or press SPACE)</span> to reach back";
		$("throwBtn").textContent = phase === "putt" ? "PUTT" : "THROW";
	}
	function pctOf(col) { return (col / (BAR_W - 1) * 100) + "%"; }
	$("snap").style.left = pctOf(SNAP - 0.5); $("snap").style.width = (SNAP_W / (BAR_W - 1) * 100) + "%";
	$("p100").style.left = pctOf(P100);
	document.querySelector("#bar .over").style.left = pctOf(P100);
	// Where a power sits on the bar: 0% at the yellow release zone, 100% at the white line (meter.js's powerAt)
	function powCol(p) { return SNAP + p / 100 * (P100 - SNAP); }
	// The marks over the bar. Putting, like the door: every 10 ft, full power is 66 ft, and the basket at the
	// putt's length (the power that just gets there: a putt goes power% of 66 ft)
	function setTicks(putting) {
		var marks = [], el = $("ticks"), pin = $("pinMark");
		if (putting) {
			var full = ft(PUTT_M);
			for (var f = 10; f < full - 8; f += 10) marks.push([f / full * 100, String(f)]);
			marks.push([100, full + " ft"]);
		} else marks = [[0, "0"], [25, "25"], [50, "50"], [75, "75"], [100, "100%"]];
		el.innerHTML = marks.map(function (m) { return "<span style='left:" + pctOf(powCol(m[0])) + "'>" + m[1] + "</span>"; }).join("");
		pin.hidden = !putting;
		if (putting) {
			var need = Math.min(100, ft(PT.dist) / ft(PUTT_M) * 100);
			pin.style.left = pctOf(powCol(need));
			$("pinFt").textContent = ft(PT.dist) + " ft";
		}
	}
	function press(when) {
		if (phase === "holeDone") return nextHole();
		if (phase !== "aim" && phase !== "putt" && phase !== "meter") return;
		var t = (typeof when === "number" ? when : performance.now()) / 1000;   // the moment of the tap, not when it's handled
		if (!meter) { meter = { start: t, power: null, over: false, turnT: null, turnPos: 0, putting: phase === "putt" }; phase = "meter";
			$("mLabel").textContent = "Reach back... tap again for power"; syncView(); return; }
		var e = t - meter.start;
		if (meter.power === null) {
			var hp = posAt(e);
			meter.power = powerAt(hp); meter.over = hp > P100 + 0.5;
			$("pressP").hidden = false; $("pressP").style.left = pctOf(hp);
			if (e < SWEEP_SEC) { meter.turnT = e; meter.turnPos = posAt(e); }
			$("mLabel").innerHTML = (meter.over ? "<span class='c-r hi'>Overswing!</span> " : "") + "Power " + meter.power + "% · tap in the <span class='c-y hi'>yellow</span> to release";
			return;
		}
		release({ power: meter.power, over: meter.over, accuracy: meterPos(e) - SNAP_MID });
	}
	function meterPos(e) {
		var speed = (BAR_W - 1) / SWEEP_SEC;
		return (meter.turnT !== null && e >= meter.turnT) ? meter.turnPos - (e - meter.turnT) * speed : posAt(e);
	}
	function meterTick(now) {
		if (phase !== "meter" || !meter) return;
		// a frame's time can be a little before the tap that started the meter: not a whiff, just not started yet
		var e = Math.max(0, now / 1000 - meter.start), p = meterPos(e);
		if (p < 0) return release({ whiff: true, power: meter.power === null ? 30 : meter.power, over: meter.over });
		$("mark").style.left = pctOf(p);
	}
	function release(s) {
		var putting = meter.putting; meter = null;
		if (putting) return doPutt(s);
		doThrow(s);
	}
	function aimingThrow() { return phase === "aim" || (phase === "meter" && !!meter && !meter.putting); }
	function aimingPutt() { return phase === "putt" || (phase === "meter" && !!meter && meter.putting); }

	// ---- throwing ---------------------------------------------------------------------------
	function doThrow(s) {
		var shot = takeThrow(s), f = shot.flight;
		var how = shot.pitch ? "pitch-out" : (shot.style === "TH" ? "tomahawk" : "");
		var line = "\x01h\x01c" + discLabel(shot.disc) + (how ? " " + how : "") + "\x01n " + (s.whiff ? "\x01h\x01rshanked\x01n, " : "") + ft(shot.dist) + " ft. ";
		if (s.over) line = "\x01h\x01rOverswing! \x01n" + line;
		if (shot.outcome === "in") line += "\x01h\x01g" + (S.strokes === 1 ? "IN THE CHAINS - ACE!!" : "IN THE CHAINS!");
		else if (shot.water) line = waterLine(shot);
		else if (shot.outcome === "ob") line += "\x01h\x01rOB " + obWhere(f.obTile) + "!\x01n " + penaltyText(shot.penalty) + ", play from where it went out.";
		else {
			if (f.tree) line += "\x01h\x01yTree hit! \x01n";
			if (f.basket) line += "\x01h\x01yOff the cage. \x01n";
			if (f.rolled) line += "Rolled downhill. ";
			line += "Lying " + lieName(tileAt(S.H, S.lie)) + ", " + ft(pinDist()) + " ft to go.";
		}
		phase = "fly";
		syncView();
		lastPath = [shot.from].concat(f.path);
		flyAlong(lastPath, 900 + shot.dist * 9, function () {
			say(line);
			if (shot.outcome === "in") return holeOut();
			readyToThrow();
		});
	}
	// Where the animation is: the point, how far along (t: time, e: eased, both 0-1), and the last path point passed
	function animAt(now) {
		if (!anim) return null;
		var t = clamp((now - anim.start) / anim.ms, 0, 1), path = anim.path, n = path.length - 1;
		var e = 1 - Math.pow(1 - t, 1.6), fi = e * n, i0 = Math.min(Math.floor(fi), n), fr = fi - Math.floor(fi);
		var a = path[i0], b = path[Math.min(i0 + 1, n)];
		return { t: t, e: e, n: n, i0: i0, path: path, endHt: anim.endHt, lift: anim.lift, at: { x: a.x + (b.x - a.x) * fr, y: a.y + (b.y - a.y) * fr } };
	}
	function finishAnim(now) {
		if (anim && now - anim.start >= anim.ms) { var dn = anim.done; anim = null; dn(); }
	}
	function flyAlong(path, ms, done) {
		if (reduceMotion) ms = 1;
		anim = { path: path, start: performance.now(), ms: ms, done: done };
		kick();
	}

	// ---- putting -----------------------------------------------------------------------------
	function doPutt(s) {
		var dist = PT.dist, res = takePutt(s), pts = [], n = 30;
		var uEnd = res.made ? 1 : 1 - res.along / Math.max(dist, 0.5);
		for (var i = 0; i <= n; i++) { var u = uEnd * i / n; pts.push(puttWorld(u, res.kind === "cage" && u > 0.9 ? res.lateral : puttLat(u))); }
		var why = res.made ? "" : " \x01n\x01k\x01h" + puttWhy(res.kind, res.need, res.thrown, res.over);
		phase = "rolling";
		lastPath = pts;
		flyAlong(pts, 700 + dist * 40, function () {
			say(puttLine(res) + why + (res.ob ? " \x01h\x01rOB " + obWhere(res.ob) + "!" : ""));
			if (res.made) return holeOut();
			readyToThrow();
		});
		var BK = POVW.BASKET;   // in: the middle of the chains; off the cage: the tray's side; otherwise down on the ground
		anim.endHt = res.made ? (res.band ? (BK.chainsTop + BK.bandTop) / 2 : BK.chainsMid) : (res.kind === "cage" ? (BK.rim + BK.trayBottom) / 2 : 0.05);
		anim.lift = res.kind === "over" ? 1.0 : 0.3;   // sailing over: high enough to clear the band
	}

	// ---- end of a hole / round -----------------------------------------------------------------
	function holeOut() {
		R.strokes[holeIdx] = S.strokes;
		phase = "holeDone";
		var last = holeIdx === R.holes.length - 1;
		hud();
		openSheet("<h2>" + ctrlA(scoreName(S.strokes, S.H.par)) + "</h2><p class='label'>" + S.strokes + " on a par " + S.H.par +
			" · round " + (roundToPar() === 0 ? "even" : relText(roundToPar())) + "</p>" + scorecardHtml() +
			"<button class='go' id='goBtn' type='button'>" + (last ? "Finish" : "Hole " + (holeIdx + 2) + " →") + "</button>");
		$("goBtn").addEventListener("click", nextHole);
		$("goBtn").focus({ preventScroll: true });
	}
	function openSheet(h) { $("done").hidden = false; $("doneIn").innerHTML = h; }
	// The scorecard: a column a hole, out and in on 18 holes, and the total. A sum covers the holes played so far.
	function scorecardHtml() {
		var n = R.holes.length, cols = [], i;
		var range = function (a, b) { var r = []; for (var j = a; j < b; j++) r.push(j); return r; };
		for (i = 0; i < n; i++) {
			cols.push({ label: i + 1, holes: [i] });
			if (n === 18 && i === 8) cols.push({ label: "out", holes: range(0, 9), sum: true });
		}
		if (n === 18) cols.push({ label: "in", holes: range(9, 18), sum: true });
		cols.push({ label: "total", holes: range(0, n), sum: true });
		var cell = function (c, row) {
			var par = 0, you = 0, rel = 0, played = 0;
			c.holes.forEach(function (j) {
				par += R.holes[j].par;
				if (R.strokes[j]) { you += R.strokes[j]; rel += R.strokes[j] - R.holes[j].par; played++; }
			});
			var cls = c.sum ? "sum" : "";
			if (row === "par") return "<td class='" + cls + "'>" + par + "</td>";
			if (played) cls += rel < 0 ? " under" : (rel > 0 ? " overpar" : "");
			var txt = played ? String(you) : "";
			if (c.sum && played) txt += " <small>" + relText(rel) + "</small>";
			return "<td class='" + cls + "'>" + txt + "</td>";
		};
		var h = "<div class='scard'><table><caption class='label'>" + html(R.course.name) + "</caption><tr><th scope='row'>hole</th>";
		cols.forEach(function (c) { h += "<th scope='col'" + (c.sum ? " class='sum'" : "") + ">" + c.label + "</th>"; });
		h += "</tr><tr><th scope='row'>par</th>";
		cols.forEach(function (c) { h += cell(c, "par"); });
		h += "</tr><tr><th scope='row'>you</th>";
		cols.forEach(function (c) { h += cell(c, "you"); });
		return h + "</tr></table></div>";
	}
	function nextHole() {
		if (phase !== "holeDone") return;
		$("done").hidden = true;
		if (holeIdx < R.holes.length - 1) { holeIdx++; return beginHole(); }
		var total = R.strokes.reduce(function (a, b) { return a + b; }, 0), rel = roundToPar();
		phase = "roundDone";
		openSheet("<h2>Round done</h2><p class='label'>" + html(R.course.name) + ": " + total + " (" + (rel === 0 ? "even" : relText(rel)) + ")</p>" +
			scorecardHtml() + "<button class='go' id='againBtn' type='button'>Play another course</button>");
		$("againBtn").addEventListener("click", leaveRound);
		$("againBtn").focus({ preventScroll: true });
	}
	// The scorecard partway through a hole, with a way out of the round (it takes a second tap)
	function openCard() {
		if (!R || (phase !== "aim" && phase !== "putt")) return;
		cardOpen = true; $("cardBtn").setAttribute("aria-expanded", "true");
		openSheet("<h2>Scorecard</h2>" + scorecardHtml() +
			"<div class='row'><button class='go' id='closeCard' type='button'>Back to the hole</button>" +
			"<button class='tg quit' id='quitBtn' type='button'>Quit round</button></div>");
		$("closeCard").addEventListener("click", closeCard);
		$("quitBtn").addEventListener("click", function () {
			var b = $("quitBtn");
			if (b.classList.contains("sure")) return leaveRound();
			b.classList.add("sure"); b.textContent = "Tap again to quit";
		});
		$("closeCard").focus({ preventScroll: true });
	}
	function closeCard() {
		if (!cardOpen) return;
		cardOpen = false; $("cardBtn").setAttribute("aria-expanded", "false");
		$("done").hidden = true;
		$("cardBtn").focus({ preventScroll: true });
	}

	// ---- controls ----------------------------------------------------------------------------
	// THROW fires the moment it's pressed (a click waits for the release, which made the 3rd tap late).
	// preventDefault keeps it from taking focus, so SPACE never presses it a second time.
	$("throwBtn").addEventListener("pointerdown", function (e) { if (e.button) return; e.preventDefault(); press(e.timeStamp); });
	$("throwBtn").addEventListener("click", function (e) { if (e.detail === 0) press(); });   // Enter on the focused button
	$("viewBtn").addEventListener("click", function () { toggleView(); });
	$("discDot").addEventListener("click", function () { if (phase === "aim") { S.disc = (S.disc + 1) % bagDiscs().length; hud(); } });
	$("tStyle").addEventListener("click", function () { if (phase === "aim") { nextThrow(); hud(); } });
	$("tHand").addEventListener("click", function () { if (phase === "aim" || phase === "putt") { S.hand = S.hand === "R" ? "L" : "R"; hud(); } });
	$("tAngle").addEventListener("click", function () { if (phase === "aim" && S.style !== "TH") { S.angle = cycle(ANGLES, S.angle); hud(); } });
	$("cardBtn").addEventListener("click", function () { if (cardOpen) closeCard(); else openCard(); });
	// Aim: click or tap the map (the meter keeps going if it's running)
	function aimAt(ev, first) {
		if (!vw) return;
		if (phase === "putt") return aimPuttAt(ev);
		if (phase !== "aim") return;
		if (view === "pov") {   // in the view from the lie: tap or drag left and right to turn
			var x = ev.clientX - cv.getBoundingClientRect().left - box.x, F = (box.w / 2) / Math.tan(POVW.FOV / 2);
			if (first) pov.drag = pov.ang;
			return povAim(pov.drag + Math.atan((x - box.w / 2) / F));
		}
		var r = cv.getBoundingClientRect(), w = vw.s2w(ev.clientX - r.left, ev.clientY - r.top);
		var H = S.H;
		S.aim = { x: clamp(w.x, 0, (MAP_W - 1) * H.S), y: clamp(w.y, -AIM_PAST_ROWS * 2 * H.S, (MAP_H - 1 + AIM_PAST_ROWS) * 2 * H.S) };
		kick();
	}
	// Putting: tap or drag to aim off the basket, as far as the arrows go (aimPutt: 3 m either side).
	// Overhead: the spot across the line at the basket. From the player: left/right on the screen,
	// matched to where the aim mark is drawn (puttCamDrawn: the last putting camera drawn).
	var puttCamDrawn = null;
	function aimPuttAt(ev) {
		var r = cv.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top, lat;
		if (showingPov() && puttCamDrawn) {
			var x0 = puttCamDrawn.proj(puttWorld(1, 0), 1.0), x1 = puttCamDrawn.proj(puttWorld(1, 1), 1.0);
			if (!x0 || !x1 || x1.x === x0.x) return;
			lat = (x - box.x - x0.x) / (x1.x - x0.x);
		} else {
			var p = vw.s2w(x, y), b = S.H.basket;
			lat = (p.x - b.x) * PT.rx + (p.y - b.y) * PT.ry;
		}
		PT.aim = 0;
		aimPutt(Math.round(lat * 20) / 20);   // to 5 cm, kept inside the rules' limits
		hud();
	}
	var dragging = false;
	cv.addEventListener("pointerdown", function (e) { dragging = true; aimAt(e, true); });
	cv.addEventListener("pointermove", function (e) { if (dragging) aimAt(e); });
	window.addEventListener("pointerup", function () { dragging = false; });
	// The game's keys work only while the hole is showing: the menu, the scorecard and the end of a
	// round keep their own (SPACE and Enter press their buttons there)
	function gameKeys() { return $("menu").hidden && !cardOpen && phase !== "roundDone"; }
	window.addEventListener("keydown", function (e) {
		if (e.ctrlKey || e.metaKey || e.altKey || e.target.tagName === "INPUT") return;
		var k = e.key, K = k.toUpperCase();
		if (k === "Escape") { closeCard(); return; }
		if (!gameKeys()) return;
		kick();
		if (k === " " || k === "Enter") { if (e.target.tagName === "BUTTON" && k === "Enter") return; e.preventDefault(); if (!e.repeat) press(e.timeStamp); return; }
		if (K === "V" && (phase === "aim" || phase === "meter" || phase === "putt")) { toggleView(); return; }
		if (K === "C" && (phase === "aim" || phase === "putt")) { openCard(); return; }
		if (phase === "aim" && view === "pov") {
			var step = POVW.FOV / MAP_W;   // one of the door's columns
			if (k === "ArrowLeft") { povAim(pov.ang - step * (e.shiftKey ? 5 : 1)); e.preventDefault(); return; }
			if (k === "ArrowRight") { povAim(pov.ang + step * (e.shiftKey ? 5 : 1)); e.preventDefault(); return; }
			if (k === "ArrowUp" || k === "ArrowDown") { e.preventDefault(); return; }
		}
		if (phase === "aim") {
			var turn = vw && vw.tall;
			if (k === "ArrowLeft") { turn ? moveAim(0, -1) : moveAim(-1, 0); e.preventDefault(); }
			else if (k === "ArrowRight") { turn ? moveAim(0, 1) : moveAim(1, 0); e.preventDefault(); }
			else if (k === "ArrowUp") { turn ? moveAim(1, 0) : moveAim(0, -1); e.preventDefault(); }
			else if (k === "ArrowDown") { turn ? moveAim(-1, 0) : moveAim(0, 1); e.preventDefault(); }
			else if (K === "D") $("discDot").click();
			else if (K === "T") $("tStyle").click();
			else if (K === "A") $("tAngle").click();
			else if (K === "H") $("tHand").click();
			else if (/^[1-9]$/.test(k) && +k <= bagDiscs().length) { S.disc = +k - 1; hud(); }
		} else if (phase === "putt") {
			if (k === "ArrowLeft") { aimPutt(-0.25); hud(); e.preventDefault(); }
			else if (k === "ArrowRight") { aimPutt(0.25); hud(); e.preventDefault(); }
			else if (K === "H") $("tHand").click();
		}
	});
	// SPACE already pressed THROW on keydown; don't let it also click whatever button has focus
	window.addEventListener("keyup", function (e) { if (e.key === " " && e.target.tagName === "BUTTON" && gameKeys()) e.preventDefault(); });

	// ---- the view from the lie (the door's POV: pov.js) ------------------------------------------
	function startPov() {
		view = "pov";
		pov = { ang: Math.atan2(S.aim.y - S.lie.y, S.aim.x - S.lie.x) };
		povAim(pov.ang);
	}
	// Turn to an angle and aim along it, as the door's povSetAim: at the pin's distance, at least 15 m out
	function povAim(a) {
		pov.ang = a;
		var d = Math.max(pinDist(), 15);
		S.aim = { x: S.lie.x + d * Math.cos(a), y: S.lie.y + d * Math.sin(a) };
		windArrow(); kick();
	}
	// Putting, like the door: V switches overhead / from the player, and that's kept for the next putt
	function puttingNow() { return !!puttCam && (phase === "putt" || phase === "rolling" || aimingPutt()); }
	function toggleView() {
		if (S && puttingNow() && phase !== "rolling") {
			player.puttView = player.puttView === "pov" ? "top" : "pov";
			saveSettings();
			return syncView();
		}
		if (!S || !aimingThrow()) return;
		if (view === "pov") view = "map"; else if (pov) view = "pov"; else startPov();
		syncView();
	}
	function showingPov() {
		if (!S) return false;
		if (puttingNow()) return player.puttView === "pov";
		return view === "pov" && !!pov && aimingThrow();
	}
	// Which way the screen faces in the view from the lie (null on the map)
	function facing() { return !showingPov() ? null : (puttingNow() ? puttCam.ang : pov.ang); }
	function syncView() {
		var on = showingPov(), putting = puttingNow();
		$("viewBtn").textContent = on ? (putting ? "overhead" : "map") : (putting ? "from the player" : "view from lie");
		$("viewBtn").hidden = !(putting || aimingThrow());
		cv.setAttribute("aria-label", on ? "The view from your lie" : "The hole, seen from above");
		if (!on && !$("gapChip").hidden) { $("gapChip").hidden = true; layout(); }
		if (S) windArrow();
		kick();
	}
	function bearing() {
		var b = Math.atan2(S.H.basket.y - S.lie.y, S.H.basket.x - S.lie.x) - pov.ang;
		while (b > Math.PI) b -= 2 * Math.PI;
		while (b < -Math.PI) b += 2 * Math.PI;
		var deg = Math.round(b * 180 / Math.PI);
		return Math.abs(deg) < 2 ? "basket straight ahead" : "basket " + Math.abs(deg) + "° " + (deg < 0 ? "left" : "right");
	}
	function showChip(h) {
		var chip = $("gapChip");
		setHtml(chip, h);
		if (chip.hidden) { chip.hidden = false; layout(); }
	}
	// Drawn in the same box as the map, so the chips and the panel never sit on it
	function drawPov(now) {
		if (puttingNow()) return drawPuttPov(now);
		var w = Math.round(box.w), h = Math.round(box.h), C = POVW.cam(S.lie, pov.ang, w, h), line = aimLine();
		g.setTransform(dpr, 0, 0, dpr, dpr * box.x, dpr * box.y);
		g.save(); g.beginPath(); g.rect(0, 0, w, h); g.clip();
		g.drawImage(POVW.scene(S.H, C, dpr, line.red), 0, 0, w, h);
		POVW.rangePath(g, C, line.pts);
		POVW.basket(g, S.H, C);
		POVW.crosshair(g, C, S.aim);
		g.restore();
		var gp = POVW.gap(S.H, S.lie, pov.ang), red = Object.keys(line.red).length;
		showChip((gp.far ? "clear past " + ft(60) + " ft" : "gap " + Math.max(1, ft(gp.width)) + " ft wide · clear " + ft(gp.clear) + " ft") +
			" · " + bearing() + (red ? " · <span class='c-r hi'>" + red + " tree" + (red === 1 ? "" : "s") + " in the line</span>" : "") +
			"<span class='label kb'><br>←/→ to turn · V for the map</span><span class='label tap'> · drag to turn</span>");
	}

	// A putt from the player: looking at the basket, narrower than the 70 degree view so the basket is a good size.
	// Close in, the camera steps back along the line until the whole basket fits (its height at most
	// BASKET_FILL of the view), so a short putt shows the basket, the ground up to it, and where you stand.
	var PUTT_FOV = 40 * Math.PI / 180, BASKET_FILL = 0.6;
	function drawPuttPov(now) {
		var w = Math.round(box.w), h = Math.round(box.h), F = (w / 2) / Math.tan(PUTT_FOV / 2);
		var D = Math.max(PT.dist, POVW.BASKET.top * F / (BASKET_FILL * h)), back = D - PT.dist;
		var from = { x: puttCam.from.x + PT.bx * back, y: puttCam.from.y + PT.by * back };
		// look down just enough that the foot of the basket sits low in the view, with the ground up to it showing
		var tilt = Math.max(0, Math.atan(1.6 / Math.max(D, 1)) - Math.atan(0.33 * h / F));
		var C = POVW.cam(from, puttCam.ang, w, h, PUTT_FOV, tilt);
		C.skipNear = back + CLEARING_M;   // no trees between the camera and the player
		puttCamDrawn = C;
		g.setTransform(dpr, 0, 0, dpr, dpr * box.x, dpr * box.y);
		g.save(); g.beginPath(); g.rect(0, 0, w, h); g.clip();
		g.drawImage(POVW.scene(S.H, C, dpr), 0, 0, w, h);
		var a = animAt(now), inChains = a && a.endHt > 1 && a.e > 0.85;
		if (inChains) drawPuttDisc(g, C, a);   // going in: the basket's chains and tray are drawn over it
		POVW.basket(g, S.H, C, PT.dist);
		if (a && !inChains) drawPuttDisc(g, C, a);
		if (phase !== "rolling") POVW.puttAim(g, C, puttCam.from, puttWorld(1, PT.aim));
		g.restore();
		showChip(ft(PT.dist) + " ft · " + puttAimText(" of the basket") +
			" · " + fadeText().toLowerCase() + "<span class='label kb'><br>←/→ to aim · V for overhead</span><span class='label tap'> · tap or drag to aim</span>");
	}

	// The putt in the air: let go at 1 m, a small rise, then the height it ends at (anim.endHt)
	function drawPuttDisc(g, C, a) {
		var end = a.endHt === undefined ? 1.1 : a.endHt;
		var lift = a.lift || 0.3, hts = function (f) { return 1.0 + (end - 1.0) * f * f + lift * Math.sin(f * Math.PI); };
		var trail = [];
		for (var i = 0; i <= a.i0; i++) trail.push({ p: a.path[i], ht: hts(i / a.n) });
		trail.push({ p: a.at, ht: hts(a.e) });
		POVW.disc(g, C, a.at, Math.max(0.03, hts(a.e)), trail);
	}

	// The line being aimed: the flight of a perfect, full-power throw with no wind (pts: from the lie,
	// the last point where it lands), and the trees it runs into or passes within half a metre of
	// (red: trunk index -> 1). Worked out again only when the lie, the aim or the throw changes.
	var PATH_MARGIN = 0.5, lineCache = { key: "", line: null };
	function aimLine() {
		var d = curDisc(), key = [holeIdx, S.lie.x, S.lie.y, S.aim.x, S.aim.y, d.key, S.style, S.angle, S.hand, S.pitch].join("|");
		if (lineCache.key === key) return lineCache.line;
		var H = S.H, sh = throwShape(1, false); applyAngle(sh);
		var discR = S.pitch ? 0.04 : 0.11, pts = [S.lie], red = {}, i;
		for (i = 1; i <= 100; i++) pts.push(idealPoint(sh, i / 100));
		H.trunks.forEach(function (t, j) {
			if (hyp(t.x - S.lie.x, t.y - S.lie.y) <= CLEARING_M) return;
			for (var i = 1; i < pts.length; i++) {
				if (sh.tomahawk && i < pts.length * 0.8) continue;   // a tomahawk is over the trees until it comes down
				var a = pts[i - 1], b = pts[i], dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1e-9;
				var q = clamp(((t.x - a.x) * dx + (t.y - a.y) * dy) / L2, 0, 1);
				if (hyp(t.x - a.x - q * dx, t.y - a.y - q * dy) < t.rad + discR + PATH_MARGIN) { red[j] = 1; return; }
			}
		});
		lineCache = { key: key, line: { pts: pts, red: red } };
		return lineCache.line;
	}

	// ---- drawing ---------------------------------------------------------------------------------
	var raf = 0;
	// Something changed: draw a frame (once, however many things changed before it)
	function kick() { if (!raf) raf = requestAnimationFrame(frame); }
	function frame(now) {
		raf = 0;
		meterTick(now);
		draw(now);
		finishAnim(now);
		if (anim || phase === "meter") kick();   // still moving
	}
	function draw(now) {
		g.setTransform(1, 0, 0, 1, 0, 0);
		g.fillStyle = "#2c4a27"; g.fillRect(0, 0, cv.width, cv.height);
		if (!S || !pic || !vw || !$("menu").hidden) return;
		if (showingPov()) return drawPov(now);
		vw.apply(g, dpr);
		g.imageSmoothingEnabled = true;
		g.drawImage(pic.canvas, 0, 0, pic.mw, pic.mh);
		var px = 1 / vw.sc;                                  // one screen pixel, in metres
		if (aimingThrow()) DRAW.aimOverlay(g, S.H, aimLine(), S.aim, px);
		if (aimingPutt()) DRAW.puttLine(g, S.lie, puttWorld(1, PT.aim), px);
		var A = animAt(now);
		if (A) DRAW.trail(g, A, px);
		DRAW.basket(g, S.H.basket, px);
		DRAW.player(g, A && phase === "fly" ? lastPath[0] : S.lie, px);
		if (A) DRAW.disc(g, A.at, Math.sin(A.t * Math.PI) * (phase === "fly" ? 6 : 1.5), px);
	}

	loadSettings();
	showMenu();
	layout();
})();
