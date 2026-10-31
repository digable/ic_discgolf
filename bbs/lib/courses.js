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
// An island green is a ring of water around the basket.
//
// Lengths and pars are real (UDisc); shapes are drawn, not surveyed. Each course's
// details and sources are in README.md, "Courses".

// High Bridge: holes 1-10 (on the bluff), shared by both layouts
var HIGH_BRIDGE_TOP = [
	{ par: 3, pts: [[8, 8], [68, 8]], hw: 5, rough: 3, left: "light", right: "medium",
	  trees: [[38, 7]],
	  note: "Park course opener. Short, but pick your line through the trees." },
	{ par: 3, pts: [[8, 10], [40, 9], [68, 5]], hw: 5, rough: 3, left: "medium", right: "light",
	  trees: [[30, 9]],
	  note: "Turns left around the trees. Hyzer or forehand line." },
	{ par: 3, pts: [[12, 6], [64, 9]], hw: 4, rough: 2, left: "dense", right: "medium",
	  trees: [[36, 7], [46, 8]],
	  note: "Shortest yet, and the most technical. Thread the gap." },
	{ par: 4, pts: [[5, 4], [36, 6], [72, 11]], hw: 6, rough: 3, left: "light", right: "medium",
	  trees: [[50, 9]],
	  note: "First par 4. Long and bending right - set up the second shot." },
	{ par: 4, pts: [[5, 11], [40, 10], [71, 5]], hw: 5, rough: 3, left: "medium", right: "light",
	  trees: [[55, 8], [22, 11]],
	  note: "Short par 4 that doglegs left. Lay up to the corner." },
	{ par: 3, pts: [[12, 8], [64, 8]], hw: 4, rough: 2, left: "medium", right: "medium",
	  trees: [[36, 8]],
	  note: "Short and straight, with a tree in the middle of the fairway." },
	{ par: 3, pts: [[10, 5], [66, 10]], hw: 4.5, rough: 2, left: "light", right: "dense",
	  trees: [[40, 7]],
	  note: "Angles right toward the wood line." },
	{ par: 3, pts: [[10, 10], [66, 6]], hw: 4, rough: 2, left: "dense", right: "light",
	  trees: [[44, 8]],
	  note: "Drifts left. The woods hug the left side." },
	{ par: 3, pts: [[9, 7], [42, 6], [67, 10]], hw: 4, rough: 2, left: "medium", right: "medium",
	  trees: [[28, 7]],
	  note: "S-curve through the park trees." },
	{ par: 3, pts: [[9, 9], [67, 8]], hw: 5, rough: 3, left: "light", right: "light",
	  trees: [[34, 8], [50, 9]],
	  note: "Last of the holes on top. Open, with a couple of trees to miss." }
];

// High Bridge: holes 11-18 (the valley), Heaven and Hell only
var HIGH_BRIDGE_BOTTOM = [
	{ par: 4, pts: [[8, 4], [38, 7], [68, 11]], hw: 3, rough: 6, left: "dense", right: "dense",
	  trees: [[30, 6], [50, 9]], elev: { tee: 0, basket: -30 },
	  note: "Over the edge of the bluff and down. A par 4: placement, not power." },
	{ par: 3, pts: [[12, 9], [64, 7]], hw: 3.5, rough: 6, left: "dense", right: "medium",
	  trees: [[40, 8]], elev: { tee: 0, basket: -10 },
	  note: "Still dropping toward the river. Weeds off the fairway." },
	{ par: 3, pts: [[10, 8], [66, 8]], hw: 3.5, rough: 6, left: "medium", right: "dense",
	  trees: [[30, 8], [46, 7]],
	  note: "The valley floor. Fallen trees and tall grass - stay on your line." },
	{ par: 3, pts: [[9, 6], [44, 7], [68, 11]], hw: 3.5, rough: 6, left: "dense", right: "dense",
	  trees: [[56, 9]], elev: { tee: 0, basket: -10 },
	  note: "Overgrown tunnel bending right, lower still." },
	{ par: 3, pts: [[9, 10], [44, 9], [68, 5]], hw: 3.5, rough: 6, left: "dense", right: "dense",
	  trees: [[26, 10]], elev: { tee: 0, basket: -10 },
	  note: "The bottom of the course. Bends left through the weeds." },
	{ par: 4, pts: [[5, 11], [36, 9], [72, 4]], hw: 4, rough: 6, left: "dense", right: "dense",
	  trees: [[48, 8]], elev: { tee: 0, basket: 25, hills: [[24, 10, 6, 6]] },
	  note: "The long climb back out. Two shots, both uphill." },
	{ par: 3, pts: [[14, 8], [62, 7]], hw: 3.5, rough: 5, left: "dense", right: "medium",
	  trees: [[38, 8]], elev: { tee: 0, basket: 15 },
	  note: "Short but steep. Take more disc than it looks." },
	{ par: 3, pts: [[14, 7], [62, 9]], hw: 4, rough: 5, left: "medium", right: "medium",
	  trees: [[40, 8]], elev: { tee: 0, basket: 10 },
	  note: "One more climb, back to the top to finish." }
];

