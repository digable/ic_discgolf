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

	// ---- text (text.js: the door's wording as HTML) ------------------------------------------------
	var esc = TEXT.esc, cp = TEXT.cp, html = TEXT.html, ctrlA = TEXT.ctrlA;
	// Sets an element's HTML only when it changed (no layout work for the same text every frame)
	function setHtml(el, h) { if (el._html !== h) { el._html = h; el.innerHTML = h; } }
	var lastSaid = "";         // the last result shown (the hole-done screen repeats how the hole ended)
	function say(s) {
		lastSaid = s;
		$("msg").innerHTML = ctrlA(s); $("msg").hidden = !s;
		if (S) layout();
	}
	function relText(rel) { return rel === 0 ? "E" : (rel > 0 ? "+" + rel : String(rel)); }

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

	// ---- the menu (menu.js: Play, Setup, Bag, House rules) ------------------------------------------
	function showMenu() {
		phase = "menu"; $("done").hidden = true;
		MENU.show();
	}

	// ---- a round ----------------------------------------------------------------------------
	function play(ci) {
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
		if (inPuttRange()) {
			puttSetup();
			// a tap-in: inside 4 ft the disc is dropped in (one more throw), not putted. Say so, so a hole
			// that ends without a throw going in doesn't look like it did.
			if (isTapIn()) {
				var from = Math.max(1, ft(PT.dist));
				tapIn();
				return holeOut("\x01h\x01gTap-in.\x01n It stopped " + from + " ft from the basket, so you dropped it in \x01k\x01h(+1 throw)\x01n.");
			}
			phase = "putt";
		}
		else phase = "aim";
		relief = null;
		view = "map"; pov = null;
		puttCam = phase === "putt" ? { from: { x: S.lie.x, y: S.lie.y }, ang: Math.atan2(-PT.by, -PT.bx) } : null;
		if (phase === "aim" && lieInTrees()) startPov();
		meterReset(); hud(); syncView();
	}
	// Back to the course menu, from the end of a round or partway through one
	function leaveRound() {
		anim = null; meter = null; cardOpen = false; pov = null; puttCam = null; relief = null;
		$("cardBtn").setAttribute("aria-expanded", "false");
		$("reliefBtn").hidden = $("mullBtn").hidden = true;
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
		// the throw, hand and angle switches: every choice, the one in use filled in. Putting uses
		// neither a throw nor an angle; a tomahawk has no angle. The hand you don't throw with says "off".
		segHtml("tStyle", throwChoices().map(function (t) { return [t, t === "PO" ? "pitch-out" : styleName(t).toLowerCase()]; }), S.pitch ? "PO" : S.style, putting);
		segHtml("tHand", HANDS.map(function (h) { return [h, handName(h).toLowerCase() + (h === player.hand ? "" : " <small>off</small>")]; }), S.hand, false);
		segHtml("tAngle", [["H", "hyzer"], ["F", "flat"], ["A", "anhyzer"]], S.style === "TH" ? null : S.angle, putting || S.style === "TH");
		$("discDot").disabled = putting;
		$("wText").textContent = S.wind.mph ? S.wind.mph + " mph" : "calm";
		// relief (any throw, as the door's R) and a mulligan (the throw just taken, if the house rules give one)
		$("reliefBtn").hidden = phase !== "aim";
		$("reliefBtn").querySelector(".v").textContent = "relief" + (R.rules.reliefStroke ? " +1" : "");
		var mull = (phase === "aim" || phase === "putt") && canMulligan();
		$("mullBtn").hidden = !mull;
		if (mull) $("mullBtn").querySelector(".v").textContent = "mulligan (" + mulligansLeft() + " left)";
		windArrow();
		kick();
	}
	// Where the putt is aimed, in whole feet ("3 ft left" + of, or "straight at it" under half a foot)
	function puttAimText(of) {
		var f = Math.round(Math.abs(PT.aim) * FT);
		return f ? f + " ft " + (PT.aim < 0 ? "left" : "right") + of : "straight at it";
	}
	// One switch: opts [value, label], cur the value in use (filled in), off: the whole switch can't be used now
	function segHtml(id, opts, cur, off) {
		setHtml($(id), opts.map(function (o) {
			return "<button type='button' data-v='" + o[0] + "' aria-pressed='" + (o[0] === cur) + "'" + (off ? " disabled" : "") + ">" + o[1] + "</button>";
		}).join(""));
		$(id).classList.toggle("off", !!off);
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
	// The hole's done. The screen repeats how it ended (the last result), and then: a tap-in's note, that it
	// was dropped in rather than thrown in
	function holeOut(then) {
		var how = lastSaid;
		if (then) say(then);
		R.strokes[holeIdx] = S.strokes;
		phase = "holeDone";
		var last = holeIdx === R.holes.length - 1;
		hud();
		var ending = [how, then].filter(function (s) { return s; }).map(ctrlA).join("<br>");
		openSheet("<h2>" + ctrlA(scoreName(S.strokes, S.H.par)) + "</h2>" + (ending ? "<p class='how'>" + ending + "</p>" : "") +
			"<p class='label'>" + S.strokes + " on a par " + S.H.par +
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
	// The view switch: the view you're on is lit; tapping the other one switches (as V does)
	$("viewSeg").addEventListener("click", function (e) {
		var b = e.target.closest("button[data-view]");
		if (b && b.getAttribute("aria-pressed") !== "true") toggleView();
	});
	$("discDot").addEventListener("click", function () { if (phase === "aim") { S.disc = (S.disc + 1) % bagDiscs().length; hud(); } });
	// The throw, hand and angle: a tap picks that choice; T, H and A cycle them (as on the BBS)
	function setThrow(t) { if (phase !== "aim") return; S.pitch = t === "PO"; S.style = S.pitch ? "BH" : t; hud(); }
	function setHand(h) { if (phase !== "aim" && phase !== "putt") return; S.hand = h; hud(); }
	function setAngle(a) { if (phase !== "aim" || S.style === "TH") return; S.angle = a; hud(); }
	$("toggles").addEventListener("click", function (e) {
		var b = e.target.closest("button[data-v]");
		if (!b || b.disabled) return;
		var which = b.parentNode.id, v = b.dataset.v;
		if (which === "tStyle") setThrow(v); else if (which === "tHand") setHand(v); else if (which === "tAngle") setAngle(v);
	});
	$("cardBtn").addEventListener("click", function () { if (cardOpen) closeCard(); else openCard(); });
	$("reliefBtn").addEventListener("click", function () { startRelief(); });
	$("mullBtn").addEventListener("click", function () { mulligan(); });

	// ---- mulligans (house rules): the last throw taken back, to throw again --------------------------
	function mulligan() {
		if ((phase !== "aim" && phase !== "putt") || !canMulligan()) return;
		takeMulligan();
		say("\x01h\x01mMulligan!\x01n That throw doesn't count. Throw it again" + (mulligansLeft() ? " (" + mulligansLeft() + " left)." : " (that was your last)."));
		readyToThrow();
	}

	// ---- relief (house rules: +1 throw, or free): slide back along the line from the basket ---------
	// As the door's relief screen: the spots a map column apart straight back from the basket; Left/Down
	// goes further back, Right/Up comes closer, Enter takes it; a tap on the map picks the nearest spot.
	var relief = null;   // { spots, at }
	function startRelief() {
		if (phase !== "aim") return;
		var spots = reliefSpots();
		if (spots.length < 2) { say("No room to move back here."); return; }
		relief = { spots: spots, at: Math.min(spots.length - 1, Math.max(1, Math.round(4 / spots[1].back))) };
		phase = "relief";
		say(R.rules.reliefStroke ? "\x01h\x01mOptional relief\x01n (PDGA): +1 throw, move back along the line from the basket."
			: "\x01h\x01mFree relief\x01n (house rules): move back along the line from the basket.");
		hud(); syncView(); reliefChip();
	}
	function reliefChip() {
		var sp = relief.spots[relief.at], t = tileAt(S.H, sp), ob = isOB(t);
		showChip("<b class='c-m'>Relief " + (R.rules.reliefStroke ? "+1 throw" : "free") + "</b> · " + ft(sp.back) + " ft back · " +
			(ob ? "<span class='c-r hi'>out of bounds</span>" : lieName(t).replace(/^in the |^on the /, "")) + " · " +
			ft(hyp(S.H.basket.x - sp.x, S.H.basket.y - sp.y)) + " ft to the pin" +
			"<div class='row center'><button type='button' class='tg' data-relief='take'" + (ob ? " disabled" : "") + ">Take relief here</button>" +
			"<button type='button' class='tg' data-relief='cancel'>Cancel</button></div>" +
			"<span class='label kb'>←/→ slide back or forward · Enter takes it · Esc cancels · </span><span class='label tap'>tap a dot to move there</span>");
		kick();
	}
	function slideRelief(d) { relief.at = clamp(relief.at + d, 1, relief.spots.length - 1); reliefChip(); }
	function takeReliefHere() {
		var sp = relief.spots[relief.at];
		if (!takeRelief(sp)) { say("\x01h\x01rThat spot is out of bounds."); return; }
		say("\x01h\x01mTook relief.\x01n " + (R.rules.reliefStroke ? "+1 throw" : "Free") + ", " + ft(sp.back) + " ft back. " + ft(pinDist()) + " ft to go.");
		readyToThrow();
	}
	function cancelRelief() {
		relief = null; phase = "aim";
		say("");
		$("gapChip").hidden = true;
		hud(); syncView(); layout();
		if (view === "pov" && pov) povAim(pov.ang);
	}
	$("gapChip").addEventListener("click", function (e) {
		var b = e.target.closest("[data-relief]");
		if (!b || !relief) return;
		if (b.dataset.relief === "take") takeReliefHere(); else cancelRelief();
	});
	// A tap on the map in relief: the spot nearest it
	function reliefAt(ev) {
		var r = cv.getBoundingClientRect(), p = vw.s2w(ev.clientX - r.left, ev.clientY - r.top), best = 1, bd = 1e9;
		relief.spots.forEach(function (s, i) { var d = hyp(s.x - p.x, s.y - p.y); if (i && d < bd) { bd = d; best = i; } });
		relief.at = best; reliefChip();
	}

	// Aim: click or tap the map (the meter keeps going if it's running)
	function aimAt(ev, first) {
		if (!vw) return;
		if (phase === "relief") return reliefAt(ev);
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
		if (k === "Escape") { if (cardOpen) closeCard(); else if (relief && gameKeys()) cancelRelief(); return; }
		if (!gameKeys()) return;
		kick();
		if (phase === "relief") {
			if (k === "ArrowLeft" || k === "ArrowDown") { slideRelief(1); e.preventDefault(); }
			else if (k === "ArrowRight" || k === "ArrowUp") { slideRelief(-1); e.preventDefault(); }
			else if (k === "Enter" && e.target.tagName !== "BUTTON") { takeReliefHere(); e.preventDefault(); }
			else if (K === "R") cancelRelief();
			return;
		}
		if (K === "R" && phase === "aim") { startRelief(); return; }
		if (K === "M") { mulligan(); return; }
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
			else if (K === "T") setThrow(cycle(throwChoices(), S.pitch ? "PO" : S.style));
			else if (K === "A") setAngle(cycle(ANGLES, S.angle));
			else if (K === "H") setHand(cycle(HANDS, S.hand));
			else if (/^[1-9]$/.test(k) && +k <= bagDiscs().length) { S.disc = +k - 1; hud(); }
		} else if (phase === "putt") {
			if (k === "ArrowLeft") { aimPutt(-0.25); hud(); e.preventDefault(); }
			else if (k === "ArrowRight") { aimPutt(0.25); hud(); e.preventDefault(); }
			else if (K === "H") setHand(cycle(HANDS, S.hand));
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
			MENU.save();
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
		var seg = $("viewSeg"), bs = seg.querySelectorAll("button");
		bs[0].textContent = putting ? "overhead" : "map";
		bs[1].textContent = putting ? "player" : "lie";
		bs[1].title = putting ? "From the player: the basket from where you stand" : "The view from your lie";
		bs[0].setAttribute("aria-pressed", on ? "false" : "true");
		bs[1].setAttribute("aria-pressed", on ? "true" : "false");
		seg.hidden = !(putting || aimingThrow());
		cv.setAttribute("aria-label", on ? "The view from your lie" : "The hole, seen from above");
		if (!on && phase !== "relief" && !$("gapChip").hidden) { $("gapChip").hidden = true; layout(); }
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
		var path = player.flightPath;   // Setup's flight path: hidden, just the landing ring (and no red trees)
		g.drawImage(POVW.scene(S.H, C, dpr, path ? line.red : {}), 0, 0, w, h);
		POVW.rangePath(g, C, line.pts, path);
		POVW.basket(g, S.H, C);
		POVW.crosshair(g, C, S.aim);
		g.restore();
		var gp = POVW.gap(S.H, S.lie, pov.ang), red = path ? Object.keys(line.red).length : 0;
		showChip((gp.far ? "clear past " + ft(POV.maxD) + " ft" : "gap " + Math.max(1, ft(gp.width)) + " ft wide · clear " + ft(gp.clear) + " ft") +
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
		var tilt = Math.max(0, Math.atan(POV.camH / Math.max(D, 1)) - Math.atan(0.33 * h / F));
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
		var discR = S.pitch ? PITCH_DISC_R : DISC_R, pts = [S.lie], red = {}, i;   // the flight's own (flight.js)
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
		g.clearRect(0, 0, cv.width, cv.height);   // the page's own background (style.css) shows around the hole
		if (!S || !pic || !vw || !$("menu").hidden) return;
		if (showingPov()) return drawPov(now);
		vw.apply(g, dpr);
		g.imageSmoothingEnabled = true;
		g.drawImage(pic.canvas, 0, 0, pic.mw, pic.mh);
		var px = 1 / vw.sc;                                  // one screen pixel, in metres
		if (aimingThrow()) DRAW.aimOverlay(g, S.H, aimLine(), S.aim, px, player.flightPath);
		if (aimingPutt()) DRAW.puttLine(g, S.lie, puttWorld(1, PT.aim), px);
		if (relief) DRAW.reliefSpots(g, relief.spots, relief.at, px, isOB(tileAt(S.H, relief.spots[relief.at])));
		var A = animAt(now);
		if (A) DRAW.trail(g, A, px);
		DRAW.basket(g, S.H.basket, px);
		DRAW.player(g, A && phase === "fly" ? lastPath[0] : S.lie, px);
		if (A) DRAW.disc(g, A.at, Math.sin(A.t * Math.PI) * (phase === "fly" ? 6 : 1.5), px);
	}

	MENU.init({ onPlay: play });
	showMenu();
	layout();
})();
