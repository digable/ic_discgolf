// IC Disc Golf web: the screens, controls and animation around the game's own rules
// (../bbs/lib: startRound, startHole, takeThrow, puttSetup, takePutt...). The rules decide
// everything; this file only draws them and takes the player's input.
"use strict";

(function () {
	var $ = function (id) { return document.getElementById(id); };
	var cv = $("map"), g = cv.getContext("2d"), dpr = 1;
	var pic = null, vw = null, box = null;
	var phase = "menu";        // menu, aim, meter, fly, putt, rolling, holeDone, roundDone
	var holeIdx = 0, anim = null, sw = null, meter = null, message = "", lastPath = null;
	var reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
	var view = "map", pov = null, inPath = {};   // map or the view from the lie (pov: {ang}); trees the throw's line runs into

	// ---- text from the door's own wording (Ctrl-A colour codes -> HTML) ----------------------
	var CA = { k: "c-k", r: "c-r", g: "c-g", y: "c-y", b: "c-b", m: "c-m", c: "c-c", w: "c-w" };
	function ctrlA(s) {
		s = cp(s);
		var out = "", cls = [], open = false, i, ch;
		var esc = function (t) { return t.replace(/&/g, "&amp;").replace(/</g, "&lt;"); };
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
	var CP437 = { "\x80": "Ç", "\x81": "ü", "\x82": "é", "\x83": "â", "\x84": "ä", "\x85": "à", "\x86": "å", "\x87": "ç", "\x88": "ê", "\x89": "ë", "\x8a": "è",
		"\x8b": "ï", "\x8c": "î", "\x8d": "ì", "\x8e": "Ä", "\x8f": "Å", "\x90": "É", "\x91": "æ", "\x92": "Æ", "\x93": "ô", "\x94": "ö", "\x95": "ò", "\x96": "û",
		"\x97": "ù", "\x98": "ÿ", "\x99": "Ö", "\x9a": "Ü", "\xa0": "á", "\xa1": "í", "\xa2": "ó", "\xa3": "ú", "\xa4": "ñ", "\xa5": "Ñ" };
	function cp(t) { return String(t).replace(/[\x80-\xa5]/g, function (c) { return CP437[c] || c; }); }
	function say(s) {
		message = s; $("msg").innerHTML = ctrlA(s); $("msg").hidden = !s;
		if (S) layout();
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
		if (S) vw = DRAW.view(S.H, box);
	}
	window.addEventListener("resize", function () { layout(); });

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
			v.addEventListener("click", function () { useTraced[i] = !useTraced[i]; listCourses(); });
			li.appendChild(v);
		}
		return li;
	}
	function listCourses() {
		var q = $("search").value.trim().toLowerCase(), ul = $("courses");
		ul.innerHTML = "";
		COURSES.map(function (C, i) { return i; }).filter(function (i) { return !COURSES[i].of; })
			.sort(function (a, b) { return sortName(COURSES[a].name) < sortName(COURSES[b].name) ? -1 : 1; })
			.filter(function (i) { return !q || (COURSES[i].name + " " + COURSES[i].where).toLowerCase().indexOf(q) >= 0; })
			.forEach(function (i) { ul.appendChild(courseRow(i)); });
	}
	function syncOpts() {
		document.querySelectorAll("[data-opt]").forEach(function (b) { b.classList.toggle("on", String(player[b.dataset.opt]) === b.dataset.v); });
	}
	document.querySelectorAll("[data-opt]").forEach(function (b) {
		b.addEventListener("click", function () { player[b.dataset.opt] = b.dataset.v; syncOpts(); });
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
		if (phase === "aim" && lieInTrees()) startPov();
		meterReset(); hud(); syncView();
	}

	// ---- the panel ---------------------------------------------------------------------------
	function hud() {
		var d = curDisc();
		$("hCourse").textContent = cp(R.course.name); $("hHole").textContent = S.H.num + "/" + R.holes.length;
		$("hPar").textContent = S.H.par; $("hPin").textContent = ft(pinDist()) + " ft";
		$("hThrow").textContent = S.strokes + 1;
		var rel = roundToPar(); $("hRound").textContent = rel === 0 ? "E" : (rel > 0 ? "+" + rel : String(rel));
		var putting = phase === "putt";
		var pd = putting ? puttDisc() : d;
		$("dName").textContent = pd.name; $("dWeight").textContent = (pd.g || MAX_G) + "g";
		$("dNums").innerHTML = pd.n.map(function (n) { return "<span>" + n + "</span>"; }).join("");
		$("dRange").textContent = putting ? "putting · " + (PT.aim ? Math.abs(Math.round(PT.aim * FT)) + " ft " + (PT.aim < 0 ? "left" : "right") : "straight at it")
			: "max " + ft(discRange(d, S.style, domHand()) * (S.pitch ? PITCH_POWER : 1)) + " ft";
		$("discDot").style.background = discColor(pd);
		$("tStyle").textContent = S.pitch ? "pitch-out" : styleName(S.style).toLowerCase();
		$("tHand").textContent = handName(S.hand).toLowerCase() + (domHand() ? "" : " (off)");
		$("tAngle").textContent = S.style === "TH" ? "-" : angleName(S.angle).toLowerCase();
		$("tStyle").disabled = $("tAngle").disabled = $("discDot").disabled = putting;
		$("wText").textContent = S.wind.mph ? S.wind.mph + " mph" : "calm";
		if (vw) {
			var a = vw.w2s({ x: 0, y: 0 }), b = vw.w2s({ x: S.wind.x, y: S.wind.y });
			$("wArrow").style.transform = "rotate(" + (Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI + 90) + "deg)";
			$("wArrow").style.opacity = S.wind.mph ? 1 : 0.3;
		}
	}
	var TYPE_COL = { P: "#f2f2f2", A: "#7fd3ff", M: "#ffd84d", F: "#ff9f43", D: "#ff5d5d" };
	function discColor(d) { return "radial-gradient(circle at 35% 30%, #fff, " + (TYPE_COL[d.type] || "#ffd84d") + " 55%, rgba(0,0,0,.35))"; }

	// ---- the meter (the same 3 clicks and timing as the door: meter.js's posAt and powerAt) --------
	function meterReset() {
		meter = null; sw = null;
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
		var e = now / 1000 - meter.start, p = meterPos(e);
		if (p < 0) return release({ whiff: true, power: meter.power === null ? 30 : meter.power, over: meter.over });
		$("mark").style.left = pctOf(p);
	}
	function release(s) {
		var putting = meter.putting; meter = null;
		if (putting) return doPutt(s);
		doThrow(s);
	}

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
	function flyAlong(path, ms, done) {
		if (reduceMotion) ms = 1;
		anim = { path: path, start: performance.now(), ms: ms, done: done };
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
	}

	// ---- end of a hole / round -----------------------------------------------------------------
	function holeOut() {
		R.strokes[holeIdx] = S.strokes;
		phase = "holeDone";
		var last = holeIdx === R.holes.length - 1;
		$("done").hidden = false;
		$("doneIn").innerHTML = "<h2>" + ctrlA(scoreName(S.strokes, S.H.par)) + "</h2><p class='label'>" + S.strokes + " on a par " + S.H.par +
			" · round " + (roundToPar() === 0 ? "even" : (roundToPar() > 0 ? "+" : "") + roundToPar()) + "</p>" + scorecardHtml() +
			"<button class='go' id='goBtn' type='button'>" + (last ? "Finish" : "Hole " + (holeIdx + 2) + " →") + "</button>";
		$("goBtn").addEventListener("click", nextHole);
		$("goBtn").focus({ preventScroll: true });
	}
	function scorecardHtml() {
		var h = "<div class='scard'><table><tr><th>hole</th>", i;
		for (i = 0; i < R.holes.length; i++) h += "<th>" + (i + 1) + "</th>";
		h += "</tr><tr><td>par</td>";
		for (i = 0; i < R.holes.length; i++) h += "<td>" + R.holes[i].par + "</td>";
		h += "</tr><tr><td>you</td>";
		for (i = 0; i < R.holes.length; i++) {
			var s = R.strokes[i], d = s ? s - R.holes[i].par : 0;
			h += "<td class='" + (s ? (d < 0 ? "under" : d > 0 ? "overpar" : "") : "") + "'>" + (s || "") + "</td>";
		}
		return h + "</tr></table></div>";
	}
	function nextHole() {
		if (phase !== "holeDone") return;
		$("done").hidden = true;
		if (holeIdx < R.holes.length - 1) { holeIdx++; return beginHole(); }
		var total = R.strokes.reduce(function (a, b) { return a + b; }, 0), rel = roundToPar();
		phase = "roundDone";
		$("done").hidden = false;
		$("doneIn").innerHTML = "<h2>Round done</h2><p class='label'>" + R.course.name + ": " + total + " (" + (rel === 0 ? "even" : (rel > 0 ? "+" : "") + rel) + ")</p>" +
			scorecardHtml() + "<button class='go' id='againBtn' type='button'>Play another course</button>";
		$("againBtn").addEventListener("click", function () { endRound(); S = null; showMenu(); });
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
	$("cardBtn").addEventListener("click", function () {
		if (!R || phase === "holeDone" || phase === "roundDone") return;
		var d = $("done"); d.hidden = !d.hidden;
		$("doneIn").innerHTML = "<h2>Scorecard</h2>" + scorecardHtml() + "<button class='go' id='closeCard' type='button'>Back to the hole</button>";
		$("closeCard").addEventListener("click", function () { d.hidden = true; });
	});
	// Aim: click or tap the map (the meter keeps going if it's running)
	function aimAt(ev, first) {
		if (phase !== "aim" || !vw) return;
		if (view === "pov") {   // in the view from the lie: tap or drag left and right to turn
			var x = ev.clientX - cv.getBoundingClientRect().left - box.x, F = (box.w / 2) / Math.tan(POVW.FOV / 2);
			if (first) pov.drag = pov.ang;
			return povAim(pov.drag + Math.atan((x - box.w / 2) / F));
		}
		var r = cv.getBoundingClientRect(), w = vw.s2w(ev.clientX - r.left, ev.clientY - r.top);
		var H = S.H;
		S.aim = { x: clamp(w.x, 0, (MAP_W - 1) * H.S), y: clamp(w.y, -AIM_PAST_ROWS * 2 * H.S, (MAP_H - 1 + AIM_PAST_ROWS) * 2 * H.S) };
	}
	var dragging = false;
	cv.addEventListener("pointerdown", function (e) { dragging = true; aimAt(e, true); });
	cv.addEventListener("pointermove", function (e) { if (dragging) aimAt(e); });
	window.addEventListener("pointerup", function () { dragging = false; });
	window.addEventListener("keydown", function (e) {
		if (e.ctrlKey || e.metaKey || e.altKey || e.target.tagName === "INPUT") return;
		var k = e.key, K = k.toUpperCase();
		if (k === " " || k === "Enter") { if (e.target.tagName === "BUTTON" && k === "Enter") return; e.preventDefault(); if (!e.repeat) press(e.timeStamp); return; }
		if (K === "V" && (phase === "aim" || phase === "meter")) { toggleView(); return; }
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
	window.addEventListener("keyup", function (e) { if (e.key === " " && e.target.tagName === "BUTTON") e.preventDefault(); });

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
	}
	function toggleView() {
		if (!S || (phase !== "aim" && phase !== "meter") || (meter && meter.putting)) return;
		if (view === "pov") view = "map"; else if (pov) view = "pov"; else startPov();
		syncView();
	}
	function showingPov() { return view === "pov" && pov && (phase === "aim" || (phase === "meter" && meter && !meter.putting)); }
	function syncView() {
		var on = showingPov();
		$("viewBtn").textContent = on ? "map" : "view from lie";
		$("viewBtn").hidden = !(phase === "aim" || (phase === "meter" && meter && !meter.putting));
		if (!on && !$("gapChip").hidden) { $("gapChip").hidden = true; layout(); }
	}
	function bearing() {
		var b = Math.atan2(S.H.basket.y - S.lie.y, S.H.basket.x - S.lie.x) - pov.ang;
		while (b > Math.PI) b -= 2 * Math.PI;
		while (b < -Math.PI) b += 2 * Math.PI;
		var deg = Math.round(b * 180 / Math.PI);
		return Math.abs(deg) < 2 ? "basket straight ahead" : "basket " + Math.abs(deg) + "° " + (deg < 0 ? "left" : "right");
	}
	// Drawn in the same box as the map, so the chips and the panel never sit on it
	function drawPov() {
		var w = Math.round(box.w), h = Math.round(box.h), C = POVW.cam(S.lie, pov.ang, w, h);
		g.setTransform(dpr, 0, 0, dpr, dpr * box.x, dpr * box.y);
		g.save(); g.beginPath(); g.rect(0, 0, w, h); g.clip();
		g.drawImage(POVW.scene(S.H, C, dpr, inPath), 0, 0, w, h);
		var sh = throwShape(1, false); applyAngle(sh);
		POVW.rangePath(g, C, sh, S.lie, sh.dist);
		POVW.basket(g, S.H, C);
		POVW.crosshair(g, C, S.aim);
		g.restore();
		var gp = POVW.gap(S.H, S.lie, pov.ang), red = Object.keys(inPath).length;
		var chip = $("gapChip");
		if (chip.hidden) { chip.hidden = false; layout(); }
		chip.innerHTML = (gp.far ? "clear past " + ft(60) + " ft" : "gap " + Math.max(1, ft(gp.width)) + " ft wide · clear " + ft(gp.clear) + " ft") +
			" · " + bearing() + (red ? " · <span class='c-r hi'>" + red + " tree" + (red === 1 ? "" : "s") + " in the line</span>" : "") +
			"<span class='label kb'><br>←/→ to turn · V for the map</span><span class='label tap'> · drag to turn</span>";
	}

	// The trees a perfect, full-power throw on this line runs into (or passes within half a metre of)
	var PATH_MARGIN = 0.5;
	function treesInPath() {
		var out = {}, H = S.H, sh = throwShape(1, false); applyAngle(sh);
		var discR = S.pitch ? 0.04 : 0.11, pts = [S.lie];
		for (var u = 0.01; u <= 1.0001; u += 0.01) pts.push(idealPoint(sh, u));
		H.trunks.forEach(function (t, j) {
			if (hyp(t.x - S.lie.x, t.y - S.lie.y) <= CLEARING_M) return;
			for (var i = 1; i < pts.length; i++) {
				if (sh.tomahawk && i < pts.length * 0.8) continue;   // a tomahawk is over the trees until it comes down
				var a = pts[i - 1], b = pts[i], dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1e-9;
				var q = clamp(((t.x - a.x) * dx + (t.y - a.y) * dy) / L2, 0, 1);
				if (hyp(t.x - a.x - q * dx, t.y - a.y - q * dy) < t.rad + discR + PATH_MARGIN) { out[j] = 1; return; }
			}
		});
		return out;
	}

	// ---- each frame ----------------------------------------------------------------------------
	function frame(now) {
		requestAnimationFrame(frame);
		meterTick(now);
		g.setTransform(1, 0, 0, 1, 0, 0);
		g.fillStyle = "#2c4a27"; g.fillRect(0, 0, cv.width, cv.height);
		if (!S || !pic || !vw) return;
		var aiming = phase === "aim" || (phase === "meter" && meter && !meter.putting);
		inPath = aiming ? treesInPath() : {};
		if (showingPov()) { drawPov(); if (phase === "aim") hud(); return; }
		vw.apply(g, dpr);
		g.imageSmoothingEnabled = true;
		g.drawImage(pic.canvas, 0, 0, pic.mw, pic.mh);
		var px = 1 / vw.sc;                                  // one screen pixel, in metres
		// the range mark and its flight (what a perfect 100% throw does, no wind), while aiming
		if (phase === "aim" || (phase === "meter" && !meter.putting)) {
			var sh = throwShape(1, false); applyAngle(sh);
			g.save(); g.setLineDash([2 * px, 7 * px]); g.lineCap = "round"; g.lineWidth = 3 * px; g.strokeStyle = "rgba(255,255,255,.9)";
			g.beginPath(); g.moveTo(S.lie.x, S.lie.y);
			for (var u = 0.02; u <= 1.0001; u += 0.02) { var p = idealPoint(sh, u); g.lineTo(p.x, p.y); }
			g.stroke(); g.restore();
			// trees in the line: a red ring around the crown
			S.H.trunks.forEach(function (t, j) {
				if (!inPath[j]) return;
				var r = clamp(S.H.S * (1.1 + ((j * 37) % 17) / 17), 1.2, 4);
				g.fillStyle = "rgba(255,60,60,.35)"; g.strokeStyle = "#ff3b3b"; g.lineWidth = 2.5 * px;
				g.beginPath(); g.arc(t.x, t.y, r, 0, 7); g.fill(); g.stroke();
			});
			var land = idealPoint(sh, 1);
			g.fillStyle = "rgba(255,255,255,.25)"; g.strokeStyle = "#fff"; g.lineWidth = 2.5 * px;
			g.beginPath(); g.arc(land.x, land.y, 11 * px, 0, 7); g.fill(); g.stroke();
			// the aim point
			g.strokeStyle = "rgba(255,120,220,.95)"; g.lineWidth = 2 * px;
			g.beginPath(); g.moveTo(S.aim.x - 7 * px, S.aim.y); g.lineTo(S.aim.x + 7 * px, S.aim.y); g.moveTo(S.aim.x, S.aim.y - 7 * px); g.lineTo(S.aim.x, S.aim.y + 7 * px); g.stroke();
		}
		// lining up a putt: the line at the aim spot
		if (phase === "putt" || (phase === "meter" && meter.putting)) {
			var tgt = puttWorld(1, PT.aim);
			g.save(); g.setLineDash([2 * px, 6 * px]); g.lineWidth = 2.5 * px; g.strokeStyle = "rgba(255,255,255,.85)";
			g.beginPath(); g.moveTo(S.lie.x, S.lie.y); g.lineTo(tgt.x, tgt.y); g.stroke(); g.restore();
		}
		// the disc in flight, and its trail
		var at = null;
		if (anim) {
			var t = clamp((now - anim.start) / anim.ms, 0, 1), path = anim.path, n = path.length - 1;
			var e = 1 - Math.pow(1 - t, 1.6), fi = e * n, i0 = Math.floor(fi), fr = fi - i0;
			var a = path[Math.min(i0, n)], b = path[Math.min(i0 + 1, n)];
			at = { x: a.x + (b.x - a.x) * fr, y: a.y + (b.y - a.y) * fr };
			g.strokeStyle = "rgba(255,240,150,.8)"; g.lineWidth = 2 * px; g.beginPath(); g.moveTo(path[0].x, path[0].y);
			for (var j = 1; j <= i0 && j <= n; j++) g.lineTo(path[j].x, path[j].y);
			g.lineTo(at.x, at.y); g.stroke();
			if (t >= 1) { var dn = anim.done; anim = null; dn(); }
		}
		// the basket: drawn at a fixed size on screen, so it's easy to find on a long hole
		var bk = S.H.basket;
		g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(bk.x + 4 * px, bk.y + 5 * px, 11 * px, 7 * px, 0, 0, 7); g.fill();
		g.fillStyle = "#ffd400"; g.beginPath(); g.arc(bk.x, bk.y, 9 * px, 0, 7); g.fill();
		g.strokeStyle = "#4a4a4a"; g.lineWidth = 2 * px; g.beginPath(); g.arc(bk.x, bk.y, 5.5 * px, 0, 7); g.stroke();
		// the player (and the disc in the air)
		var me = S.lie;
		if (at && phase === "fly") me = lastPath[0];
		g.fillStyle = "#fff"; g.strokeStyle = "#0b1020"; g.lineWidth = 3 * px;
		g.beginPath(); g.arc(me.x, me.y, 7 * px, 0, 7); g.fill(); g.stroke();
		if (at) {
			var h = Math.sin(Math.min(1, (now - (anim ? anim.start : now)) / (anim ? anim.ms : 1)) * Math.PI) * (phase === "fly" ? 6 : 1.5);
			g.fillStyle = "rgba(0,0,0,.3)"; g.beginPath(); g.arc(at.x + h * 0.4, at.y + h * 0.5, 5 * px, 0, 7); g.fill();
			g.fillStyle = "#ffd84d"; g.strokeStyle = "#7a5a00"; g.lineWidth = 1.5 * px;
			g.beginPath(); g.arc(at.x, at.y, (5 + h * 0.6) * px, 0, 7); g.fill(); g.stroke();
		}
		if (phase === "aim" || phase === "putt") hud();
	}

	showMenu();
	layout();
	requestAnimationFrame(frame);
})();
