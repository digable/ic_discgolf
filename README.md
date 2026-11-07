# Disc Golf Door 

A Genesis-style disc golf game for Synchronet BBS, built around a 3-click swing
meter. The same game script runs in two places:

- **On your BBS** as a JavaScript door (`bbs/discgolf.js`).
- **In a web browser** (`index.html`): an emulated 80×25 ANSI terminal that runs
  the real door, with a simulated connection (lag, jitter, modem speeds),
  so testers can play without dialing in.

47 courses at 44 real disc golf parks in the USA, Sweden, Norway and Finland, including all of UDisc's top 25 in the USA and in the world (see [Courses](#courses)). Turkey Creek can also be played photo-accurate, traced from aerial photos.

## Players and saved settings

- **On the BBS** you play under your BBS alias, and your settings (hand, usual throw,
  level, flight path, putting view, disc bag and house rules) are saved for next time:
  - **First visit:** player setup, then **Continue** saves it ("Saved for next time").
  - **Coming back:** a welcome-back screen shows your saved settings: **Play with
    these** (Enter) or **Change settings** (player setup with your answers filled in,
    saved when you continue).
  - **Player setup** from the title screen saves the same way. Leaving the bag screen
    after changing your bag asks "Save this bag for next time? Y/n". The putting view
    is remembered when a round ends.
  - If the save service doesn't answer, you play with the defaults and a note says
    settings won't be saved today.
- **On the web** you type the name you'll play under (the same rules as a new BBS
  alias: up to 25 characters, starting with a letter, no double spaces or trailing
  space). Web settings aren't saved.
- **Shared games** (cross-play, coming later): web players' names are tagged so they
  can't pass for a BBS player: "Digable (web)", then "Digable (web01)", "Digable
  (web02)" for more web players with the same name (`webName()` in `api/_names.js`).

Saves are kept by the save service (`server.js`), in SQLite, keyed by the BBS alias
like IC Zombies' saves. See [The save service](#the-save-service).

## Your bag

