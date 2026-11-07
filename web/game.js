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

	// ---- text from the door's own wording (Ctrl-A colour codes -> HTML) ----------------------
	var CA = { k: "c-k", r: "c-r", g: "c-g", y: "c-y", b: "c-b", m: "c-m", c: "c-c", w: "c-w" };
	function ctrlA(s) {
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
	function say(s) { message = s; $("msg").innerHTML = ctrlA(s); $("msg").hidden = !s; }

	// ---- layout -----------------------------------------------------------------------------
	function layout() {
		dpr = Math.min(window.devicePixelRatio || 1, 2);
		var w = window.innerWidth, h = window.innerHeight;
		cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
		cv.style.width = w + "px"; cv.style.height = h + "px";
		var top = $("top").getBoundingClientRect(), pan = $("panel").getBoundingClientRect();
		box = { x: 8, y: top.bottom + 6, w: w - 16, h: Math.max(80, pan.top - top.bottom - 12) };
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
		b.querySelector("b").textContent = COURSES[i].name;
		b.querySelector(".label").textContent = C.where + ", " + C.country;
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
		meterReset(); hud();
	}

	// ---- the panel ---------------------------------------------------------------------------
	function hud() {
		var d = curDisc();
		$("hCourse").textContent = R.course.name; $("hHole").textContent = S.H.num + "/" + R.holes.length;
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
		$("mark").style.left = pctOf(0); $("pressP").hidden = true;
		$("mLabel").innerHTML = phase === "putt" ? "Putt: tap <b>THROW</b> (or SPACE) to start" : "Tap <b>THROW</b> (or press SPACE) to reach back";
		$("throwBtn").textContent = phase === "putt" ? "PUTT" : "THROW";
	}
	function pctOf(col) { return (col / (BAR_W - 1) * 100) + "%"; }
	$("snap").style.left = pctOf(SNAP - 0.5); $("snap").style.width = (SNAP_W / (BAR_W - 1) * 100) + "%";
	$("p100").style.left = pctOf(P100);
	document.querySelector("#bar .over").style.left = pctOf(P100);
	// the power marks: 0% is the yellow release zone, 100% the white line (as on the BBS meter)
	document.querySelectorAll(".ticks span").forEach(function (sp, i) { sp.style.left = pctOf(SNAP_MID + i / 4 * (P100 - SNAP_MID)); });
	function press() {
		if (phase === "holeDone") return nextHole();
		if (phase !== "aim" && phase !== "putt" && phase !== "meter") return;
		var t = performance.now() / 1000;
		if (!meter) { meter = { start: t, power: null, over: false, turnT: null, turnPos: 0, putting: phase === "putt" }; phase = "meter";
			$("mLabel").textContent = "Reach back... tap again for power"; return; }
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
	$("throwBtn").addEventListener("click", press);
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
	function aimAt(ev) {
		if (phase !== "aim" || !vw) return;
		var r = cv.getBoundingClientRect(), w = vw.s2w(ev.clientX - r.left, ev.clientY - r.top);
		var H = S.H;
		S.aim = { x: clamp(w.x, 0, (MAP_W - 1) * H.S), y: clamp(w.y, -AIM_PAST_ROWS * 2 * H.S, (MAP_H - 1 + AIM_PAST_ROWS) * 2 * H.S) };
	}
	var dragging = false;
	cv.addEventListener("pointerdown", function (e) { dragging = true; aimAt(e); });
	cv.addEventListener("pointermove", function (e) { if (dragging) aimAt(e); });
	window.addEventListener("pointerup", function () { dragging = false; });
	window.addEventListener("keydown", function (e) {
		if (e.ctrlKey || e.metaKey || e.altKey || e.target.tagName === "INPUT") return;
		var k = e.key, K = k.toUpperCase();
		if (k === " " || k === "Enter") { if (e.target.tagName === "BUTTON" && k === "Enter") return; e.preventDefault(); if (!e.repeat) press(); return; }
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

	// ---- each frame ----------------------------------------------------------------------------
	function frame(now) {
		requestAnimationFrame(frame);
		meterTick(now);
		g.setTransform(1, 0, 0, 1, 0, 0);
		g.fillStyle = "#2c4a27"; g.fillRect(0, 0, cv.width, cv.height);
		if (!S || !pic || !vw) return;
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
