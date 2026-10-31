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
}, {
// Wildcat Bluff: 21 holes from the short (red) tees, par 71, 7,445 ft - lengths
// and pars from the course listing (UDisc, 2026). UDisc calls it heavily wooded
// with elevation changes and many tight lines, rated extremely hilly. Fairway
// shapes, bends and hills here are drawn from that description - not surveyed.
// Adjust to match the real holes.
	name: "Wildcat Bluff",
	where: "Wildcat Bluff Park, Vinton, IA",
	holes: [
		{ par: 3, ft: 335, pts: [[6, 8], [70, 7]], hw: 4, rough: 2, left: "dense", right: "medium",
		  trees: [[38, 7]], elev: { tee: 0, basket: -8 },
		  note: "Opens downhill into the woods. Straight and smooth." },
		{ par: 4, ft: 442, pts: [[5, 12], [34, 11], [56, 6], [72, 4]], hw: 4.5, rough: 2, left: "dense", right: "dense",
		  trees: [[44, 8]], elev: { tee: 0, basket: 12, hills: [[30, 10, 6, 5]] },
		  note: "Long climb that bends left. Two good shots." },
		{ par: 3, ft: 225, pts: [[10, 6], [66, 9]], hw: 3.5, rough: 2, left: "medium", right: "dense",
		  trees: [[40, 8]], elev: { tee: 0, basket: -6 },
		  note: "Short and tight. Hit the gap and it's a birdie look." },
		{ par: 4, ft: 420, pts: [[5, 4], [38, 5], [71, 11]], hw: 4, rough: 2, left: "dense", right: "dense",
		  trees: [[52, 7], [25, 5]], elev: { tee: 0, basket: -14 },
		  note: "Downhill tunnel that turns right at the bottom." },
		{ par: 3, ft: 287, pts: [[7, 9], [69, 8]], hw: 4, rough: 2, left: "dense", right: "light",
		  trees: [[33, 9], [50, 8]],
		  note: "Wood line hard left. Stay out of it." },
		{ par: 4, ft: 558, pts: [[4, 3], [28, 6], [50, 12], [73, 12]], hw: 5, rough: 3, left: "dense", right: "dense",
		  trees: [[60, 12]], elev: { tee: 0, basket: 8, hills: [[40, 9, 7, 10]] },
		  note: "The longest on the card. Over the ridge, then right to the basket." },
		{ par: 4, ft: 410, pts: [[5, 12], [40, 10], [72, 5]], hw: 4, rough: 2, left: "medium", right: "dense",
		  trees: [[57, 8]], elev: { tee: 0, basket: 10 },
		  note: "Uphill and bending left. Lay up if the gap isn't there." },
		{ par: 3, ft: 228, pts: [[9, 8], [67, 8]], hw: 3, rough: 2, left: "dense", right: "dense",
		  trees: [[38, 8]], elev: { tee: 0, basket: -18 },
		  note: "Steep drop to a tucked basket. Throw it softer than it looks." },
		{ par: 3, ft: 273, pts: [[7, 5], [45, 6], [70, 11]], hw: 4, rough: 2, left: "dense", right: "medium",
		  trees: [[30, 5]],
		  note: "Turns right late. Anhyzer or forehand line." },
		{ par: 3, ft: 318, pts: [[6, 10], [42, 9], [70, 4]], hw: 4, rough: 2, left: "medium", right: "dense",
		  trees: [[55, 7]], elev: { tee: 0, basket: 6 },
		  note: "Bends left up the slope." },
		{ par: 3, ft: 355, pts: [[6, 7], [71, 8]], hw: 3.5, rough: 2, left: "dense", right: "dense",
		  trees: [[30, 7], [48, 8]],
		  note: "Long, straight tunnel. Any wobble finds wood." },
		{ par: 3, ft: 240, pts: [[10, 11], [66, 5]], hw: 4.5, rough: 2, left: "light", right: "dense",
		  trees: [[40, 8]], elev: { tee: 0, basket: -10 },
		  note: "Downhill and a little left. Good birdie chance." },
		{ par: 3, ft: 327, pts: [[6, 4], [40, 5], [70, 10]], hw: 3.5, rough: 2, left: "dense", right: "dense",
		  trees: [[22, 4], [56, 8]],
		  note: "Tight early, then the fairway drifts right." },
		{ par: 4, ft: 489, pts: [[5, 11], [30, 12], [52, 6], [73, 5]], hw: 5, rough: 3, left: "dense", right: "medium",
		  trees: [[42, 9]], elev: { tee: 0, basket: 14, hills: [[60, 6, 6, 4]] },
		  note: "Climbs the bluff. Find the fairway first, then go." },
		{ par: 3, ft: 215, pts: [[12, 8], [64, 7]], hw: 4, rough: 2, left: "medium", right: "medium",
		  trees: [[38, 7]], elev: { tee: 0, basket: -12 },
		  note: "Short drop shot. Easy to sail past the pin." },
		{ par: 3, ft: 309, pts: [[6, 6], [44, 8], [71, 7]], hw: 3.5, rough: 2, left: "dense", right: "dense",
		  trees: [[28, 6], [58, 8]],
		  note: "Snakes through the trees. Accuracy over distance." },
		{ par: 4, ft: 552, pts: [[4, 12], [26, 9], [48, 4], [73, 4]], hw: 5, rough: 3, left: "dense", right: "dense",
		  trees: [[36, 6], [62, 5]], elev: { tee: 0, basket: -16, hills: [[30, 9, 6, 8]] },
		  note: "Big downhill par 4 that turns left. Long and tight." },
		{ par: 3, ft: 279, pts: [[7, 9], [70, 9]], hw: 4, rough: 2, left: "light", right: "dense",
		  trees: [[42, 10]],
		  note: "Straight at it with the woods right." },
		{ par: 3, ft: 226, pts: [[10, 5], [66, 10]], hw: 3.5, rough: 2, left: "dense", right: "medium",
		  trees: [[38, 7]], elev: { tee: 0, basket: 8 },
		  note: "Short climb. Take a little extra disc." },
		{ par: 4, ft: 538, pts: [[4, 4], [34, 6], [54, 11], [73, 11]], hw: 5, rough: 3, left: "dense", right: "dense",
		  trees: [[44, 9], [64, 11]], elev: { tee: 0, basket: -10, hills: [[24, 5, 7, 9]] },
		  note: "Over the hump and down to the right. Two big shots." },
		{ par: 4, ft: 419, pts: [[5, 10], [36, 9], [71, 6]], hw: 4.5, rough: 2, left: "dense", right: "dense",
		  trees: [[52, 8]], elev: { tee: 0, basket: 12 },
		  note: "Uphill finish. Make your last drive count." }
	]
}];