A standard bag holds 8 discs: 7 plus a putter. **Every bag must have a putter** (a disc of
type Putter). It's the disc you putt with, and it can't be lost in the water. On the bag screen
you can take your putter out to swap in another one, but you can't leave the screen until the
bag has a putter again. The putter has its own slot, so a bag with no putter always has room for
one. House rules can change how many other discs fit (see [House rules](#house-rules)). A bag
saved before this rule that has no putter gets a KC Aviar.

## Disc weights

Every disc in the bag is Light (150 g), Mid (165 g) or Max (175 g). On the bag screen,
**1 2 3** add or remove the 150, 165 or 175 g copy of a disc (the same mold can be in
the bag at more than one weight); **SPACE** adds it at 175 g, or takes out every copy.
The panel, the throw result and the welcome-back screen show the weight.

| Lighter disc | Heavier disc |
|---|---|
| Needs less arm speed: a Regular player throws it farther | Needs full arm speed (a Pro gets the same distance either way) |
| Turns more, fades less | Holds its line |
| Feels the wind more (1.6 times at 150 g) | Steadier in wind; a heavy putter drifts less |
| Stops sooner on the ground | Skips and rolls farther, punches through trees a bit more often |

All of it is scaled by `wtOf()` in `bbs/lib/discs.js` (0 at 175 g, -1 at 150 g) and
applied in `throwShape()` and `fly()` (`bbs/lib/flight.js`), `discRange()` and the putt
drift. The range mark includes weight (still no wind). A bag entry is the disc's name
(175 g) or `name:grams` (`Leopard3:150`), so bags saved before weights load unchanged.

## House rules

**House rules** on the title screen changes how your rounds are scored and played. It works like
player setup: Up/Down picks a rule, Left/Right or a letter changes it.

| Rule | Choices | Standard |
|---|---|---|
| Out of bounds | Penalty stroke, or no penalty (either way you play from where it went out) | Penalty stroke |
| Optional relief | Costs a stroke, or free | Costs a stroke |
| Bag size | 1 to 26 discs, one of them the putter (1 is putter only) | 8 (7 + putter) |
| Mulligans | None, one or two | None |
| Mulligans are | Per 9, 18 or 27 holes, or per round | Per round |
| Wind | Calm (none), normal (0-12 mph) or windy (10-25 mph) | Normal |

- **Bag size:** lowering it takes out your fastest discs (never your putter) when you leave
  the screen, and the title screen says which.
- **Mulligans:** after a throw, the help line offers **M** to take it back. You go back to
  where you threw from with the same disc and aim, and the stroke, any penalty and a disc
  lost in the water are all undone. Putts can't be mulliganed. Per 9 holes means holes 1-9
  get their own, then 10-18, and so on.
- **A round keeps the rules it started with**, and the scorecard shows any that aren't
  standard ("House rules: no OB penalty, 2 mulligans per 9, 1 used"), so a round on easy
  rules isn't mistaken for a standard one. The title screen shows them too.

The defaults are `HOUSE_DEFAULT` in `bbs/lib/state.js`; the rules themselves are in
`bbs/lib/rules.js` and read only the round's copy (`R.rules`).

## Courses

**Play** opens a scrolling course list: Up/Down to move, Enter (or Space) to play.
Left/Right sorts it by name, city, state, country or UDisc rating, and R reverses the
order. It starts A to Z by name, and rating starts high to low. Courses outside the USA have no
state, so they sort after the ones that do. A course with a photo-traced version shows
**Drawn** or **Photo-accurate** on its row, and V switches between them.

| # | Course | Holes | Par | Length | UDisc rating | Address |
|---|---|---|---|---|---|---|
| 1 | Turkey Creek | 9 | 27 | 2,500 ft | 2.8 | Turkey Creek Day Use Area, 2850 Prairie Du Chien Rd NE, Iowa City, IA 52240 |
| 2 | Wildcat Bluff | 21 | 71 | 7,445 ft | 4.8 | Wildcat Bluff Recreation Area, 3139 57th Street Trail, Center Point, IA 52213 |
| 3 | Eagles Crossing (Championship Course) | 18 | 70 | 7,564 ft | 4.9 | Eagles Crossing, 300 Eagles Nest Farm Road, Hawk Point, MO 63349 |
| 4 | Sugar Bottom | 18 | 55 | 5,791 ft | 4.1 | Sugar Bottom Day Use Area, 2192 Mehaffey Bridge Rd NE, Solon, IA 52333 |
| 5 | High Bridge Top Ten | 10 | 32 | 2,635 ft | 3.7 | Memorial Park, 9 Park Street, Eldora, IA 50627 |
| 6 | High Bridge Heaven & Hell | 18 | 58 | 4,575 ft | 3.7 | Memorial Park, 9 Park Street, Eldora, IA 50627 |
| 7 | Peninsula Park | 18 | 55 | 5,507 ft | 4.3 | Peninsula Park, Foster Rd & Ball St, Iowa City, IA 52240 |
| 8 | Altmaier Park | 18 | 56 | 6,095 ft | 4.5 | Altmaier Family Park, 3444 Deer Creek Rd SE, Coralville, IA 52241 |
| 9 | Blue Ribbon Pines | 27 | 91 | 10,708 ft | 4.8 | Blue Ribbon Pines, 2025 Klondike Dr NE, East Bethel, MN 55011 |
| 10 | Maple Hill | 18 | 55 | 4,156 ft | 4.9 | Leicester, MA |
| 11 | Brewster Ridge | 18 | 62 | 7,020 ft | 4.9 | Cambridge, VT |
| 12 | Fox Run Meadows | 18 | 63 | 8,675 ft | 4.9 | Cambridge, VT |
| 13 | The Diavolo | 22 | 77 | 8,624 ft | 4.8 | Cary, NC |
| 14 | Persimmon Ridge | 18 | 57 | 7,315 ft | 4.9 | Greenbrier, AR |
| 15 | Mile Marker 63 | 18 | 63 | 6,055 ft | 4.8 | East Brookfield, MA |
| 16 | The Canyons | 18 | 58 | 5,899 ft | 4.8 | Lockport, IL |
| 17 | Caliber | 18 | 65 | 7,885 ft | 4.9 | Sandpoint, ID |
| 18 | Idlewild | 18 | 68 | 9,629 ft | 4.8 | Burlington, KY |
| 19 | Harmony Bends | 18 | 68 | 6,916 ft | 4.8 | Columbia, MO |
| 20 | Hobb's Farm | 18 | 66 | 5,928 ft | 4.8 | Carrollton, GA |
| 21 | Sandy Point | 29 | 87 | 6,372 ft | 4.8 | Lac du Flambeau, WI |
| 22 | Northwood Black | 18 | 68 | 10,417 ft | 4.8 | Morton, IL |
| 23 | Faylor Lake | 18 | 64 | 6,593 ft | 4.8 | Beaver Springs, PA |
| 24 | Blue Goose | 18 | 58 | 5,073 ft | 4.9 | Frankfort, KY |
| 25 | Beaver Ranch | 21 | 63 | 6,031 ft | 4.8 | Conifer, CO |
| 26 | Bryant Lake Park | 18 | 59 | 5,963 ft | 4.8 | Eden Prairie, MN |
| 27 | Flip City | 24 | 74 | 8,147 ft | 4.7 | Shelby, MI |
| 28 | Meadowbrook Orchards | 18 | 56 | 5,385 ft | 4.7 | Sterling, MA |
| 29 | Sabattus: Hawk | 18 | 73 | 6,152 ft | 4.8 | Sabattus, ME |
| 30 | Neatman Creek | 18 | 61 | 5,462 ft | 4.8 | Germanton, NC |
| 31 | New London Tech | 18 | 69 | 12,100 ft | 4.7 | Forest, VA |
| 32 | Echo Valley | 18 | 68 | 8,264 ft | 4.7 | Waynesville, OH |
| 33 | Ale White | 18 | 63 | 9,558 ft | 4.9 | Nol, Sweden |
| 34 | Krokhol | 18 | 62 | 6,974 ft | 4.8 | Siggerud, Norway |
| 35 | Ale Yellow | 18 | 57 | 5,865 ft | 4.8 | Nol, Sweden |
| 36 | KIPPIS Pro | 18 | 64 | 8,548 ft | 4.8 | Heinola, Finland |
| 37 | Lundbyparken | 18 | 59 | 5,554 ft | 4.7 | Enköping, Sweden |
| 38 | Uspastorp | 18 | 58 | 6,294 ft | 4.6 | Nol, Sweden |
| 39 | Åkeslund | 18 | 60 | 5,719 ft | 4.7 | Hörby, Sweden |
| 40 | Ymergården Gold | 18 | 58 | 6,317 ft | 4.7 | Brämhult, Sweden |
| 41 | Karidalen | 18 | 59 | 5,610 ft | 4.6 | Lena, Norway |
| 42 | Glåmos | 18 | 59 | 4,206 ft | 4.7 | Glåmos, Norway |
| 43 | Äppelgården | 18 | 63 | 6,741 ft | 4.6 | Båstad, Sweden |
| 44 | Järva | 18 | 56 | 5,815 ft | 4.6 | Kista, Sweden |
| 45 | Häfla Bruks | 18 | 59 | 6,745 ft | 4.6 | Rejmyre, Sweden |
| 46 | Graceland University | 9 | 27 | 3,645 ft | 3.3 | Graceland University, 1 University Pl, Lamoni, IA 50140 |
| 47 | Legion Park | 26 | 86 | 10,003 ft | 3.2 | Legion Park, at the back of Thomas Park, Marion, IA 52302 |

Every course's hole lengths and pars are the real ones, from its UDisc listing
(2026). The rest of each hole (fairway shapes and bends, woods, single trees,
water, roads, parking lots and hills) is drawn from UDisc's description and
course reviews, not surveyed, so it's the course's character rather than an exact
copy. The holes are in `bbs/lib/courses.js`; adjust a hole there to match the real
one. The town shown in the game is the one UDisc lists, which isn't always the
mailing address's town. UDisc ratings are out of 5, copied by hand in November 2026, so
they don't update on their own; High Bridge's two layouts share one UDisc listing and
rating.

Courses 10-45, plus Eagles Crossing and Blue Ribbon Pines, are from UDisc's 2026 lists: its
[top 25 in the USA](https://udisc.com/best-disc-golf-courses/united-states) and its
[top 25 in the world](https://udisc.com/best-disc-golf-courses/world), which share 12 courses.
The table gives only their town. Each uses the layout UDisc's
public course page shows hole by hole, which isn't always the main one, and some are far beyond
the Regular level's reach. Their pars and lengths are real, but sources describe very few of
their holes one by one, so the shapes, woods, hills and most ponds were drawn by a script from
each course's overall character. Treat them as much rougher than courses 1-9, and adjust any
hole to match the real one. Graceland University (46) and Legion Park (47) are drawn the same way.

### 1. Turkey Creek

- **Where:** Coralville Lake (U.S. Army Corps of Engineers), east of the Coralville
  Lake Dam. Go east on Prairie Du Chien Rd NE across the dam; the Turkey Creek Day
  Use Area entrance is on the right. [Map](https://www.google.com/maps?q=41.72342,-91.52306)
- **The course:** 9 holes, free, established 1983. Short holes (150 to 300+ ft)
  with narrow and wide fairways, and the road and parking lot in play on several
  holes. Finding the next tee is part of the challenge.
- **In the game:** tight tunnels along the wood lines, with the parking lot (hole
  1, 7) and the road (holes 4, 9) out of bounds. No elevation yet.
- **Photo-accurate version:** on the course list, **V** switches Turkey Creek's row between
  **Drawn** (the holes above) and **Photo-accurate**. That version's holes are traced from
  aerial photos (UDisc's hole views, November 2026): a trunk under every tree crown, woods
  filled in at the density of the crowns around them, shade read as open ground, and each
  hole straight from tee to basket as UDisc draws it, with a few trees standing in the line.
  The road is out of bounds down the left of holes 2 and 3, and the lots at holes 1 and 9
  (with the drive along 9). No elevation yet. In the game it's "Turkey Creek (Traced)",
  the last entry in `COURSES` (`traced: true, of: "Turkey Creek"`).

### 2. Wildcat Bluff

- **Where:** Wildcat Bluff Recreation Area (Benton County Conservation), just
  south of Urbana. UDisc lists it under Vinton. [Map](https://www.google.com/maps?q=42.19472,-91.88794)
- **The course:** 21 holes, free, established 2007. Heavily wooded, extremely
  hilly and full of tight lines. UDisc's best-rated course in Iowa (2025).
- **In the game:** the short (red) tees, par 71. Tight wooded tunnels with big
  drops and climbs; eight par 4s.

### 3. Eagles Crossing (Championship Course)

- **Where:** Eagles Crossing, on 400 acres near Hawk Point, Missouri. UDisc lists
  it under New Truxton. [Map](https://www.google.com/maps?q=38.97686,-91.21237) ·
  [eaglescrossingdiscgolf.com](https://eaglescrossingdiscgolf.com/)
- **The course:** 18 holes, par 70, established 2021, on private land. Pay to
  play ($42 per round per player) with tee times booked online; closed in January
  and February. Open fields, very hilly woods and nine ponds and lakes, with red,
  white and blue tees on every hole. The park's second course, Wild Times (par
  64), isn't in the game.
- **In the game:** UDisc's "Masters Invitational 2026 - Red" layout. Ponds, three
  island greens (a ring of water around the basket) and a gravel road out of
  bounds. Where the water, woods and road go comes from reviews written before
  the course was renumbered in 2023, so some may now be on different holes.

### 4. Sugar Bottom

- **Where:** Sugar Bottom Day Use Area on Coralville Lake. UDisc lists it under
  North Liberty. The gates close in winter until April 1, but you can walk in:
  park at the small lot at 2335 Sugar Bottom Rd NE, about a 12-minute walk.
  [Map](https://www.google.com/maps?q=41.75941,-91.55703)
- **The course:** 18 holes, free, established 1989. Hilly, a mix of wooded and
  open holes, and very shaggy off the fairways.
- **In the game:** UDisc's main layout ("Main - Sugar Bottom - 7/30/2026"),
  with heavy rough and a 717 ft par 4 to finish.

### 5 and 6. High Bridge (Top Ten, Heaven & Hell)

- **Where:** Memorial Park, the city park on the east side of Eldora. Park on the
  east side of Park Street, just north of the Welcome Center. The "high bridge" is
  the highway along the park's south edge, almost 100 ft above the Iowa River.
  [Map](https://www.google.com/maps?q=42.36133,-93.08465)
- **The course:** 18 holes, free, established 2022, concrete tees and Veteran
  baskets. Ten holes are up on the bluff: beginner friendly, shorter and slightly
  technical. The other eight go down into the river valley and back up, over
  rougher terrain. Reviews in 2026 say the bottom eight aren't being mowed (weeds
  instead of fairway, fallen trees).
- **In the game:** both of UDisc's layouts, as two courses that share their first
  ten holes:
  - **Top Ten** (UDisc: "The Top Ten"): just the ten bluff holes, flat.
  - **Heaven & Hell** (UDisc: "Heaven and Hell. 18 hole layout."): all 18. The
    bottom eight have tight fairways, heavy rough and dense woods, dropping about
    60 ft (holes 11-15) and climbing about 50 ft back out (16-18). The river and
    the bridge aren't in play, because no source says which holes they're near.

### 7. Peninsula Park

- **Where:** Peninsula Park, an Iowa City park on a bend of the Iowa River, off
  Foster Rd at Ball St. Park in the lot (port-o-potty, no drinking water).
  [Map](https://www.google.com/maps?q=41.67257,-91.55853)
- **The course:** 18 holes, free, established 2006, concrete tees, two baskets
  per hole (A and B). Mostly flat. The front nine is mostly in the woods; the back
  nine is more open and runs along the river. Shaggy off the fairways; watch for
  poison ivy and nettles. Hole 5 and holes 11-16 are prone to flooding, so check
  conditions before you go.
- **In the game:** UDisc's "Red Tees to Orange Baskets" layout, par 55 with one
  par 4 (hole 11, 503 ft). Wooded tunnels on the front nine, wide open on the back,
  and only small slopes. The river isn't in play, because no source says which
  holes it runs beside.

### 8. Altmaier Park (Coralville Disc Golf)

- **Where:** Altmaier Family Park in Coralville, on the old Altmaier farm, next to
  a quarry. [Map](https://www.google.com/maps?q=41.685167,-91.617665)
- **The course:** 18 holes, free, established 2018, designed by Jeff Harper,
  concrete tees and Mach X baskets. Open farm fields with young trees and some
  wooded holes, very hilly after the first three, and Clear Creek in play on
  holes 4-6. **Opens at 11:00 am on weekdays** because of blasting at the quarry.
  The walk back to the lot doubles back through fairways.
- **In the game:** UDisc's "The Farm" layout, par 56, with two par 4s (hole 10,
  432 ft, and hole 18, 690 ft uphill). Flat and open for 1-3, the creek as water
  out of bounds on 4-6, and big climbs and drops after. Which side of each fairway
  the creek is on is a guess.

### 9. Blue Ribbon Pines

- **Where:** Blue Ribbon Pines in East Bethel, Minnesota, north of the Twin Cities,
  on private land. [Map](https://www.google.com/maps?q=45.334633,-93.223228)
- **The course:** 27 holes, opened in August 2006, designed by Timmy Gill and Steve
  Beckman on the Jordan family's farm. Pay to play ($8 a day, per UDisc). Ranked #14
  in UDisc's 100 Best Disc Golf Courses in the World. Mostly flat, with tall pines,
  groomed fairways, ponds, and open holes across a big grass field between two
  wooded sides. Baskets rotate, so the layout changes often. Fairways can flood in
  the spring.
- **In the game:** UDisc's "Newbie 2" layout, par 91, the one UDisc's public page shows
  hole by hole (the other layouts' pages need a login). It's longer than the
  9,768 ft PDGA lists, and hole 20 is a 485 ft par 3. Its numbering differs from what
  reviews use, so hole 5 (444 ft) is drawn as the famous long, straight tunnel they
  call hole 4, on the guess that it's the same hole. Hole 18 is the 760 ft "driving
  range hole" in UDisc's article, and 810 ft here. Which holes are wooded or open, and
  which have ponds (3, 8, 13, 21 and 23), is a guess: reviews only say water is on
  "several holes" and "can not be seen from the tee". No elevation.

### 10. Maple Hill

- **Where:** Leicester, Massachusetts. #1 on UDisc's 2026 USA list. [Map](https://www.google.com/maps?q=42.276001,-71.895699) · [UDisc](https://udisc.com/courses/maple-hill-lCej)
- **The course:** 18 holes on layouts including Red, White, Blue and Gold, established 2002, $12-30 a round. A Disc Golf Pro Tour stop (the MVP Open) on a farm outside Worcester: very hilly, heavily wooded fairways, water hazards, and Christmas tree nurseries along the open fairways.
- **In the game:** UDisc's "Maple Hill Reds" layout, par 55. Which holes have water is a guess.

### 11. Brewster Ridge

- **Where:** Cambridge, Vermont. #2 on UDisc's 2026 USA list. [Map](https://www.google.com/maps?q=44.59685980175962,-72.79926186012116) · [UDisc](https://udisc.com/courses/brewster-ridge-disc-golf-course-DVua)
- **The course:** Established 2012, $15-20 a round, at Smugglers' Notch resort. Very hilly, on a ski area; hosts Discraft's Green Mountain Championship. UDisc shows it closed for the 2026 season until May 2027.
- **In the game:** UDisc's "Blue Tees" layout, par 62.

### 12. Fox Run Meadows

- **Where:** Cambridge, Vermont. #3 on UDisc's 2026 USA list. [Map](https://www.google.com/maps?q=44.597313,-72.800232) · [UDisc](https://udisc.com/courses/fox-run-meadows-yi3h)
- **The course:** Established 2015, $15-20 a round, also at Smugglers' Notch. Open, long holes and shorter technical ones, with mountain views and a lot of OB; hosted the 2023 PDGA Pro Worlds. UDisc shows it closed until May 2027.
- **In the game:** UDisc's "Blue Tees" layout, par 63.

### 13. The Diavolo

- **Where:** Cary, North Carolina. #6 on UDisc's 2026 USA list. [Map](https://www.google.com/maps?q=35.81645235174141,-78.92747454952531) · [UDisc](https://udisc.com/courses/the-diavolo-dgc-new-hope-park-SxAA)
- **The course:** 22 holes, free, opened October 2020, designed by Jay Pontier and Mike Sink. Hilly, 48 acres of open and wooded holes, split by the American Tobacco Trail, with two water holes and three "Fusion" holes that join two par 3s into a par 4.
- **In the game:** UDisc's "Diavolo White" layout, par 77. Hole 14's elevated basket is real. Which two holes have water is a guess.

### 14. Persimmon Ridge

- **Where:** Greenbrier, Arkansas. #7 on UDisc's 2026 USA list. [Map](https://www.google.com/maps?q=35.28117769833871,-92.31960184872152) · [UDisc](https://udisc.com/courses/persimmon-ridge-dgc-ErdF)
- **The course:** 36 holes over 90+ acres of former golf course, private land, established 2018, designed by Matt Loyd, $8 a day. Hilly, with wooded corridors, open fields and water carries.
- **In the game:** UDisc's "Persimmon Ridge Blue" layout, par 57. Hole 18 crosses the lake, from a photo caption. The other pond's hole is a guess.

### 15. Mile Marker 63

- **Where:** East Brookfield, Massachusetts. #8 on UDisc's 2026 USA list. [Map](https://www.google.com/maps?q=42.22738774310065,-72.06348253793657) · [UDisc](https://udisc.com/courses/mile-marker-63-Qkn3)
- **The course:** Established 2024 on an old 9-hole golf course, the first design by Simon Lizotte and Casey White, $10-15 a day, private land. Hilly, with no water hazards listed.
- **In the game:** UDisc's "Short Tee Pads Without Added O.B" layout, par 63.

### 16. The Canyons

- **Where:** Lockport, Illinois. #9 on UDisc's 2026 USA list. [Map](https://www.google.com/maps?q=41.57177,-88.061157) · [UDisc](https://udisc.com/courses/the-canyons-at-dellwood-park-EV25)
- **The course:** 27 holes, free, established 2014, in a historic park. Very hilly. The extra nine are two optional wooded loops with creek crossings, and aren't in this layout.
- **In the game:** UDisc's "OG 18 White Tees - A Pins" layout, par 58.

### 17. Caliber

- **Where:** Sandpoint, Idaho. #10 on UDisc's 2026 USA list. [Map](https://www.google.com/maps?q=48.41087767270189,-116.50324556976557) · [UDisc](https://udisc.com/courses/caliber-dgc-Rxbo)
- **The course:** Established 2018, $15 a round, private land in the Selkirk Mountains, 10 minutes north of Sandpoint. Extremely hilly woods with water hazards. Closed for 2026, reopening spring 2027.
- **In the game:** UDisc's "Am Tees" layout, par 65. Which holes have water is a guess.

### 18. Idlewild

- **Where:** Burlington, Kentucky. #11 on UDisc's 2026 USA list. [Map](https://www.google.com/maps?q=39.038177,-84.736191) · [UDisc](https://udisc.com/courses/idlewild-FVl4)
- **The course:** 24 holes, free, established 2000, a Disc Golf Pro Tour course since 2017. Extremely hilly and described as one of the toughest in the world.
- **In the game:** UDisc's "2026 LWS Open - MPO" layout, par 68. This is the 2026 tournament layout (MPO), very long and hard. Hole 2 crosses the water, from a photo caption.

### 19. Harmony Bends

- **Where:** Columbia, Missouri. #12 on UDisc's 2026 USA list. [Map](https://www.google.com/maps?q=38.96672121183835,-92.40507200233222) · [UDisc](https://udisc.com/courses/harmony-bends-iSZl)
- **The course:** Free, established 2016, designed by John Houck for top-tier events. Extremely hilly, with stairs and multiple creek crossings.
- **In the game:** UDisc's "Red Tees" layout, par 68. Which holes the creek crosses is a guess.

### 20. Hobb's Farm

- **Where:** Carrollton, Georgia. #13 on UDisc's 2026 USA list. [Map](https://www.google.com/maps?q=33.595123,-85.076363) · [UDisc](https://udisc.com/courses/hobbs-farm-disc-golf-W9kF)
- **The course:** Free, established 2016, designed by John Houck. UDisc's #1 in Georgia. Hilly, with no water hazards listed.
- **In the game:** UDisc's "Red to Green" layout, par 66.

### 21. Sandy Point

- **Where:** Lac du Flambeau, Wisconsin. #14 on UDisc's 2026 USA list. [Map](https://www.google.com/maps?q=45.9055867597142,-89.98492569282179) · [UDisc](https://udisc.com/courses/sandy-point-disc-golf-ranch-GYmV)
- **The course:** 27-29 holes at Sandy Point Resort, established 1993, $5. Heavily wooded, with many elevation changes on the front 12 and a fairly flat back 15. Two lake holes close from early June to late August.
- **In the game:** UDisc's "Loon Short 29 Holes to Green Baskets" layout, par 87. Holes play in order 1-29: UDisc's 20A and 20B are 21 and 22 here, and later holes shift by two. Flat after hole 12. Which two holes have water is a guess.

### 22. Northwood Black

- **Where:** Morton, Illinois. #15 on UDisc's 2026 USA list. [Map](https://www.google.com/maps?q=40.64788279537992,-89.44976560771464) · [UDisc](https://udisc.com/courses/northwood-park-black-uqNc)
- **The course:** Free, established 2021, built "to be the hardest disc golf course in the world". Very hilly.
- **In the game:** UDisc's "Northwood Black" layout, par 68.

### 23. Faylor Lake

- **Where:** Beaver Springs, Pennsylvania. #16 on UDisc's 2026 USA list. [Map](https://www.google.com/maps?q=40.761387591576636,-77.21516416739391) · [UDisc](https://udisc.com/courses/faylor-lake-disc-golf-park-vVwU)
- **The course:** Free, established 2021, designed by Lee Zimmerman, now a Discraft course. Extremely hilly, with a scenery rating of 5.0.
- **In the game:** UDisc's "Standard White Layout" layout, par 64. Hole 12 has a big drop behind the basket, from a photo caption.

### 24. Blue Goose

- **Where:** Frankfort, Kentucky. #17 on UDisc's 2026 USA list. [Map](https://www.google.com/maps?q=38.218005654989724,-85.01153809040147) · [UDisc](https://udisc.com/courses/blue-goose-2Wa3)
- **The course:** 36 holes on wooded former tobacco farmland, private and family-owned, established 2021, $10 a day, tee times required. Very hilly and heavily wooded.
- **In the game:** UDisc's "Yellow_Original (Summer)" layout, par 58.

### 25. Beaver Ranch

- **Where:** Conifer, Colorado. #18 on UDisc's 2026 USA list. [Map](https://www.google.com/maps?q=39.50639051411048,-105.29839713487968) · [UDisc](https://udisc.com/courses/beaver-ranch-disc-golf-course-dmjy)
- **The course:** 83 baskets across two courses, established 2006, $15-17 a day. An extremely hilly mountain course in the woods.
- **In the game:** UDisc's "Blue Layout" layout, par 63.

### 26. Bryant Lake Park

- **Where:** Eden Prairie, Minnesota. #19 on UDisc's 2026 USA list. [Map](https://www.google.com/maps?q=44.883183,-93.427391) · [UDisc](https://udisc.com/courses/bryant-lake-park-k5Dc)
- **The course:** Established 1999, $10 a round, overlooking Bryant Lake. Extremely hilly and famously well kept. The signature is hole 17, a bluff shot over the lake.
- **In the game:** UDisc's "Long Tees to Blue Baskets" layout, par 59. Hole 17 is drawn as the bluff shot over the lake; a Pro can carry it from the tee, a Regular player lays up.

### 27. Flip City

- **Where:** Shelby, Michigan. #20 on UDisc's 2026 USA list. [Map](https://www.google.com/maps?q=43.62259962604899,-86.2498660826524) · [UDisc](https://udisc.com/courses/flip-city-disc-golf-park-Q6Sd)
- **The course:** Established 1980, designed by Bill McKenzie, private, $5 a day, open April to October. Extremely hilly and lightly wooded.
- **In the game:** UDisc's "24 Holes" layout, par 74. Holes play in order 1-24: UDisc's 1A-6A come after 11, so they're 12-17 here and its 12-18 are 18-24.

### 28. Meadowbrook Orchards

- **Where:** Sterling, Massachusetts. #21 on UDisc's 2026 USA list. [Map](https://www.google.com/maps?q=42.42396343512203,-71.72106854570283) · [UDisc](https://udisc.com/courses/meadowbrook-orchards-Km6Z)
- **The course:** Established 2021, $10-15 a round, in a working apple orchard. Rolling, with open fairways through the trees and wooded technical areas.
- **In the game:** UDisc's "MBO Red Layout" layout, par 56.

### 29. Sabattus: Hawk

- **Where:** Sabattus, Maine. #22 on UDisc's 2026 USA list. [Map](https://www.google.com/maps?q=44.0548,-70.0331) · [UDisc](https://udisc.com/courses/sabattus-disc-golf-hawk-X4Iq)
- **The course:** Established 2005, $10 a round or $15 all day. Open fields, wooded lines and riverside views. UDisc lists it as hilly in one place and minimal elevation in another. The round ends at the course's goats.
- **In the game:** UDisc's "Hawk" layout, par 73. Mostly gentle slopes.

### 30. Neatman Creek

- **Where:** Germanton, North Carolina. #23 on UDisc's 2026 USA list. [Map](https://www.google.com/maps?q=36.350525655260775,-80.27183644473553) · [UDisc](https://udisc.com/courses/neatman-creek-LlEM)
- **The course:** Private land, established 2021, $5, registration required. Extremely hilly, with woods, open holes and tight tunnels. Electric fences mark the OB on holes 1, 3 and 6, and run behind the basket on 2.
- **In the game:** UDisc's "Short Tees" layout, par 61. The fences are out of bounds on those holes; which side they run on is a guess.

### 31. New London Tech

- **Where:** Forest, Virginia. #24 on UDisc's 2026 USA list. [Map](https://www.google.com/maps?q=37.302282152653916,-79.33699096935342) · [UDisc](https://udisc.com/courses/new-london-tech-dgc-B9rN)
- **The course:** Free, established 2021, a gold-level course designed by Paul McBeth, very hilly and very challenging.
- **In the game:** UDisc's "Main (Long > Long)" layout, par 69. The long-to-long layout, the longest in the game at over 12,000 ft.

### 32. Echo Valley

- **Where:** Waynesville, Ohio. #25 on UDisc's 2026 USA list. [Map](https://www.google.com/maps?q=39.539549259274054,-84.16153069532184) · [UDisc](https://udisc.com/courses/echo-valley-at-hoffmann-reserve-q7H2)
- **The course:** Free, established 2021, redesigned 2025, by Carl Chiles. Hilly, with steep holes (5 down, 12 up) and ditch and creek crossings. Reviews call 6 a pine tunnel, 17 a water hole and 18 a swamp hole.
- **In the game:** UDisc's "Blue Tees" layout, par 68. Hole 6 is the tunnel, 17 crosses water and 18 has a swamp beside it, as reviewers say. Holes 5 and 12 are the big drop and climb.

### 33. Ale White

- **Where:** Nol, Sweden. #1 on UDisc's 2026 world list. [Map](https://www.google.com/maps?q=57.89392179392186,12.116823252421279) · [UDisc](https://udisc.com/courses/ale-disc-golf-center-white-course-Bwwj)
- **The course:** Established 2013, 119-129 kr a round, tee times required, closed in winter. Extremely hilly, with technical wooded holes and open fairways. One of four courses on the property.
- **In the game:** UDisc's "White" layout, par 63. Long, with two par 5s over 950 ft.

### 34. Krokhol

- **Where:** Siggerud, Norway. #2 on UDisc's 2026 world list. [Map](https://www.google.com/maps?q=59.80289655805656,10.926047017006706) · [UDisc](https://udisc.com/courses/krokhol-disc-golf-course-TKtF)
- **The course:** Established 2018, private land 20 minutes from Oslo, 50-80 NOK, booked through UDisc. Extremely hilly, with views and a clubhouse.
- **In the game:** UDisc's "Krokhol Blue Layout" layout, par 62.

### 35. Ale Yellow

- **Where:** Nol, Sweden. #3 on UDisc's 2026 world list. [Map](https://www.google.com/maps?q=57.89032526125977,12.117624767708781) · [UDisc](https://udisc.com/courses/ale-disc-golf-center-yellow-course-PSfu)
- **The course:** Established 2013, 95-120 kr a round, tee times required. Very hilly, winding through forest with technical wooded throws.
- **In the game:** UDisc's "Yellow" layout, par 57.

### 36. KIPPIS Pro

- **Where:** Heinola, Finland. #4 on UDisc's 2026 world list. [Map](https://www.google.com/maps?q=61.212067,26.051487) · [UDisc](https://udisc.com/courses/kippis-pro-disc-golf-park-Q64q)
- **The course:** Established 2004, voluntary 5 euro fee, in Heinola City Park. An extremely hilly esker landscape of fields and forest, part of Heinola DiscGolfPark World.
- **In the game:** UDisc's "KIPPIS Pro Long (Pitkä) - 2026" layout, par 64.

### 37. Lundbyparken

- **Where:** Enköping, Sweden. #7 on UDisc's 2026 world list. [Map](https://www.google.com/maps?q=59.67141003204493,17.046576216816902) · [UDisc](https://udisc.com/courses/lundbyparken-i88M)
- **The course:** Established 2019, private, 110-140 kr, and you must contact the operator before visiting. Mostly flat.
- **In the game:** UDisc's "Lundbyparken Grön" layout, par 59. Flat.

### 38. Uspastorp

- **Where:** Nol, Sweden. #10 on UDisc's 2026 world list. [Map](https://www.google.com/maps?q=57.902156901658486,12.118588416903926) · [UDisc](https://udisc.com/courses/uspastorp-disc-golf-park-sKSb)
- **The course:** Established 2021, by DiscGolfPark and Camilla Jernberg, 100 kr a day, on a farm with a bed and breakfast. Very hilly, varied forest and open land. A reviewer mentions a mandatory island.
- **In the game:** UDisc's "Main 18" layout, par 58. The island isn't drawn, because no source says which hole it's on.

### 39. Åkeslund

- **Where:** Hörby, Sweden. #11 on UDisc's 2026 world list. [Map](https://www.google.com/maps?q=55.808934796033014,13.82063014907564) · [UDisc](https://udisc.com/courses/akeslund-disc-golf-center-Slp3)
- **The course:** Established 2022, 100 SEK a day, private land. Hilly, closed in winter from November 8.
- **In the game:** UDisc's "Gul Kort" layout, par 60.

### 40. Ymergården Gold

- **Where:** Brämhult, Sweden. #12 on UDisc's 2026 world list. [Map](https://www.google.com/maps?q=57.74053323276979,13.00364455862433) · [UDisc](https://udisc.com/courses/ymergardens-discgolfcenter-gold-course-yQg4)
- **The course:** Established 2010, 75 kr a day, at a ski area, and a Disc Golf Pro Tour Elite stop. Extremely hilly, with holes 7-13 "carved out from thick woods".
- **In the game:** UDisc's "Silver layout - 2026" layout, par 58. The course is Gold, but UDisc's public page only shows its Silver layout hole by hole. UDisc lists it as par 59, but its holes add up to 58, which is what the game uses. Holes 7-13 are wooded.

### 41. Karidalen

- **Where:** Lena, Norway. #13 on UDisc's 2026 world list. [Map](https://www.google.com/maps?q=60.71228403073613,10.781043358262679) · [UDisc](https://udisc.com/courses/karidalen-frisbee-golf-park-QqRf)
- **The course:** Established 2018, free, volunteer-run by Toten Frisbeeklubb at a ski lodge. Very hilly, around a roller ski track where asphalt is out of bounds.
- **In the game:** UDisc's "Gul" layout, par 59. The ski track's asphalt isn't drawn, because no source says where it runs.

### 42. Glåmos

- **Where:** Glåmos, Norway. #16 on UDisc's 2026 world list. [Map](https://www.google.com/maps?q=62.670206216067186,11.433655270272283) · [UDisc](https://udisc.com/courses/glamos-diskgolfbane-taUo)
- **The course:** Established 2022, free. A very hilly, technical forest course with narrow fairways and some open terrain.
- **In the game:** UDisc's "Main, Alle 18 hull" layout, par 59.

### 43. Äppelgården

- **Where:** Båstad, Sweden. #21 on UDisc's 2026 world list. [Map](https://www.google.com/maps?q=56.423708835989146,12.92690841413264) · [UDisc](https://udisc.com/courses/aeppelgarden-i-bastad-ttVj)
- **The course:** Established 2025 on a former golf course, designed by Henric Hagman, 125 SEK a day. Rolling hills and great views.
- **In the game:** UDisc's "Blue" layout, par 63.

### 44. Järva

- **Where:** Kista, Sweden. #23 on UDisc's 2026 world list. [Map](https://www.google.com/maps?q=59.402659298437044,17.898298471298517) · [UDisc](https://udisc.com/courses/jaerva-discgolf-park-xgc5)
- **The course:** 27 holes in a public park, established 1995, 100-110 SEK a round. Extremely hilly, with rotating basket positions.
- **In the game:** UDisc's "Main 1-18 Short Tees" layout, par 56.

### 45. Häfla Bruks

- **Where:** Rejmyre, Sweden. #24 on UDisc's 2026 world list. [Map](https://www.google.com/maps?q=58.913953943505575,15.86784426122904) · [UDisc](https://udisc.com/courses/haefla-bruks-disc-golf-park-haevla-t5x2)
- **The course:** Established 2021, 50 kr a day. Very hilly, through forest and meadow, with longer holes and water in play on the back nine.
- **In the game:** UDisc's "GUL (main course)" layout, par 59. Hole 15's water is from a photo caption. The other two ponds (holes 10 and 16) are guesses, on the back nine.

### 46. Graceland University

- **Where:** The Graceland University campus in Lamoni, Iowa. The first tee is at the top of the hill north of the library parking lot. [Map](https://www.google.com/maps?q=40.616342,-93.929094) · [UDisc](https://udisc.com/courses/graceland-university-deRg) · [PDGA](https://www.pdga.com/course-directory/course/graceland-university)
- **The course:** 18 holes, free, established 1999, concrete tees and Mach II baskets. PDGA: "Long front 9, wide open over rolling hills and around Founders Lake. Back 9 has tight fairways and new growth rough." UDisc calls it mostly flat. Reviews say the back nine is poorly kept, and hole 5 tees off a public street.
- **In the game:** UDisc's "Front 9" layout, its most played: 9 holes, all par 3, 3,645 ft. The full 18's hole lengths aren't public (UDisc needs a login, and no other source lists them), so the back nine isn't in the game. Open campus holes with gentle slopes, drawn by the same script as courses 10-45. The library lot by hole 1's tee, the street behind hole 5's tee, and Founders Lake along holes 6 and 7 are placed from the descriptions; which holes play by the lake is a guess.

### 47. Legion Park

- **Where:** Legion Park, at the back of Thomas Park in Marion, Iowa, along Indian Creek. Hole 1 is at the end of the road into Legion. [Map](https://www.google.com/maps?q=42.028694,-91.611015) · [UDisc](https://udisc.com/courses/legion-park-ecoX) · [PDGA](https://www.pdga.com/course-directory/course/legion-park)
- **The course:** Free, established 1992, designed by Ed Headrick, concrete tees and Mach III/VII baskets. UDisc's 2024 layout mixes the old Legion course with Krumboltz: the first holes play in the open, the rest in Krumboltz's marsh, with tight fairways lined by long grass. Reviews: "a nice walk along Indian Creek", mostly 280-350 ft tunnels with swamp, creek and path out of bounds, and thick rough ("wear long socks"). PDGA: alternating open and wooded holes, water hazards, half flat and half hills.
- **In the game:** UDisc's "Legion 26 Holes July 2026" layout, its most played: par 86, 10,003 ft (UDisc's total says 10,002). Holes 1-4 are open; the road is behind hole 1's tee; from hole 5 on it's mostly wooded tunnels. Indian Creek crosses holes 11, 13 and 26, and marsh lines 9, 18 and 19; those holes are guesses (no source says which ones), and the paths aren't drawn. A lost disc can wash up on a later hole on the same creek or marsh.


## Web version

`discgolf.sodamachine.net/web/` plays the same game with real graphics instead of the 80×25
terminal: the hole from above (tee on the left, or at the bottom on a phone), the flight of a
perfect 100% throw as a dotted line, and the same 3-click meter (THROW button, or SPACE).
Click or drag on the map (or use the arrows) to aim; tap the disc to change it (or 1-9 / D),
and the chips for backhand/forehand/tomahawk, hand and angle. Trees the line runs into (or
passes within half a metre of) turn red. In the trees it switches to the view from your lie, like
the door's POV (V or the chip switches back): Left/Right or drag turns, and it shows the gap, how
far it's clear and where the basket is. Inside 66 ft you putt; the meter marks every 10 ft and the
basket's distance, and Left/Right aims off the basket. V (or the chip) switches the putt between
overhead and from the player, like the door's Putting view; the browser remembers which. On phones the chips and panel sit above
and below the hole, or in a column beside it when the phone is on its side.

It runs the game's own rule files from `bbs/lib/` (`config`, `util`, `discs`, `courses`, `player`,
`holes`, `state`, `flight`, `rules`, `meter`, and the result wording in `shot`/`putt`), so courses,
discs, weights, wind, water and house rules are the same as on the BBS. Not there yet: saved
settings and bag (web players get the default bag), bag editing, relief, mulligans and house
rules settings. Courses with a photo-traced version show a drawn / photo-accurate switch.

## Files

| Path | What it is |
|---|---|
| `bbs/` | The game: the Synchronet door (`discgolf.js`) and its `lib/` files. The web page plays these same files. See [`bbs/README.md`](bbs/README.md). |
| `web/` | The web version (`/web/` on the site): the same game drawn for the browser. `index.html` loads the game's rule files straight from `bbs/lib/` (no copies), `draw.js` draws the hole (a tree crown over every trunk the flight checks), `pov.js` the view from the lie (the door's POV in 3D), `game.js` is the screens, meter, aiming and animation, `style.css` the look. See [Web version](#web-version). |
| `index.html` | The browser version's page: the terminal, the connection settings and the on-screen keys. |
| `styles/` | The page's CSS: `base.css` (colors, fonts), `layout.css` (page layout), `components.css` (terminal, keys, panels). |
| `scripts/` | The emulator, as ES modules (listed below). |
| `vendor/acorn.js` | JavaScript parser the web page uses to run the door script in the browser (acorn 8.12.1, MIT license). |
| `vendor/acorn-LICENSE.txt` | acorn's license. |
| `server.js` | The disc golf service: serves the game files and the BBS door's save API (Node built-ins only). See "The save service". |
| `api/` | The service's routes and database: `players.js` (the save API), `_db.js` (SQLite: players, rate limits), `_names.js` (player name rules and web-name tags), `_helpers.js` (door check, client address), `_rateLimit.js`. |
| `package.json` | `npm start` runs `server.js`. No dependencies. |
| `LICENSE` | MIT license. |
| `deploy/update-discgolf.sh` | The script digiweb runs to publish a push (see "Automatic deploys"). |
| `deploy/ic-discgolf.service`, `deploy/nginx-discgolf.conf` | The service's systemd unit and the nginx change for it, to install once (see "The save service"). |

The emulator in `scripts/`:

| File | What it does |
|---|---|
| `main.js` | Entry point: loads the door, runs the screen and readout loops. |
| `door-loader.js` | Fetches `bbs/discgolf.js` and the `lib/` files it `load()`s, and joins them into one program. |
| `terminal.js` | The caller's screen: an ANSI parser drawing CP437 cells on a canvas. |
| `wire.js` | The simulated connection: delay, jitter, line speed and Nagle's algorithm. |
| `runtime.js` | A stand-in for Synchronet's JavaScript runtime (`console`, `bbs`, `system`, `user`, ...). |
| `transform.js` | Makes the door's blocking calls (`console.getkey()`, `mswait()`) awaitable, and compiles it. |
| `session.js` | Starting, restarting and ending a session, and reporting door errors. |
| `controls.js` | Connection settings, on-screen keys, the phone keyboard and the real keyboard. |
| `dom.js` | `$()`, the page's element lookup. |

## Put it on your web server

There's no build step. Copy the game files (`index.html`, `styles/`, `scripts/`,
`bbs/` and `vendor/`) into any folder your web server serves, for example:

```sh
git clone https://github.com/YOU/ic_discgolf.git
cd ic_discgolf
cp -r index.html styles scripts bbs vendor /var/www/html/discgolf/
```

Then open `https://your-site/discgolf/`.

- Keep the folders together; the page loads its styles, scripts and the door from them.
- The page must be served over http or https. Opening `index.html` straight from disk won't load the game, because browsers block that.
- The page pulls its fonts from Google Fonts. Without internet access it falls back to system fonts and still works.
- The web game is all static files, so GitHub Pages works too: enable Pages for the repo and the game is at `https://YOU.github.io/ic_discgolf/`. Only BBS saving needs the save service.

### Try it on your own computer first

```sh
cd ic_discgolf
npm start
```

Then open http://localhost:3002 in a browser. `npm start` runs `server.js`, which
needs Node 22.13 or newer for its built-in SQLite (or the `sqlite3` module). Any
other static web server works too for the web game.

## Install the door on Synchronet

See [`bbs/README.md`](bbs/README.md#install-on-synchronet): copy `bbs/discgolf.js` and `bbs/lib/` to
your xtrn folder and add it in SCFG with the command line `?discgolf.js`.

### Automatic deploys (digiweb)

Every push to `main` runs `.github/workflows/deploy.yaml`, the same setup as IC
Zombies: it joins Tailscale and SSHes to digiweb with a key that can only run
`sudo update-discgolf.sh`. That script pulls `main` into `/srv/src/ic_discgolf`
and copies just the game and server files (`index.html`, `styles/`, `scripts/`, the
door in `bbs/`, `vendor/`, `server.js`, `api/` and `package.json`) to
`/srv/apps/ic_discgolf`, then restarts the save service. The player database isn't
in that folder (it's `/var/lib/ic-discgolf/saves.db`), so a deploy never touches it. The service serves that folder as
[discgolf.sodamachine.net](https://discgolf.sodamachine.net) behind nginx, and the BBS
door runs from its `bbs/` folder, so one push updates both.

The copy of `update-discgolf.sh` that runs is the one in `/usr/local/bin/`, not
the repo's. When `deploy/update-discgolf.sh` changes, copy it there again.

One-time setup (the full steps are in the digiweb setup guide, "Adding another game"):

1. Clone the repo to `/srv/src/ic_discgolf`, copy `deploy/update-discgolf.sh` to
   `/usr/local/bin/`, make it executable and run it once.
2. Make a new SSH key for this repo, and add its public key to `~deploy/.ssh/authorized_keys`, locked to the script:
   `restrict,command="sudo /usr/local/bin/update-discgolf.sh" ssh-ed25519 AAAA... github-actions discgolf`,
   plus `/etc/sudoers.d/deploy-discgolf` with
   `deploy ALL=(root) NOPASSWD: /usr/local/bin/update-discgolf.sh`.
3. In the GitHub repo's **Settings > Secrets and variables > Actions**, add
   `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET`, `DEPLOY_SSH_KEY` (the new private key)
   and `DEPLOY_KNOWN_HOSTS` (the same values as IC Zombies, except the key).
4. In SCFG, point the door at the published folder: Start-up Directory
   `/srv/apps/ic_discgolf/bbs` (all the settings are in
   [`bbs/README.md`](bbs/README.md#install-on-synchronet)).
5. Set up the save service (next section).

## The save service

`server.js` serves the game files (like IC Zombies' server, it never serves `data/`,
`api/`, `deploy/`, `server.js`, `package.json` or dotfiles) and runs the save API the
BBS door uses. Player settings are in SQLite at `DB_FILE`: `/var/lib/ic-discgolf/saves.db`
on digiweb (set by the systemd unit). Without `DB_FILE` it falls back to
`data/discgolf.db`, which is only for trying it locally. SQLite comes from the `sqlite3`
module if it's installed (Debian:
`sudo apt install node-sqlite3`), otherwise from Node's built-in `node:sqlite`
(Node 22.13+). A database from before house rules gets its `house` column added when the
service starts, and doors from before then can still save.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3002` | Listen port (IC Zombies has 3000) |
| `HOST` | `127.0.0.1` | Listen address; nginx on the same machine forwards to it |
| `DB_FILE` | `data/discgolf.db` (local testing only) | SQLite database path: `/var/lib/ic-discgolf/saves.db` on digiweb |
| `DOOR_KEY` | none | The secret the BBS door sends with every save request. Without it, nothing can be saved. |

**Who can save.** Only the BBS door: `/api/players` requests need the door key
(`X-Door-Key`) and must come straight from the same machine, not through nginx.
Anything else gets the same 404 as a route that doesn't exist, and failed attempts
are rate limited. Web players can't read or change a BBS player's settings, now or
once cross-play adds public game routes.

**One-time setup on digiweb** (after the steps in "Automatic deploys"):

1. Node and SQLite: `sudo apt install nodejs node-sqlite3`.
2. A user for the service:
   `sudo useradd --system --no-create-home --shell /usr/sbin/nologin discgolf`.
   Its database folder, `/var/lib/ic-discgolf`, is created by systemd when the
   service starts (`StateDirectory`, owned by `discgolf`, mode 700).
3. The door key, in two places only root and the BBS can read:
   ```sh
   KEY=$(openssl rand -hex 32)
   echo "DOOR_KEY=$KEY" | sudo tee /etc/ic-discgolf.env >/dev/null && sudo chmod 600 /etc/ic-discgolf.env
   printf '[api]\nurl = http://127.0.0.1:3002\nkey = %s\n' "$KEY" | sudo tee /sbbs/ctrl/discgolf.ini >/dev/null
   sudo chown sbbs /sbbs/ctrl/discgolf.ini && sudo chmod 600 /sbbs/ctrl/discgolf.ini
   ```
   (Use your Synchronet `ctrl` folder and BBS user if they differ.)
4. The service: `sudo cp /srv/src/ic_discgolf/deploy/ic-discgolf.service /etc/systemd/system/`,
   then `sudo systemctl daemon-reload && sudo systemctl enable --now ic-discgolf`.
   Check it with `curl -s http://127.0.0.1:3002/ | head -3`; the log
   (`journalctl -u ic-discgolf`) should say it's using `/var/lib/ic-discgolf/saves.db`.
5. nginx: in the discgolf.sodamachine.net site, replace the `root`/`try_files` lines
   with the `location` block in `deploy/nginx-discgolf.conf` (it must set
   `X-Forwarded-For`), then `sudo nginx -t && sudo systemctl reload nginx`.
6. Copy the new `deploy/update-discgolf.sh` to `/usr/local/bin/` (it publishes the
   server files and restarts the service).
7. Backups: the Atom's weekly `/usr/local/bin/digiweb-backup.sh` (not in any repo)
   backs it up the same way as Studio Boss's database. Add this right after its
   "Same for IC Studio Boss" block:
   ```sh
   # Same for IC Disc Golf (player saves)
   rm -f /root/ic-discgolf-saves.db
   if [ -f /var/lib/ic-discgolf/saves.db ] && command -v sqlite3 >/dev/null; then
       sqlite3 /var/lib/ic-discgolf/saves.db ".backup /root/ic-discgolf-saves.db"
   fi
   ```
   and these lines to its `tar` list:
   ```sh
   /root/ic-discgolf-saves.db \
   /etc/systemd/system/ic-discgolf.service \
   /etc/ic-discgolf.env \
   ```
   `.backup` makes a safe copy while the service is running (a plain `cp` could catch
   the database mid-write). `/sbbs/ctrl/discgolf.ini` is already covered: the backup
   includes all of `/sbbs/ctrl`.

## Editing the game

The discs, courses and tuning constants are in `bbs/lib/`; see
[`bbs/README.md`](bbs/README.md#editing-the-game) for which file holds what.

After editing, refresh the web page to play your changes, and **Restart**
reloads the game. The web page only runs its own copy of the door; to try changes
without touching the server, run the page on your own computer (see "Try it on
your own computer first").

## Known limits

- Course holes are drawn from descriptions, not surveyed (see [Courses](#courses)).
  Turkey Creek has no elevation yet, and the river isn't in play at High Bridge
  (nor the bridge) or Peninsula Park.
- Settings are saved for BBS players only; web players start fresh each visit.
- The scorecard shows the first 8 characters of a player's name.
- No multiplayer, cross-play or tournaments yet.

## Credits

- Disc flight numbers: published by Innova, Discraft, Dynamic Discs and Axiom.
- Hole lengths, pars and course details: UDisc -
  [Turkey Creek](https://udisc.com/courses/turkey-creek-tNSo),
  [Wildcat Bluff](https://udisc.com/courses/wildcat-bluff-I1rO),
  [Eagles Crossing](https://udisc.com/courses/championship-course-at-eagles-crossing-JQQP),
  [Sugar Bottom](https://udisc.com/courses/sugar-bottom-rec-areas-EwqR),
  [High Bridge](https://udisc.com/courses/high-bridge-dgc-fhad),
  [Peninsula Park](https://udisc.com/courses/peninsula-park-jLph),
  [Altmaier Park](https://udisc.com/courses/coralville-disc-golf-altmaier-park-qUWO),
  [Blue Ribbon Pines](https://udisc.com/courses/blue-ribbon-pines-aCxV),
  [Graceland University](https://udisc.com/courses/graceland-university-deRg),
  [Legion Park](https://udisc.com/courses/legion-park-ecoX), and each top 25 course's own link above.
- Legion Park's address, description and directions: [PDGA](https://www.pdga.com/course-directory/course/legion-park).
- Graceland University's address, description and directions: [PDGA](https://www.pdga.com/course-directory/course/graceland-university).
- Blue Ribbon Pines history, holes and reviews:
  [UDisc's article](https://udisc.com/blog/post/worlds-best-disc-golf-courses-6-blue-ribbon-pines),
  [Disc Golf Scene](https://www.discgolfscene.com/courses/Blue_Ribbon_Pines/reviews);
  address: [PDGA](https://www.pdga.com/course-directory/course/blue-ribbon-pines-disc-golf-course).
- Eagles Crossing water and woods: [DG Course Review](https://dgcoursereview.com/courses/eagles-crossing.12414/reviews).
- High Bridge park, parking and the bluff/valley split: [DG Course Review](https://www.dgcoursereview.com/courses/high-bridge-dgc.13426).
- Addresses: Recreation.gov ([Turkey Creek](https://www.recreation.gov/camping/campgrounds/254086),
  [Sugar Bottom](https://www.recreation.gov/camping/campgrounds/254085)),
  [Benton County Conservation](https://mycountyparks.com/County/Benton/Park/Wildcat-Bluff-Recreation-Area.aspx),
  [Eagles Crossing](https://eaglescrossingdiscgolf.com/),
  [PDGA](https://www.pdga.com/node/24943) (Sugar Bottom's winter parking),
  [DG Course Review](https://www.dgcoursereview.com/courses/high-bridge-dgc.13426) (High Bridge),
  [PDGA](https://www.pdga.com/node/26368) (Peninsula Park, and its flood-prone holes),
  [PDGA](https://www.pdga.com/node/247146) (Altmaier Park, and Clear Creek).
- Relief rule: PDGA optional relief (one penalty throw, move back along the line of play;
  house rules can make it free).
- [acorn](https://github.com/acornjs/acorn) JavaScript parser, MIT license.

## License

MIT © 2026 digable — see [LICENSE](LICENSE) for full text.