// Copies of holes with their lengths (ft) set, one per length
function holesWithFt(holes, ft) {
	var out = [];
	for (var i = 0; i < ft.length; i++) {
		var h = {}, k;
		for (k in holes[i]) h[k] = holes[i][k];
		h.ft = ft[i];
		out.push(h);
	}
	return out;
}

// Turkey Creek: 9 holes, par 27
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
// Wildcat Bluff: 21 holes, par 71 (red tees)
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
}, {
// Eagles Crossing, Championship Course: 18 holes, par 70 (red layout)
	name: "Eagles Crossing",
	where: "Championship Course, New Truxton, MO",
	holes: [
		{ par: 4, ft: 582, pts: [[5, 8], [40, 7], [72, 8]], hw: 7, rough: 4, left: "open", right: "open",
		  trees: [[30, 6]], ob: [{ t: "W", x1: 60, y1: 11, x2: 77, y2: 15 }],
		  note: "Wide open and long. Water waits right of the green." },
		{ par: 4, ft: 462, pts: [[5, 4], [45, 6], [72, 10]], hw: 7, rough: 4, left: "open", right: "light",
		  trees: [[25, 5]], ob: [{ t: "W", x1: 57, y1: 5, x2: 63, y2: 13 }], elev: { tee: 0, basket: -14 },
		  note: "Downhill bomber. The approach crosses the pond." },
		{ par: 4, ft: 354, pts: [[6, 11], [40, 9], [71, 5]], hw: 4, rough: 2, left: "dense", right: "dense",
		  trees: [[52, 7]], elev: { tee: 0, basket: 10 },
		  note: "Wooded and uphill. Two clean shots beat one big one." },
		{ par: 5, ft: 657, pts: [[4, 8], [26, 6], [50, 9], [73, 8]], hw: 5, rough: 3, left: "medium", right: "dense",
		  trees: [[18, 7]], ob: [{ t: "W", x1: 33, y1: 3, x2: 39, y2: 13 }, { t: "W", x1: 61, y1: 5, x2: 65, y2: 12 }], elev: { tee: 0, basket: -8 },
		  note: "Par 5 over two ponds at different levels. Lay up or carry them." },
		{ par: 5, ft: 642, pts: [[4, 12], [30, 10], [52, 5], [73, 4]], hw: 5, rough: 3, left: "dense", right: "dense",
		  trees: [[40, 8], [62, 4]], elev: { tee: 0, basket: 12, hills: [[30, 10, 7, 6]] },
		  note: "Long wooded climb. Stay in the fairway." },
		{ par: 4, ft: 471, pts: [[5, 5], [70, 10]], hw: 6, rough: 3, left: "light", right: "light",
		  trees: [[35, 7], [50, 9]], ob: [{ t: "W", x1: 66, y1: 12, x2: 77, y2: 15 }], elev: { tee: 0, basket: -20 },
		  note: "Drops steeply past the trees. Water short and right of the pin." },
		{ par: 3, ft: 330, pts: [[7, 6], [70, 6]], hw: 6, rough: 3, left: "open", right: "open",
		  trees: [[40, 5]], ob: [{ t: "W", x1: 10, y1: 9, x2: 72, y2: 13 }],
		  note: "Water all down the right side." },
		{ par: 3, ft: 199, pts: [[10, 8], [64, 8]], hw: 5, rough: 2, left: "light", right: "light",
		  trees: [], ob: [{ t: "W", x1: 58, y1: 4, x2: 70, y2: 6 }, { t: "W", x1: 58, y1: 10, x2: 70, y2: 12 }, { t: "W", x1: 58, y1: 7, x2: 60, y2: 9 }, { t: "W", x1: 68, y1: 7, x2: 70, y2: 9 }],
		  note: "Island green. Land it or re-tee." },
		{ par: 4, ft: 504, pts: [[5, 10], [38, 8], [72, 6]], hw: 7, rough: 4, left: "light", right: "open",
		  trees: [[55, 7]], ob: [{ t: "W", x1: 25, y1: 0, x2: 60, y2: 3 }], elev: { tee: 0, basket: 10 },
		  note: "Open and uphill, with the water's edge left." },
		{ par: 5, ft: 555, pts: [[4, 6], [36, 8], [73, 9]], hw: 5, rough: 3, left: "dense", right: "medium",
		  trees: [[24, 7], [56, 9]],
		  note: "Long par 5 through the woods. Patience." },
		{ par: 3, ft: 261, pts: [[8, 7], [66, 8]], hw: 3, rough: 2, left: "dense", right: "dense",
		  trees: [], ob: [{ t: "W", x1: 60, y1: 4, x2: 72, y2: 6 }, { t: "W", x1: 60, y1: 10, x2: 72, y2: 12 }, { t: "W", x1: 60, y1: 7, x2: 62, y2: 9 }, { t: "W", x1: 70, y1: 7, x2: 72, y2: 9 }], elev: { tee: 0, basket: -15 },
		  note: "Downhill down a narrow gap to an island green." },
		{ par: 3, ft: 225, pts: [[10, 9], [64, 7]], hw: 4, rough: 2, left: "medium", right: "dense",
		  trees: [[40, 8]], elev: { tee: 0, basket: 12 },
		  note: "Steep uphill shot. Missing right is costly." },
		{ par: 3, ft: 207, pts: [[12, 8], [64, 8]], hw: 3.5, rough: 2, left: "dense", right: "dense",
		  trees: [[38, 8]],
		  note: "Short and wooded. Hit the gap." },
		{ par: 4, ft: 375, pts: [[6, 4], [40, 6], [71, 10]], hw: 4, rough: 2, left: "dense", right: "dense",
		  trees: [[28, 5]], ob: [{ t: "R", x1: 44, y1: 0, x2: 45, y2: 15 }, { t: "W", x1: 68, y1: 12, x2: 77, y2: 15 }],
		  note: "Over the gravel road (out of bounds) and on to a pin near water." },
		{ par: 3, ft: 330, pts: [[8, 6], [66, 9]], hw: 5, rough: 2, left: "light", right: "medium",
		  trees: [[34, 7]], ob: [{ t: "W", x1: 60, y1: 5, x2: 72, y2: 7 }, { t: "W", x1: 60, y1: 11, x2: 72, y2: 13 }, { t: "W", x1: 60, y1: 8, x2: 62, y2: 10 }, { t: "W", x1: 70, y1: 8, x2: 72, y2: 10 }], elev: { tee: 0, basket: 6 },
		  note: "Slightly uphill to an island green." },
		{ par: 4, ft: 438, pts: [[5, 8], [72, 8]], hw: 7, rough: 4, left: "open", right: "open",
		  trees: [[45, 7]], ob: [{ t: "W", x1: 12, y1: 3, x2: 22, y2: 13 }],
		  note: "Carry the water off the tee, then it opens up." },
		{ par: 4, ft: 417, pts: [[6, 11], [40, 9], [71, 4]], hw: 4, rough: 2, left: "dense", right: "dense",
		  trees: [[30, 10]], ob: [{ t: "R", x1: 50, y1: 0, x2: 51, y2: 15 }], elev: { tee: 0, basket: -14 },
		  note: "Downhill through the woods, across the gravel road." },
		{ par: 5, ft: 555, pts: [[4, 3], [30, 5], [55, 7], [73, 5]], hw: 6, rough: 3, left: "light", right: "light",
		  trees: [[42, 5]], ob: [{ t: "W", x1: 20, y1: 10, x2: 40, y2: 15 }, { t: "W", x1: 46, y1: 11, x2: 66, y2: 15 }], elev: { tee: 0, basket: 12 },
		  note: "Curls around two ponds on the right to an elevated green." }
	]
}, {
// Sugar Bottom: 18 holes, par 55
	name: "Sugar Bottom",
	where: "Sugar Bottom Rec Area, Solon, IA",
	holes: [
		{ par: 3, ft: 210, pts: [[10, 8], [66, 8]], hw: 5, rough: 4, left: "medium", right: "light",
		  trees: [[38, 7]],
		  note: "Short opener. Stay out of the shaggy rough." },
		{ par: 3, ft: 312, pts: [[6, 6], [42, 7], [70, 11]], hw: 5, rough: 4, left: "dense", right: "medium",
		  trees: [[30, 6]], elev: { tee: 0, basket: -8 },
		  note: "Downhill, fading right at the end." },
		{ par: 3, ft: 372, pts: [[5, 10], [40, 9], [71, 5]], hw: 6, rough: 5, left: "light", right: "open",
		  trees: [[52, 7]], elev: { tee: 0, basket: 6 },
		  note: "Open and uphill, bending left. Long for a three." },
		{ par: 3, ft: 432, pts: [[4, 8], [72, 8]], hw: 7, rough: 5, left: "open", right: "light",
		  trees: [[36, 6], [50, 10]], elev: { tee: 0, basket: -6, hills: [[40, 8, 7, 6]] },
		  note: "Longest par 3. Big drive over the rise." },
		{ par: 3, ft: 217, pts: [[10, 5], [66, 9]], hw: 3.5, rough: 3, left: "dense", right: "dense",
		  trees: [[40, 7]],
		  note: "Short and tight in the woods. Hit the gap." },
		{ par: 3, ft: 240, pts: [[9, 9], [67, 7]], hw: 4, rough: 3, left: "dense", right: "medium",
		  trees: [[36, 8]], elev: { tee: 0, basket: 10 },
		  note: "Uphill through the trees. Take a little extra." },
		{ par: 3, ft: 395, pts: [[5, 4], [38, 6], [71, 10]], hw: 6, rough: 5, left: "light", right: "medium",
		  trees: [[56, 9]], elev: { tee: 0, basket: -12 },
		  note: "Long downhill shot that turns right." },
		{ par: 3, ft: 233, pts: [[9, 8], [67, 8]], hw: 3.5, rough: 3, left: "dense", right: "dense",
		  trees: [[30, 8], [48, 8]],
		  note: "Straight tunnel. Smooth beats big arm." },
		{ par: 3, ft: 309, pts: [[6, 11], [44, 10], [70, 5]], hw: 4.5, rough: 4, left: "medium", right: "dense",
		  trees: [[58, 8]], elev: { tee: 0, basket: 8 },
		  note: "Climbs and bends left late." },
		{ par: 3, ft: 241, pts: [[9, 6], [67, 9]], hw: 5, rough: 4, left: "light", right: "medium",
		  trees: [[38, 7]], elev: { tee: 0, basket: -10 },
		  note: "Downhill. Easy to sail it long into the weeds." },
		{ par: 3, ft: 260, pts: [[8, 10], [68, 6]], hw: 4, rough: 3, left: "dense", right: "medium",
		  trees: [[40, 8]],
		  note: "Gentle left drift. Watch the wood line." },
		{ par: 3, ft: 256, pts: [[8, 5], [40, 6], [68, 10]], hw: 4, rough: 3, left: "medium", right: "dense",
		  trees: [[26, 5]], elev: { tee: 0, basket: 6 },
		  note: "Turns right through the trees." },
		{ par: 3, ft: 192, pts: [[12, 8], [64, 8]], hw: 5, rough: 4, left: "open", right: "light",
		  trees: [[40, 9]], elev: { tee: 0, basket: -14 },
		  note: "Shortest hole. Drop shot - throw it softer than it looks." },
		{ par: 3, ft: 265, pts: [[8, 7], [68, 7]], hw: 4, rough: 3, left: "dense", right: "dense",
		  trees: [[34, 6], [52, 8]],
		  note: "Wooded and straight. Any wobble finds a tree." },
		{ par: 3, ft: 323, pts: [[6, 9], [42, 8], [70, 4]], hw: 5, rough: 4, left: "medium", right: "light",
		  trees: [[54, 6]], elev: { tee: 0, basket: 10 },
		  note: "Uphill, drifting left." },
		{ par: 3, ft: 388, pts: [[5, 5], [72, 9]], hw: 6, rough: 5, left: "light", right: "open",
		  trees: [[30, 6], [56, 9]], elev: { tee: 0, basket: -8, hills: [[44, 7, 6, 5]] },
		  note: "Long and open over a hump." },
		{ par: 3, ft: 429, pts: [[4, 10], [38, 8], [72, 6]], hw: 6, rough: 5, left: "medium", right: "medium",
		  trees: [[24, 10], [58, 7]], elev: { tee: 0, basket: 12 },
		  note: "Long uphill par 3. Three is a good score here." },
		{ par: 4, ft: 717, pts: [[4, 4], [28, 6], [50, 11], [73, 11]], hw: 6, rough: 5, left: "dense", right: "medium",
		  trees: [[40, 9], [62, 11]], elev: { tee: 0, basket: -10, hills: [[22, 5, 7, 8]] },
		  note: "The big finish. Over the ridge, down and right. Two big shots." }
	]
}, {
// High Bridge, The Top Ten: 10 holes, par 32
	name: "High Bridge Top Ten",
	where: "High Bridge DGC, Eldora, IA",
	holes: holesWithFt(HIGH_BRIDGE_TOP, [249, 251, 212, 444, 352, 210, 222, 224, 230, 243])
}, {
// High Bridge, Heaven and Hell: 18 holes, par 58
	name: "High Bridge Heaven & Hell",
	where: "High Bridge DGC, Eldora, IA",
	holes: holesWithFt(HIGH_BRIDGE_TOP.concat(HIGH_BRIDGE_BOTTOM),
		[249, 250, 212, 420, 352, 209, 222, 224, 231, 244, 246, 211, 226, 252, 252, 400, 184, 190])
}];
