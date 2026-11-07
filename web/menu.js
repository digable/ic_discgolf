// IC Disc Golf web: the menu before a round. Play (a course picker), Setup, Bag and House rules,
// built from the door's own screens (../bbs/lib/menus.js: SETUP, HOUSE_FORM, BAG_COLS, toggleBag,
// courseOrder...) so the questions, notes and bag rules are word for word the BBS's. Settings are
// kept in this browser, checked the same way the BBS checks a saved player (saves.js: applySettings).
"use strict";

var MENU = (function () {
	var $ = function (id) { return document.getElementById(id); };
	var SETTINGS = "icdg.settings", COURSE_KEY = "icdg.course";
	var onPlay = null, tab = "play", notice = "", bagMsg = "";
	var pick = { sel: 0, open: false, q: "", hi: 0, list: [] };   // the course picker
	var bagQ = "";

	// ---- settings, kept in this browser ------------------------------------------------------------
	function load() {
		var s = {};
		try {
			s = JSON.parse(localStorage.getItem(SETTINGS) || "{}") || {};
			if (!s.puttView) s.puttView = localStorage.getItem("icdg.puttView");   // kept on its own before
			var c = Number(localStorage.getItem(COURSE_KEY));
			if (localStorage.getItem(COURSE_KEY) !== null && COURSES[c]) player.course = c;
		} catch (e) {}
		applySettings(s);              // every value checked; a bad or old one keeps the standard
	}
	function save() {
		try {
			localStorage.setItem(SETTINGS, JSON.stringify(currentSettings()));
			localStorage.setItem(COURSE_KEY, String(player.course));
		} catch (e) {}
	}

	// ---- tabs -----------------------------------------------------------------------------------
	function show() {
		$("menu").hidden = false;
		var last = baseOf(player.course);
		if (last !== player.course) courseTraced[last] = true;   // last played the traced version: start on it
		pick.sel = COURSES[last] && !COURSES[last].of ? last : courseOrder()[0];
		setTab("play");
	}
	function setTab(t) {
		if (tab === "house" && t !== "house") leaveHouse();
		tab = t;
		document.querySelectorAll("#menu [data-tab]").forEach(function (b) {
			var on = b.dataset.tab === t;
			b.classList.toggle("on", on); b.setAttribute("aria-selected", on ? "true" : "false");
		});
		pick.open = false;
		render();
	}
	function render() {
		var body = $("menuBody");
		if (tab === "play") body.innerHTML = playHtml();
		else if (tab === "setup") body.innerHTML = formHtml(setupRows(), "setup");
		else if (tab === "house") body.innerHTML = formHtml(HOUSE_FORM.rows, "house");
		else if (tab === "bag") { body.innerHTML = bagHtml(); bagParts(); }
	}
	// Leaving the house rules: the bag is cut down to the size they allow, as on the BBS
	function leaveHouse() {
		var removed = fitBag(house.bagSize);
		if (removed.length) notice = "\x01h\x01yTook out of your bag: " + (removed.length > 2 ? removed.length + " discs, fastest first"
			: removed.map(function (k) { return discLabel(bagDisc(k)); }).join(", "));
		save();
	}

	// ---- Play: the course, and what you're playing with ------------------------------------------
	function courseInfo(i) {
		var C = COURSES[pickedVersion(i)], par = 0, len = 0;
		C.holes.forEach(function (h) { par += h.par; len += h.ft; });
		return { C: C, par: par, len: len };
	}
	function whereShort(C) { var w = courseWhere(C); return C.country === "USA" ? w[1] + ", " + w[2] : w[1] + ", " + C.country; }
	function playHtml() {
		var i = pick.sel, f = courseInfo(i), C = f.C, traced = tracedOf(i) >= 0;
		var h = "<div class='field'><span class='label'>Course</span><div class='picker' id='picker'>" +
			"<button type='button' class='pickBtn' id='pickBtn' aria-haspopup='listbox' aria-expanded='false'>" +
			"<span class='pName'>" + TEXT.html(COURSES[i].name) + "</span>" +
			"<span class='label'>" + TEXT.html(whereShort(C)) + " · " + C.holes.length + " holes · par " + f.par + " · " + f.len.toLocaleString() + " ft · UDisc " + C.rating.toFixed(1) + "</span>" +
			"<span class='caret' aria-hidden='true'>▾</span></button>" +
			"<div class='pop' id='pickPop' hidden><div class='popTop'>" +
			"<input id='pickQ' class='search' type='search' placeholder='Find a course' aria-label='Find a course' autocomplete='off'>" +
			"<select id='pickSort' class='search' aria-label='Sort courses by'>" + sortOptions(COURSE_COLS, courseSort) + "</select></div>" +
			"<ul class='plist' id='pickList' role='listbox' aria-label='Courses'></ul></div></div></div>";
		if (traced) h += "<div class='field'><span class='label'>Version</span><div class='opts'>" +
			"<button type='button' class='tg' data-ver='0' aria-pressed='" + !C.traced + "'>drawn</button>" +
			"<button type='button' class='tg' data-ver='1' aria-pressed='" + !!C.traced + "'>photo-accurate</button>" +
			"<span class='label'>traced from aerial photos: real woods, roads and lots</span></div></div>";
		var bag = bagDiscs().map(discLabel).join(", ");
		h += "<dl class='summary'>" +
			"<dt>You</dt><dd>" + handName(player.hand) + "-handed, " + styleName(player.style).toLowerCase() + " thrower (" + level().name.toLowerCase() + ") · " +
			"flight path " + (player.flightPath ? "shown" : "hidden") + " · putting " + PUTT_VIEW_NAMES[player.puttView].toLowerCase() + " <button type='button' class='link' data-go='setup'>change</button></dd>" +
			"<dt>Bag</dt><dd>" + player.bag.length + " discs: " + TEXT.html(bag) + " <button type='button' class='link' data-go='bag'>change</button></dd>" +
			"<dt>Rules</dt><dd>" + TEXT.html(houseChanges(house).join(", ") || "standard") + " <button type='button' class='link' data-go='house'>change</button></dd></dl>";
		if (notice) { h += "<p class='notice'>" + TEXT.ctrlA(notice) + "</p>"; notice = ""; }
		var ok = bagPutters() > 0;
		h += "<div class='row'><button type='button' class='go' id='playBtn'" + (ok ? "" : " disabled") + ">Play " + TEXT.html(COURSES[i].name) + "</button>" +
			(ok ? "" : "<span class='c-r hi'>Your bag has no putter: add one on the Bag tab.</span>") + "</div>";
		return h;
	}
	// <option>s for a sort: every column, each way (COURSE_COLS / BAG_COLS: { h, dir: [low first, high first] })
	function sortOptions(cols, cur) {
		var h = "";
		cols.forEach(function (c, i) {
			[0, 1].forEach(function (r) {
				var on = cur.col === i && (cur.rev ? 1 : 0) === r, name = c.h.charAt(0) + c.h.slice(1).toLowerCase();
				h += "<option value='" + i + "," + r + "'" + (on ? " selected" : "") + ">" + TEXT.esc(name + ", " + c.dir[r]) + "</option>";
			});
		});
		return h;
	}
	function setSort(cur, v) { var p = v.split(","); cur.col = +p[0]; cur.rev = p[1] === "1"; }

	// The course picker: a button showing the course, and a list under it to search, sort and pick from
	function openPicker() {
		pick.open = true; pick.q = ""; $("pickPop").hidden = false; $("pickBtn").setAttribute("aria-expanded", "true");
		fillPicker(true);
		$("pickQ").focus({ preventScroll: true });
	}
	function closePicker(focusBtn) {
		if (!pick.open) return;
		pick.open = false; $("pickPop").hidden = true; $("pickBtn").setAttribute("aria-expanded", "false");
		if (focusBtn) $("pickBtn").focus({ preventScroll: true });
	}
	function fillPicker(toSel) {
		var q = pick.q.trim().toLowerCase();
		pick.list = courseOrder().filter(function (i) { return !q || TEXT.cp(COURSES[i].name + " " + COURSES[i].where + " " + COURSES[i].country).toLowerCase().indexOf(q) >= 0; });
		if (toSel) pick.hi = Math.max(0, pick.list.indexOf(pick.sel));
		pick.hi = Math.min(pick.hi, Math.max(0, pick.list.length - 1));
		$("pickList").innerHTML = pick.list.length ? pick.list.map(function (i, n) {
			var C = COURSES[i], par = 0;
			C.holes.forEach(function (h) { par += h.par; });
			return "<li role='option' id='pc" + n + "' data-i='" + i + "' class='crow" + (n === pick.hi ? " hi" : "") + "' aria-selected='" + (i === pick.sel) + "'>" +
				"<b>" + TEXT.html(C.name) + "</b>" + (tracedOf(i) >= 0 ? "<span class='tag'>photo</span>" : "") +
				"<span class='label'>" + TEXT.html(whereShort(C)) + " · " + C.holes.length + " holes · par " + par + " · " + C.rating.toFixed(1) + "★</span></li>";
		}).join("") : "<li class='crow label'>No course matches.</li>";
		$("pickQ").setAttribute("aria-activedescendant", pick.list.length ? "pc" + pick.hi : "");
		var el = $("pc" + pick.hi);
		if (el) el.scrollIntoView({ block: "nearest" });
	}
	function choose(i) {
		pick.sel = i;
		player.course = pickedVersion(i); save();   // remembered for next time, played or not
		closePicker(false);
		render();
		$("pickBtn").focus({ preventScroll: true });
	}

	// ---- Setup and house rules: the door's forms (questions, answers and notes) -----------------------
	// Setup is the BBS's player setup plus its putting view (which the BBS keeps from the putting screen's V)
	function setupRows() {
		return SETUP.concat([{ q: "Putting view?", opts: [["top", "~Overhead"], ["pov", "From the ~player"]],
			get: function () { return player.puttView; }, set: function (v) { player.puttView = v; },
			note: function () {
				return [player.puttView === "pov" ? "\x01h\x01cFrom the player.\x01n \x01k\x01hYou see the basket from where you stand; tap or drag to aim."
					: "\x01h\x01cOverhead.\x01n \x01k\x01hThe green from above, the line to your aim spot.", "\x01k\x01hV switches it while you putt."];
			} }]);
	}
	var formRows = [];
	function formHtml(rows, kind) {
		formRows = rows;
		var head = kind === "house" ? "<p class='label'>The rules your rounds are played by. Each round keeps the rules it started with.</p>"
			: "<p class='label'>Changes take effect right away and are kept in this browser.</p>";
		return head + rows.map(function (row, r) {
			var cur = row.get(), opts;
			if (row.num) opts = "<button type='button' class='tg step' data-r='" + r + "' data-n='-1' aria-label='Fewer'" + (cur > row.num.min ? "" : " disabled") + ">−</button>" +
				"<span class='num'>" + TEXT.html(row.num.label(cur)) + "</span>" +
				"<button type='button' class='tg step' data-r='" + r + "' data-n='1' aria-label='More'" + (cur < row.num.max ? "" : " disabled") + ">+</button>";
			else opts = row.opts.map(function (o, k) {
				return "<button type='button' class='tg' data-r='" + r + "' data-o='" + k + "' aria-pressed='" + (o[0] === cur) + "'>" + TEXT.html(TEXT.plain(o[1])) + "</button>";
			}).join("");
			var notes = row.note().filter(function (n) { return n; }).map(TEXT.ctrlA).join("<br>");
			return "<div class='qrow'><div class='qq'>" + TEXT.html(row.q) + "</div><div class='opts'>" + opts + "</div><div class='note'>" + notes + "</div></div>";
		}).join("");
	}

	// ---- Bag: your discs and the catalog --------------------------------------------------------
	var LEGEND = ["Speed = how hard it must be thrown. Glide = how long it floats.",
		"Turn = drift right early (for RH backhand; negative turns more). Fade = hook left at the end.",
		"Weight: lighter discs are easier to throw far, turn more and feel more wind."];
	function bagHtml() {
		return "<div class='bagHead'><b id='bagTitle'></b><span class='label'>Tap a weight to add or take out that disc; tap the name for 175 g (or to take it out).</span></div>" +
			"<div class='bchips' id='bagChips'></div><p class='notice' id='bagMsg'></p>" +
			"<div class='popTop'><input id='bagQ' class='search' type='search' placeholder='Find a disc' aria-label='Find a disc' autocomplete='off' value='" + TEXT.esc(bagQ) + "'>" +
			"<select id='bagSort' class='search' aria-label='Sort the catalog by'>" + sortOptions(BAG_COLS, bagSort) + "</select></div>" +
			"<div class='cat' id='bagCat' role='list' aria-label='Disc catalog'></div>" +
			"<p class='label legend'>" + LEGEND.join("<br>") + "</p>";
	}
	function bagParts() {
		var size = house.bagSize + 1, putters = bagPutters();
		$("bagTitle").innerHTML = "Your bag <span class='label'>" + player.bag.length + " of " + size + "</span>" + (putters ? "" : " <span class='c-r hi'>no putter</span>");
		$("bagChips").innerHTML = bagDiscs().map(function (d) {
			return "<span class='bchip'><i class='sw t-" + d.type + "'></i>" + TEXT.html(discLabel(d)) +
				"<button type='button' data-rm='" + TEXT.esc(d.key) + "' aria-label='Take the " + TEXT.esc(discLabel(d)) + " out'>×</button></span>";
		}).join("");
		$("bagMsg").innerHTML = bagMsg ? "<span class='c-y hi'>" + TEXT.esc(bagMsg) + "</span>" : "";
		var cat = $("bagCat"), top = cat.scrollTop, q = bagQ.trim().toLowerCase();
		cat.innerHTML = bagOrder().filter(function (i) { var d = DISCS[i]; return !q || (d.name + " " + d.maker + " " + TYPE_NAME[d.type]).toLowerCase().indexOf(q) >= 0; })
			.map(function (i) {
				var d = DISCS[i], inBag = false;
				var w = WEIGHTS.map(function (g, j) {
					var has = player.bag.indexOf(bagKey(d.name, g)) >= 0;
					if (has) inBag = true;
					return "<button type='button' class='tg wt' data-w='" + (j + 1) + "' data-d='" + TEXT.esc(d.name) + "' aria-pressed='" + has + "' aria-label='" + TEXT.esc(d.name) + " " + g + " g'>" + g + "</button>";
				}).join("");
				return "<div class='drow" + (inBag ? " in" : "") + "' role='listitem'><button type='button' class='dname' data-t='" + TEXT.esc(d.name) + "'>" +
					"<i class='sw t-" + d.type + "'></i><b>" + TEXT.html(d.name) + "</b><span class='label'>" + TEXT.html(d.maker) + " · " + TYPE_NAME[d.type] + "</span></button>" +
					"<span class='nums'>" + d.n.map(function (n) { return "<span>" + n + "</span>"; }).join("") + "</span><span class='wts'>" + w + "</span></div>";
			}).join("") || "<p class='label'>No disc matches.</p>";
		cat.scrollTop = top;
	}
	function bagChange(msg) {
		bagMsg = msg;
		bagChanged();
		save();
		bagParts();
	}

	// ---- wiring ---------------------------------------------------------------------------------
	function init(opts) {
		onPlay = opts.onPlay;
		load();
		document.querySelectorAll("#menu [data-tab]").forEach(function (b) { b.addEventListener("click", function () { setTab(b.dataset.tab); }); });
		var body = $("menuBody");
		body.addEventListener("click", function (e) {
			var t = e.target.closest("button, li[data-i]");
			if (!t) return;
			if (t.id === "pickBtn") return pick.open ? closePicker(true) : openPicker();
			if (t.dataset.i !== undefined) return choose(+t.dataset.i);
			if (t.id === "playBtn") {
				leaveHouse();
				var c = pickedVersion(pick.sel);
				player.course = c; save();
				$("menu").hidden = true;
				return onPlay(c);
			}
			if (t.dataset.go) return setTab(t.dataset.go);
			if (t.dataset.ver !== undefined) { courseTraced[pick.sel] = t.dataset.ver === "1"; player.course = pickedVersion(pick.sel); save(); return render(); }
			if (t.dataset.r !== undefined) {
				var row = formRows[+t.dataset.r];
				if (t.dataset.o !== undefined) row.set(row.opts[+t.dataset.o][0]);
				else row.set(clamp(row.get() + Number(t.dataset.n), row.num.min, row.num.max));
				save();
				return render();
			}
			if (t.dataset.rm !== undefined) {
				var at = player.bag.indexOf(t.dataset.rm);
				if (at >= 0) player.bag.splice(at, 1);
				return bagChange(bagPutters() ? "" : "No putter in your bag: add one before you play (every bag needs one).");
			}
			if (t.dataset.w !== undefined) return bagChange(toggleBag(t.dataset.d, t.dataset.w));
			if (t.dataset.t !== undefined) return bagChange(toggleBag(t.dataset.t, " "));
		});
		body.addEventListener("input", function (e) {
			if (e.target.id === "pickQ") { pick.q = e.target.value; pick.hi = 0; fillPicker(false); }
			if (e.target.id === "bagQ") { bagQ = e.target.value; bagParts(); }
		});
		body.addEventListener("change", function (e) {
			if (e.target.id === "pickSort") { setSort(courseSort, e.target.value); fillPicker(true); }
			if (e.target.id === "bagSort") { setSort(bagSort, e.target.value); bagParts(); }
		});
		body.addEventListener("keydown", function (e) {
			if (e.target.id !== "pickQ") return;
			if (e.key === "ArrowDown" || e.key === "ArrowUp") {
				pick.hi = clamp(pick.hi + (e.key === "ArrowDown" ? 1 : -1), 0, Math.max(0, pick.list.length - 1));
				fillPicker(false); e.preventDefault();
			} else if (e.key === "Enter") { if (pick.list.length) choose(pick.list[pick.hi]); e.preventDefault(); }
			else if (e.key === "Escape") { closePicker(true); e.preventDefault(); e.stopPropagation(); }
		});
		// a click anywhere else closes the course list
		document.addEventListener("pointerdown", function (e) { if (pick.open && !e.target.closest("#picker")) closePicker(false); });
	}

	return { init: init, show: show, save: save };
})();
