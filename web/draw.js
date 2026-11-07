// IC Disc Golf web: drawing the hole. Everything comes from the hole the rules built (buildHole):
// the ground from its map, a tree crown over every trunk the flight checks (so a gap you can see
// is a gap the disc can fly through), the tee and the basket. The hole is drawn once into a
// picture; each frame draws that, then the overlay (the aim, the flight, the players and the disc).
// The colours and tree sizes here are shared with the view from the lie (pov.js), so a tree looks
// the same from above and from the ground.
"use strict";

var DRAW = (function () {
	var PPM = 2;           // ground pixels per metre (then smoothed when scaled)
	var CROWN_PX = 7;      // picture pixels per metre for the trees
	var GROUND = { ".": [128, 190, 92], ",": [98, 160, 74], "T": [94, 152, 70], "#": [70, 124, 58], "R": [96, 100, 106],
		"P": [140, 145, 150], "W": [60, 140, 205], "O": [52, 84, 46], "S": [128, 190, 92], "B": [128, 190, 92] };
	var DEEP = [40, 105, 170];   // deep water
	var LEAF = [[52, 104, 46], [62, 118, 50], [74, 124, 48], [48, 96, 52], [88, 128, 50], [58, 110, 60], [104, 124, 44]];
	var AIM_COL = "rgba(255,120,220,.95)", TRAIL_COL = "rgba(255,240,150,.8)", DISC_COL = "#ffd84d", DISC_EDGE = "#7a5a00";

	// Tree j's crown: its radius in metres (follows the map's cell size: a short hole's map is drawn
	// bigger, and the same woods would otherwise be a solid mass of giant crowns), its leaf colour,
	// and the random numbers that place its lumps
	function crownR(H, j) { return clamp(H.S * (1.1 + ((j * 37) % 17) / 17), 1.2, 4); }
	function leaf(j) { return LEAF[(j * 53) % LEAF.length]; }
	function crownRand(H, j) { return seeded(j * 977 + 5 + H.num); }
	var rgb = function (c) { return "rgb(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + ")"; };

	// The hole as a picture, CROWN_PX pixels per metre
	function holePicture(H) {
		var mw = MAP_W * H.S, mh = MAP_H * 2 * H.S, rnd = seeded(H.num * 7919 + 13);
		// ground, smoothed
		var gw = Math.round(mw * PPM), gh = Math.round(mh * PPM);
		var gc = document.createElement("canvas"); gc.width = gw; gc.height = gh;
		var gg = gc.getContext("2d"), img = gg.createImageData(gw, gh), x, y;
		var hs = null;
		if (H.def.elev) {                                     // slope shading from the heights
			hs = [];
			for (y = 0; y < MAP_H; y++) { hs.push([]); for (x = 0; x < MAP_W; x++) hs[y].push(heightAt(H, gridPt(x, y, H.S))); }
		}
		for (y = 0; y < gh; y++) for (x = 0; x < gw; x++) {
			var c = Math.min(MAP_W - 1, Math.round(x / PPM / H.S)), r = Math.min(MAP_H - 1, Math.round(y / PPM / (2 * H.S)));
			var t = H.grid[r][c], col = GROUND[t] || GROUND[","];
			if (t === "W" && H.deep[r][c]) col = DEEP;
			var n = Math.sin(x * 1.7) * Math.cos(y * 2.3) * 4 + (rnd() - 0.5) * 8;
			if ((t === "." || t === "S" || t === "B") && Math.floor(x / (6 * PPM)) % 2) n += 7;        // mowing stripes
			if (hs) n -= ((hs[r][Math.min(MAP_W - 1, c + 1)] - hs[r][Math.max(0, c - 1)]) + (hs[Math.min(MAP_H - 1, r + 1)][c] - hs[Math.max(0, r - 1)][c])) * 4;
			var i = (y * gw + x) * 4;
			img.data[i] = col[0] + n; img.data[i + 1] = col[1] + n; img.data[i + 2] = col[2] + n; img.data[i + 3] = 255;
		}
		gg.putImageData(img, 0, 0);

		var pc = document.createElement("canvas"); pc.width = Math.round(mw * CROWN_PX); pc.height = Math.round(mh * CROWN_PX);
		var g = pc.getContext("2d"), k = CROWN_PX;
		g.imageSmoothingEnabled = true; g.drawImage(gc, 0, 0, pc.width, pc.height);
		// tee pad
		var bx = H.basket.x - H.tee.x, by = H.basket.y - H.tee.y;
		g.save(); g.translate(H.tee.x * k, H.tee.y * k); g.rotate(Math.atan2(by, bx));
		g.fillStyle = "#e2ddd0"; g.fillRect(-0.8 * k, -0.8 * k, 3.5 * k, 1.6 * k); g.restore();
		// trees: shadows, then crowns (a few lumps each, lit from the top-left)
		var trees = H.trunks.map(function (t, j) { return { x: t.x * k, y: t.y * k, r: crownR(H, j) * k, j: j }; });
		g.fillStyle = "rgba(10,30,10,.30)";
		trees.forEach(function (t) { g.beginPath(); g.ellipse(t.x + t.r * 0.55, t.y + t.r * 0.6, t.r * 1.05, t.r * 0.95, 0, 0, 7); g.fill(); });
		trees.forEach(function (t) {
			var base = leaf(t.j), rr = crownRand(H, t.j);
			for (var j = 0; j < 5; j++) {
				var a = rr() * 6.28, d = t.r * 0.38 * rr(), r2 = t.r * (0.55 + rr() * 0.3), cx = t.x + Math.cos(a) * d, cy = t.y + Math.sin(a) * d;
				var gr = g.createRadialGradient(cx - r2 * 0.35, cy - r2 * 0.4, r2 * 0.1, cx, cy, r2);
				gr.addColorStop(0, rgb([base[0] + 40, base[1] + 40, base[2] + 20]));
				gr.addColorStop(1, rgb([base[0] - 18, base[1] - 22, base[2] - 14]));
				g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r2, 0, 7); g.fill();
			}
		});
		return { canvas: pc, k: k, mw: mw, mh: mh };
	}

	// The view: the whole hole fitted into the box, tee on the left; in a tall box, tee at the bottom.
	// Returns { tall, sc, w2s(p), s2w(x, y), apply(ctx) }
	function view(H, box) {
		var mw = MAP_W * H.S, mh = MAP_H * 2 * H.S, tall = box.h > box.w * 1.05;
		var sc = tall ? Math.min(box.w / mh, box.h / mw) : Math.min(box.w / mw, box.h / mh);
		var cx = box.x + box.w / 2, cy = box.y + box.h / 2;
		// canvas transform: x' = a x + c y + e, y' = b x + d y + f
		var m = tall ? { a: 0, b: -sc, c: sc, d: 0, e: cx - mh / 2 * sc, f: cy + mw / 2 * sc }
			: { a: sc, b: 0, c: 0, d: sc, e: cx - mw / 2 * sc, f: cy - mh / 2 * sc };
		return {
			tall: tall, sc: sc,
			w2s: function (p) { return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f }; },
			s2w: function (x, y) {
				if (tall) return { x: (m.f - y) / sc, y: (x - m.e) / sc };
				return { x: (x - m.e) / sc, y: (y - m.f) / sc };
			},
			apply: function (g, dpr) { g.setTransform(m.a * dpr, m.b * dpr, m.c * dpr, m.d * dpr, m.e * dpr, m.f * dpr); }
		};
	}

	// ---- the overlay, drawn each frame over the picture in world metres (px: one screen pixel) ----
	// The aim (line: game.js's aimLine): the dotted flight of a perfect 100% throw, a red ring
	// on each tree in the line, the landing ring, and the aim point
	function aimOverlay(g, H, line, aim, px) {
		g.save(); g.setLineDash([2 * px, 7 * px]); g.lineCap = "round"; g.lineWidth = 3 * px; g.strokeStyle = "rgba(255,255,255,.9)";
		g.beginPath(); line.pts.forEach(function (p, i) { if (i) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); });
		g.stroke(); g.restore();
		H.trunks.forEach(function (t, j) {
			if (!line.red[j]) return;
			g.fillStyle = "rgba(255,60,60,.35)"; g.strokeStyle = "#ff3b3b"; g.lineWidth = 2.5 * px;
			g.beginPath(); g.arc(t.x, t.y, crownR(H, j), 0, 7); g.fill(); g.stroke();
		});
		var land = line.pts[line.pts.length - 1];
		g.fillStyle = "rgba(255,255,255,.25)"; g.strokeStyle = "#fff"; g.lineWidth = 2.5 * px;
		g.beginPath(); g.arc(land.x, land.y, 11 * px, 0, 7); g.fill(); g.stroke();
		cross(g, aim, 7 * px, 2 * px);
	}
	function cross(g, p, r, lw) {
		g.strokeStyle = AIM_COL; g.lineWidth = lw;
		g.beginPath(); g.moveTo(p.x - r, p.y); g.lineTo(p.x + r, p.y); g.moveTo(p.x, p.y - r); g.lineTo(p.x, p.y + r); g.stroke();
	}
	// Lining up a putt: a dotted line to the aim spot
	function puttLine(g, from, to, px) {
		g.save(); g.setLineDash([2 * px, 6 * px]); g.lineWidth = 2.5 * px; g.strokeStyle = "rgba(255,255,255,.85)";
		g.beginPath(); g.moveTo(from.x, from.y); g.lineTo(to.x, to.y); g.stroke(); g.restore();
	}
	// The trail behind a disc in flight (A: game.js's animAt)
	function trail(g, A, px) {
		g.strokeStyle = TRAIL_COL; g.lineWidth = 2 * px; g.beginPath(); g.moveTo(A.path[0].x, A.path[0].y);
		for (var j = 1; j <= A.i0 && j <= A.n; j++) g.lineTo(A.path[j].x, A.path[j].y);
		g.lineTo(A.at.x, A.at.y); g.stroke();
	}
	// The basket: a fixed size on screen, so it's easy to find on a long hole
	function basket(g, bk, px) {
		g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(bk.x + 4 * px, bk.y + 5 * px, 11 * px, 7 * px, 0, 0, 7); g.fill();
		g.fillStyle = "#ffd400"; g.beginPath(); g.arc(bk.x, bk.y, 9 * px, 0, 7); g.fill();
		g.strokeStyle = "#4a4a4a"; g.lineWidth = 2 * px; g.beginPath(); g.arc(bk.x, bk.y, 5.5 * px, 0, 7); g.stroke();
	}
	// A player standing at p (col: their colour, white when left out)
	function player(g, p, px, col) {
		g.fillStyle = col || "#fff"; g.strokeStyle = "#0b1020"; g.lineWidth = 3 * px;
		g.beginPath(); g.arc(p.x, p.y, 7 * px, 0, 7); g.fill(); g.stroke();
	}
	// A disc in the air at p, ht (0-6) up: drawn bigger, and its shadow further off (ht * 0.4 m), the higher it is
	function disc(g, p, ht, px) {
		g.fillStyle = "rgba(0,0,0,.3)"; g.beginPath(); g.arc(p.x + ht * 0.4, p.y + ht * 0.5, 5 * px, 0, 7); g.fill();
		g.fillStyle = DISC_COL; g.strokeStyle = DISC_EDGE; g.lineWidth = 1.5 * px;
		g.beginPath(); g.arc(p.x, p.y, (5 + ht * 0.6) * px, 0, 7); g.fill(); g.stroke();
	}

	return {
		GROUND: GROUND, DEEP: DEEP, AIM_COL: AIM_COL, TRAIL_COL: TRAIL_COL, DISC_COL: DISC_COL, DISC_EDGE: DISC_EDGE,
		crownR: crownR, leaf: leaf, crownRand: crownRand, rgb: rgb,
		holePicture: holePicture, view: view,
		aimOverlay: aimOverlay, puttLine: puttLine, trail: trail, basket: basket, player: player, disc: disc
	};
})();
