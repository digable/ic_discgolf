// discgolf.js: The courses and their holes.
// Loaded by ../discgolf.js. ES5 for Synchronet (no let/const/arrows).

"use strict";

// ---- Courses --------------------------------------------------------------
// Each hole is drawn on a 78x16 grid; the door scales it so the tee-to-basket
// path matches the real hole length. pts = path from tee to basket (grid
// cells), hw = fairway half-width in meters, rough = rough band in meters,
// left/right = how wooded each side is (dense, medium, light, open),
// trees = single trees, ob = out-of-bounds areas (R road, P parking, W water).
// Left/right are as seen from the tee looking down the fairway.
// elev (optional, feet) = { tee: 0, basket: -12, hills: [[col, row, radius, height]] }
//   tee/basket heights set the overall slope; each hill is a bump (or a dip,
//   with a negative height) centered on a map cell. Leave it out for flat.
//
// Turkey Creek: hole lengths and pars from the course listing (UDisc, 2026).
// Fairway shapes are drawn from the course descriptions (tight tunnels along
// wood lines, road and parking in play) - not surveyed. Adjust to match the
// real holes. No elevation is set yet: add elev to a hole once you know it.
var COURSES = [{
	name: "Turkey Creek",
	where: "Coralville Reservoir, Iowa City, IA",
	holes: [
		{ par: 3, ft: 155, pts: [[8, 9], [68, 8]], hw: 4.5, rough: 2, left: "medium", right: "dense",
		  trees: [[40, 9]], ob: [{ t: "P", x1: 0, y1: 0, x2: 77, y2: 2 }],
		  note: "Short one to start. The parking lot sits just left - stay right of it." },
		{ par: 3, ft: 355, pts: [[5, 5], [40, 6], [71, 11]], hw: 6, rough: 3, left: "dense", right: "light",
		  trees: [[50, 9], [28, 7]],
		  note: "Rides the wood line: tight woods left, open right, bends right late." },
		{ par: 3, ft: 355, pts: [[5, 12], [36, 11], [71, 4]], hw: 4, rough: 2, left: "dense", right: "dense",
		  trees: [[55, 7]],
		  note: "Tunnel shot that turns left. A hyzer or a forehand (for righties) fits." },
		{ par: 3, ft: 195, pts: [[8, 7], [64, 7]], hw: 6, rough: 3, left: "light", right: "medium",
		  trees: [[36, 6], [37, 9]], ob: [{ t: "R", x1: 72, y1: 0, x2: 77, y2: 15 }],
		  note: "Open look with the road long. Don't run it past the pin." },
		{ par: 3, ft: 380, pts: [[5, 8], [30, 6], [55, 10], [72, 8]], hw: 7, rough: 7, left: "dense", right: "dense",
		  trees: [[42, 9]],
		  note: "The longest hole. Wide fairway but the rough off it is heavy." },
		{ par: 3, ft: 274, pts: [[6, 3], [42, 4], [70, 12]], hw: 4, rough: 2, left: "dense", right: "dense",
		  trees: [[30, 3]],
		  note: "Tunnel that bends right at the end. Turnover or anhyzer line." },
		{ par: 3, ft: 292, pts: [[6, 11], [72, 10]], hw: 6, rough: 3, left: "open", right: "dense",
		  trees: [[45, 9], [20, 11]], ob: [{ t: "P", x1: 26, y1: 0, x2: 77, y2: 4 }],
		  note: "Along the tree line with the lot on the left. A fade toward it is trouble." },
		{ par: 3, ft: 210, pts: [[8, 8], [68, 7]], hw: 3.5, rough: 2, left: "dense", right: "dense",
		  trees: [[38, 7]],
		  note: "Tight, straight tunnel. Flat and smooth beats big arm here." },
		{ par: 3, ft: 284, pts: [[6, 11], [44, 10], [70, 4]], hw: 5, rough: 3, left: "medium", right: "dense",
		  trees: [[58, 7]], ob: [{ t: "R", x1: 0, y1: 14, x2: 77, y2: 15 }],
		  note: "Finish with a left turn. The road runs along the right side." }
	]
}];
