// IC Disc Golf web: the view from the player's lie (the BBS door's POV, pov.js, drawn in 3D).
// Same camera as the door: 70 degree view, eyes 1.6 m up, trunks closer than CLEARING_M ignored,
// and the gap/clear numbers worked out the same way (povHits/gapInfo there).
"use strict";

var POVW = (function () {
	var FOV = 70 * Math.PI / 180, CAM_H = 1.6, MAX_D = 60, FAR = 140;
	var GROUND = { ".": [128, 190, 92], ",": [98, 160, 74], "T": [90, 140, 66], "#": [64, 110, 52], "R": [96, 100, 106],
		"P": [140, 145, 150], "W": [60, 140, 205], "O": [52, 84, 46], "S": [200, 196, 186], "B": [128, 190, 92] };
	var SKY = [150, 196, 235];
	var cache = { key: "", canvas: null };

	// fov: the view's width (the 70 degrees of the door when left out; putting looks narrower, at the basket).
	// tilt: how far the camera looks down (radians; putting looks down at the basket, throws look level)
	function cam(from, ang, w, h, fov, tilt) {
		var F = (w / 2) / Math.tan((fov || FOV) / 2), c = Math.cos(ang), s = Math.sin(ang);
		var tl = tilt || 0, ct = Math.cos(tl), st = Math.sin(tl), mid = Math.round(h * (tl ? 0.45 : 0.42));
		return {
			from: from, ang: ang, w: w, h: h, F: F, c: c, s: s,
			hor: Math.round(mid - F * Math.tan(tl)),   // where the horizon is on screen
			// world point (with height above ground) -> screen; null when behind the camera
			proj: function (p, ht) {
				var dx = p.x - from.x, dy = p.y - from.y, z = dx * c + dy * s, x = -dx * s + dy * c, up = (ht || 0) - CAM_H;
				var fw = z * ct - up * st, dn = -z * st - up * ct;
				if (fw < 0.3) return null;
				return { x: w / 2 + x / fw * F, y: mid + dn / fw * F, z: fw };
			},
			// screen point -> the ground there (metres ahead and to the right), null above the horizon
			ground: function (sx, sy) {
				var v = (sy - mid) / F, fall = st + v * ct;
				if (fall <= 0.002) return null;
				var t = CAM_H / fall, z = t * (ct - v * st);
				return { z: z, lat: (sx - w / 2) / F * t };
			}
		};
	}

	// Distance to the nearest trunk along each of the door's MAP_W columns (its povHits)
	function hits(H, from, ang) {
		var near = [], out = [], i, j;
		H.trunks.forEach(function (t) {
			var tx = t.x - from.x, ty = t.y - from.y, td = hyp(tx, ty);
			if (td >= CLEARING_M && td <= MAX_D + 1) near.push({ vx: tx, vy: ty, rad: t.rad });
		});
		for (i = 0; i < MAP_W; i++) {
			var a = ang + (i + 0.5 - MAP_W / 2) / MAP_W * FOV, ca = Math.cos(a), sa = Math.sin(a), best = 1e9;
			for (j = 0; j < near.length; j++) {
				var n = near[j], along = n.vx * ca + n.vy * sa;
				if (along < 0.4 || along > MAX_D || along > best) continue;
				if (Math.abs(-n.vx * sa + n.vy * ca) < n.rad) best = along;
			}
			out.push(best * Math.cos(a - ang));
		}
		return out;
	}
	// The gap straight ahead: its width (m) and how far it's clear (m), as the door's gapInfo
	function gap(H, from, ang) {
		var hit = hits(H, from, ang), c = MAP_W / 2 - 1, clear = hit[c], need = Math.min(clear, 12) * 0.8, l = c, r = c;
		while (l > 0 && hit[l - 1] >= need) l--;
		while (r < MAP_W - 1 && hit[r + 1] >= need) r++;
		var w = (r - l + 1) / MAP_W * FOV, at = Math.min(clear, 12);
		return { clear: clear, width: 2 * Math.tan(w / 2) * at, far: clear > MAX_D };
	}

	function fogMix(col, z) {
		var f = clamp((z - 20) / (FAR - 20), 0, 1) * 0.75;
		return [col[0] + (SKY[0] - col[0]) * f, col[1] + (SKY[1] - col[1]) * f, col[2] + (SKY[2] - col[2]) * f];
	}
	var rgb = function (c) { return "rgb(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + ")"; };

	// The scene (sky, ground, trees, basket) for a camera, cached until the lie, direction or size change
	function scene(H, C, dpr, red) {
		red = red || {};
		var key = [Object.keys(red).join(","), C.F.toFixed(1), C.hor, H.num, C.from.x.toFixed(2), C.from.y.toFixed(2), C.ang.toFixed(4), C.w, C.h, dpr].join("|");
		if (cache.key === key) return cache.canvas;
		var cv = cache.canvas || document.createElement("canvas");
		cv.width = Math.round(C.w * dpr); cv.height = Math.round(C.h * dpr);
		var g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
		// sky
		var sky = g.createLinearGradient(0, 0, 0, C.hor);
		sky.addColorStop(0, "#5b9bd5"); sky.addColorStop(1, rgb(SKY));
		g.fillStyle = sky; g.fillRect(0, 0, C.w, C.hor + 1);
		// ground: floor-cast at low resolution, then smoothed
		var B = 3, lw = Math.ceil(C.w / B), lh = Math.ceil((C.h - C.hor) / B);
		var lc = document.createElement("canvas"); lc.width = lw; lc.height = lh;
		var lg = lc.getContext("2d"), img = lg.createImageData(lw, lh);
		for (var yy = 0; yy < lh; yy++) {
			var sy = C.hor + (yy + 0.5) * B;
			for (var xx = 0; xx < lw; xx++) {
				var gp = C.ground((xx + 0.5) * B, Math.max(sy, C.hor + 0.5)), z = gp ? gp.z : FAR, lat = gp ? gp.lat : 0;
				var p = { x: C.from.x + C.c * z - C.s * lat, y: C.from.y + C.s * z + C.c * lat };
				var t = tileAt(H, p), col = GROUND[t] || GROUND.O;
				if (t === "W") { var cc = cellOf(H, p); if (H.deep[cc.r] && H.deep[cc.r][cc.c]) col = [40, 105, 170]; }
				if ((t === "." || t === "B") && Math.floor((p.x + p.y) / 3) % 2) col = [col[0] + 8, col[1] + 8, col[2] + 6];
				col = fogMix(col, z);
				var i = (yy * lw + xx) * 4; img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
			}
		}
		lg.putImageData(img, 0, 0);
		g.imageSmoothingEnabled = true;
		g.drawImage(lc, 0, C.hor, lw * B, lh * B);
		// trees, far to near: trunk, then a lumpy crown, fading into the haze with distance
		var trees = [];
		H.trunks.forEach(function (t, j) {
			var q = C.proj(t, 0);
			if (!q || hyp(t.x - C.from.x, t.y - C.from.y) < CLEARING_M || q.z > FAR) return;
			if (q.x < -C.w || q.x > 2 * C.w) return;
			trees.push({ t: t, j: j, z: q.z });
		});
		trees.sort(function (a, b) { return b.z - a.z; });
		trees.forEach(function (o) {
			var t = o.t, j = o.j, top = 5.5 + ((j * 29) % 13) / 13 * 4, cr = clamp(H.S * (1.1 + ((j * 37) % 17) / 17), 1.4, 4);
			var base = C.proj(t, 0), hi = C.proj(t, top - cr * 0.6);
			if (!base || !hi) return;
			var tw = Math.max(0.28, t.rad * 2.2) / base.z * C.F;
			g.fillStyle = rgb(fogMix([84, 64, 44], base.z));
			g.fillRect(base.x - tw / 2, hi.y, tw, base.y - hi.y);
			var cc = C.proj(t, top), rpx = cr / cc.z * C.F, leaf = [[52, 104, 46], [62, 118, 50], [74, 124, 48], [48, 96, 52], [88, 128, 50]][j % 5];
			if (red[j]) { leaf = [190, 40, 36]; g.fillStyle = rgb(fogMix([150, 40, 30], base.z)); g.fillRect(base.x - tw / 2, hi.y, tw, base.y - hi.y); }
			var seed = j * 977 + 5;
			for (var k = 0; k < 5; k++) {
				seed = seed * 16807 % 2147483647; var a = seed / 2147483647 * 6.28;
				seed = seed * 16807 % 2147483647; var d = rpx * 0.4 * seed / 2147483647;
				var x = cc.x + Math.cos(a) * d, y = cc.y + Math.sin(a) * d * 0.8, r2 = rpx * 0.68;
				var gr = g.createRadialGradient(x - r2 * 0.3, y - r2 * 0.4, r2 * 0.1, x, y, r2);
				gr.addColorStop(0, rgb(fogMix([leaf[0] + 45, leaf[1] + 45, leaf[2] + 25], cc.z)));
				gr.addColorStop(1, rgb(fogMix([leaf[0] - 15, leaf[1] - 20, leaf[2] - 12], cc.z)));
				g.fillStyle = gr; g.beginPath(); g.arc(x, y, r2, 0, 7); g.fill();
			}
		});
		cache.key = key; cache.canvas = cv;
		return cv;
	}

	// The basket, or an arrow toward it at the edge
	function basket(g, H, C) {
		var b = H.basket, q = C.proj(b, 0), d = hyp(b.x - C.from.x, b.y - C.from.y), lab = ft(d) + " ft";
		g.font = "600 13px Inter, sans-serif"; g.textAlign = "center";
		if (q && q.x > 8 && q.x < C.w - 8) {
			var top = C.proj(b, 1.4), cage = C.proj(b, 0.85), band = C.proj(b, 1.3), w = Math.max(2, 0.55 / q.z * C.F);
			g.strokeStyle = "#9aa3ad"; g.lineWidth = Math.max(1, 0.05 / q.z * C.F);
			g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(top.x, top.y); g.stroke();
			g.fillStyle = "#ffd400"; g.fillRect(cage.x - w / 2, cage.y - Math.max(2, w * 0.35), w, Math.max(2, w * 0.35));
			g.fillRect(band.x - w / 2, band.y - Math.max(1.5, w * 0.12), w, Math.max(1.5, w * 0.12));
			g.strokeStyle = "rgba(200,200,200,.7)"; g.lineWidth = 1;
			for (var i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(band.x + i * w / 6, band.y); g.lineTo(cage.x + i * w / 8, cage.y - w * 0.35); g.stroke(); }
			g.fillStyle = "#ffd84d"; g.fillText(lab, top.x, Math.min(top.y - 10, C.hor - 6));
		} else {
			var rx = (b.x - C.from.x) * -C.s + (b.y - C.from.y) * C.c, left = rx < 0;
			g.fillStyle = "#ffd84d"; g.textAlign = left ? "left" : "right";
			g.fillText((left ? "◀ basket " : "basket ") + lab + (left ? "" : " ▶"), left ? 10 : C.w - 10, C.hor - 10);
		}
	}

	// The flight of a perfect 100% throw, and the landing ring, drawn over the scene
	function rangePath(g, C, sh, from, dist) {
		var pts = [], u;
		for (u = 0.01; u <= 1.0001; u += 0.01) {
			var q = C.proj(idealPoint(sh, u), 0);   // along the ground, under the disc: the map's dotted line, seen from here
			if (q) pts.push(q);
		}
		g.save(); g.setLineDash([2, 7]); g.lineCap = "round"; g.lineWidth = 3; g.strokeStyle = "rgba(255,255,255,.9)";
		g.beginPath(); pts.forEach(function (q, i) { if (i) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y); }); g.stroke(); g.restore();
		var land = C.proj(idealPoint(sh, 1), 0);
		if (land) {
			var r = Math.max(6, 2.5 / land.z * C.F);
			g.strokeStyle = "#fff"; g.lineWidth = 2.5; g.fillStyle = "rgba(255,255,255,.25)";
			g.beginPath(); g.ellipse(land.x, land.y, r, r * 0.3, 0, 0, 7); g.fill(); g.stroke();
		}
	}

	function crosshair(g, C, aim) {
		var q = C.proj(aim, 0), x = C.w / 2, y = q ? q.y : C.hor + 30;
		g.strokeStyle = "rgba(255,120,220,.95)"; g.lineWidth = 2;
		g.beginPath(); g.moveTo(x - 9, y); g.lineTo(x + 9, y); g.moveTo(x, y - 9); g.lineTo(x, y + 9); g.stroke();
	}

	// Lining up a putt: the line along the ground to the aim spot, and a mark at chain height there
	function puttAim(g, C, from, tgt) {
		var a = C.proj(from, 0), steps = 40, pts = [];
		for (var i = 1; i <= steps; i++) {
			var u = i / steps, q = C.proj({ x: from.x + (tgt.x - from.x) * u, y: from.y + (tgt.y - from.y) * u }, 0);
			if (q) pts.push(q);
		}
		g.save(); g.setLineDash([3, 8]); g.lineCap = "round"; g.lineWidth = 3; g.strokeStyle = "rgba(255,255,255,.85)";
		g.beginPath(); pts.forEach(function (q, i) { if (i) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y); }); g.stroke(); g.restore();
		var m = C.proj(tgt, 1.0);
		if (m) {
			g.strokeStyle = "rgba(255,120,220,.95)"; g.lineWidth = 2.5;
			g.beginPath(); g.moveTo(m.x - 10, m.y); g.lineTo(m.x + 10, m.y); g.moveTo(m.x, m.y - 10); g.lineTo(m.x, m.y + 10); g.stroke();
		}
	}
	// A disc in the air at p, ht metres up, with its shadow; and the trail behind it
	function disc(g, C, p, ht, trail) {
		if (trail && trail.length > 1) {
			g.strokeStyle = "rgba(255,240,150,.85)"; g.lineWidth = 2; g.beginPath();
			trail.forEach(function (o, i) { var q = C.proj(o.p, o.ht); if (!q) return; if (i) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y); });
			g.stroke();
		}
		var sh = C.proj(p, 0), q = C.proj(p, ht);
		if (!q) return;
		var r = Math.max(3, 0.11 / q.z * C.F);
		g.fillStyle = "rgba(0,0,0,.3)"; g.beginPath(); g.ellipse(sh.x, sh.y, r, r * 0.3, 0, 0, 7); g.fill();
		g.fillStyle = "#ffd84d"; g.strokeStyle = "#7a5a00"; g.lineWidth = 1.5;
		g.beginPath(); g.ellipse(q.x, q.y, r, r * 0.45, 0, 0, 7); g.fill(); g.stroke();
	}

	return { FOV: FOV, puttAim: puttAim, disc: disc, cam: cam, scene: scene, basket: basket, rangePath: rangePath, crosshair: crosshair, gap: gap };
})();
