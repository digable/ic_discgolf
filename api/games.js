// Online rooms: the same routes and flow as IC Zombies' (room codes, a lobby, the host starts, every
// player polls every 1.5 s), so web, terminal and BBS players can play one round together.
//
//   POST /api/games                 create a room and join it as host: { displayName, deviceId, course }
//                                   -> { code, hostId, playerId, name }
//   GET  /api/games/:code           poll: { code, status, course, players: [{ name, bbs, gone }], state, now }
//   POST /api/games/:code           push your throw (your turn only): { playerId, me, last } (bbs/lib/room.js)
//   POST /api/games/:code/join      { displayName, deviceId } -> { playerId, name, rejoined, status }
//   POST /api/games/:code/course    host, in the lobby: { hostId, course }
//   POST /api/games/:code/start     host: { hostId, course, holes, rules, winds }
//   POST /api/games/:code/leave     { playerId }
//   POST /api/games/:code/skip      { playerId }: skip whoever's turn it is, if they've taken over 3 minutes
//
// Who throws when, and whether a throw adds up, is decided here with the same rules every player
// runs (room.js), never taken from what a player sends. BBS players are named by their BBS alias:
// only the door (isDoor: its key, straight from this machine) can join under a plain name. Everyone
// else's name is tagged "(web)" (_names.js), so nobody on the web can pass for a BBS player.

const { randomUUID } = require("crypto");
const { db, getSession, expiresFrom } = require("./_db");
const { checkRateLimit } = require("./_rateLimit");
const { getIp, isDoor, send, err } = require("./_helpers");
const { MAX_NAME, slugOf, nameProblem, webName } = require("./_names");
const { houseFrom } = require("./players");
const ROOM = require("../bbs/lib/room");

const MAX_COURSE = 999;          // COURSES indexes (bbs/lib/courses.js has fewer; the clients check theirs)
const MAX_HOLES = 36;
const MAX_STATE_BYTES = 200 * 1024;
const CODE_CHARS = "ACDEFGHJKLMNPQRSTUVWXYZ23456789";   // no 0/O, 1/I/B ambiguity, as IC Zombies
// Each player polls every 1.5 s (40 a minute); a household of 6 on one address is 240
const POLLS_PER_MINUTE = 300;

function generateCode() {
  let code = "";
  for (let i = 0; i < 4; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

// Rate limits by address. Every BBS node reaches the service from this machine, so the door is
// counted per BBS player instead (its name), with the same limits.
async function limit(req, action, max, windowSecs) {
  const who = isDoor(req) ? "door:" + slugOf((req.body && req.body.displayName) || req.query.code || "") : getIp(req);
  await checkRateLimit(who, action, max, windowSecs);
}

// The name and device a joining player plays under, or { error }
function joinerFrom(req, taken) {
  const b = req.body || {};
  const name = typeof b.displayName === "string" ? b.displayName.trim() : "";
  const problem = nameProblem(name);
  if (problem) return { error: problem };
  // a BBS player's seat is their alias (aliases are unique, ignoring case), so the door rejoins it
  if (isDoor(req) && b.bbs) return { name, bbs: true, deviceId: "bbs:" + name.toLowerCase() };
  const dev = typeof b.deviceId === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(b.deviceId) ? b.deviceId : randomUUID();
  return { name: webName(name, taken), bbs: false, deviceId: "web:" + dev, base: name };
}

const courseOk = (c) => Number.isInteger(c) && c >= 0 && c <= MAX_COURSE;

// What every player sees: no ids, devices or the host's secret
function publicView(s) {
  return {
    code: s.code, status: s.status, course: s.course,
    players: s.players.map((p, i) => ({ name: p.name, bbs: !!p.bbs, host: i === 0, gone: !!(s.state && s.state.players[i] && s.state.players[i].gone) })),
    state: s.state,
    now: Date.now()   // the server's clock: the players time a turn by it (a skip after 3 minutes)
  };
}

async function save(q, code, fields) {
  const now = Date.now(), cols = Object.keys(fields);
  await q.run(
    `UPDATE sessions SET ${cols.map((c) => c + " = ?").join(", ")}, last_activity_at = ?, expires_at = ? WHERE code = ?`,
    [...cols.map((c) => fields[c]), now, expiresFrom(now), code]
  );
}

// ---- the routes ----------------------------------------------------------------------------

async function create(req, res) {
  await limit(req, "create_game", 20, 3600);
  const course = (req.body || {}).course;
  if (!courseOk(course)) return err(res, 400, "Bad course");
  const me = joinerFrom(req, []);
  if (me.error) return err(res, 400, me.error);
  const ip = getIp(req), hostId = randomUUID(), playerId = randomUUID();
  const out = await db.transaction(async (q) => {
    const now = Date.now();
    const { active } = await q.get(
      "SELECT COUNT(*) AS active FROM sessions WHERE created_by_ip = ? AND status IN ('lobby', 'playing') AND expires_at > ?", [ip, now]);
    if (Number(active) >= (isDoor(req) ? 60 : 10)) return { status: 429, error: "Too many open rooms from here" };
    let code = null;
    for (let i = 0; i < 8 && !code; i++) {
      const c = generateCode();
      if (!(await q.get("SELECT 1 FROM sessions WHERE code = ?", [c]))) code = c;
    }
    if (!code) return { status: 500, error: "Couldn't find a free room code: try again" };
    const players = [{ id: playerId, name: me.name, bbs: me.bbs, deviceId: me.deviceId }];
    await q.run(
      `INSERT INTO sessions (code, host_id, created_by_ip, status, players, course, created_at, last_activity_at, expires_at)
       VALUES (?, ?, ?, 'lobby', ?, ?, ?, ?, ?)`,
      [code, hostId, ip, JSON.stringify(players), course, now, now, expiresFrom(now)]);
    return { code };
  });
  if (out.error) return err(res, out.status, out.error);
  return send(res, 201, { code: out.code, hostId, playerId, name: me.name });
}

async function poll(req, res, code) {
  await limit(req, "poll", POLLS_PER_MINUTE, 60);
  const s = await getSession(code);
  if (!s) return err(res, 404, "No room with that code");
  return send(res, 200, publicView(s));
}

async function join(req, res, code) {
  await limit(req, "join", 50, 3600);
  const out = await db.transaction(async (q) => {
    const s = await getSession(code, q);
    if (!s) return { status: 404, error: "No room with that code" };
    if (s.status === "done") return { status: 409, error: "That round is over" };
    const me = joinerFrom(req, s.players.map((p) => p.name));
    if (me.error) return { status: 400, error: me.error };
    // Back in the same room: the same seat, whenever (as IC Zombies' invite links)
    const slot = s.players.findIndex((p) => p.deviceId === me.deviceId);
    if (slot >= 0) {
      if (s.state && s.state.players[slot].gone) {
        ROOM.roomRejoin(s.state, slot, Date.now());
        await save(q, code, { state: JSON.stringify(s.state) });
      }
      return { body: { playerId: s.players[slot].id, name: s.players[slot].name, rejoined: true, status: s.status } };
    }
    if (s.status !== "lobby") return { status: 409, error: "That round has started: ask the host for a new room" };
    if (s.players.length >= ROOM.ROOM_MAX_PLAYERS) return { status: 409, error: "The room is full (" + ROOM.ROOM_MAX_PLAYERS + " players)" };
    const playerId = randomUUID();
    s.players.push({ id: playerId, name: me.name, bbs: me.bbs, deviceId: me.deviceId });
    await save(q, code, { players: JSON.stringify(s.players) });
    return { body: { playerId, name: me.name, rejoined: false, status: s.status } };
  });
  if (out.error) return err(res, out.status, out.error);
  return send(res, 200, out.body);
}

async function setCourse(req, res, code) {
  await limit(req, "course", 120, 3600);
  const { hostId, course } = req.body || {};
  if (!courseOk(course)) return err(res, 400, "Bad course");
  const out = await db.transaction(async (q) => {
    const s = await getSession(code, q);
    if (!s) return { status: 404, error: "No room with that code" };
    if (s.hostId !== hostId) return { status: 403, error: "Only the host can pick the course" };
    if (s.status !== "lobby") return { status: 409, error: "The round has started" };
    await save(q, code, { course });
    return {};
  });
  if (out.error) return err(res, out.status, out.error);
  return send(res, 200, { ok: true });
}

// The winds the host rolled for each hole, checked
function windsFrom(w, holes) {
  if (!Array.isArray(w) || w.length !== holes) return null;
  const out = [];
  for (const x of w) {
    if (!x || !Number.isInteger(x.mph) || x.mph < 0 || x.mph > 60 || typeof x.to !== "string" || !/^[NSEW]{1,2}$/.test(x.to) ||
        !Number.isFinite(x.x) || !Number.isFinite(x.y) || Math.abs(x.x) > 30 || Math.abs(x.y) > 30) return null;
    out.push({ mph: x.mph, to: x.to, x: x.x, y: x.y });
  }
  return out;
}

async function start(req, res, code) {
  await limit(req, "start", 60, 3600);
  const b = req.body || {};
  if (!courseOk(b.course)) return err(res, 400, "Bad course");
  if (!Number.isInteger(b.holes) || b.holes < 1 || b.holes > MAX_HOLES) return err(res, 400, "Bad hole count");
  const rules = houseFrom(b.rules);
  if (rules.error || !Object.keys(rules).length) return err(res, 400, "Bad house rules");
  const winds = windsFrom(b.winds, b.holes);
  if (!winds) return err(res, 400, "Bad winds");
  const out = await db.transaction(async (q) => {
    const s = await getSession(code, q);
    if (!s) return { status: 404, error: "No room with that code" };
    if (s.hostId !== b.hostId) return { status: 403, error: "Only the host can start the round" };
    if (s.status !== "lobby") return { status: 409, error: "The round has already started" };
    const st = ROOM.roomNewState(b.course, b.holes, rules, winds, s.players.map((p) => ({ name: p.name, bbs: p.bbs })), Date.now());
    await save(q, code, { status: "playing", course: b.course, state: JSON.stringify(st) });
    return {};
  });
  if (out.error) return err(res, out.status, out.error);
  return send(res, 200, { ok: true });
}

async function push(req, res, code) {
  await limit(req, "push", 60, 60);
  const { playerId, me, last } = req.body || {};
  if (!playerId) return err(res, 400, "playerId is required");
  const out = await db.transaction(async (q) => {
    const s = await getSession(code, q);
    if (!s) return { status: 404, error: "No room with that code" };
    if (s.status !== "playing" || !s.state) return { status: 409, error: "The round isn't being played" };
    const slot = s.players.findIndex((p) => p.id === playerId);
    if (slot < 0) return { status: 403, error: "You're not in this room" };
    const why = ROOM.roomApply(s.state, slot, me, last, Date.now());
    if (why) return { status: 409, error: why };
    const json = JSON.stringify(s.state);
    if (Buffer.byteLength(json) > MAX_STATE_BYTES) return { status: 413, error: "Room state too large" };
    await save(q, code, { state: json, status: s.state.over ? "done" : "playing" });
    return { body: { ok: true, state: s.state, now: Date.now() } };
  });
  if (out.error) return err(res, out.status, out.error);
  return send(res, 200, out.body);
}

async function leave(req, res, code) {
  await limit(req, "leave", 60, 3600);
  const { playerId } = req.body || {};
  const out = await db.transaction(async (q) => {
    const s = await getSession(code, q);
    if (!s) return {};
    const slot = s.players.findIndex((p) => p.id === playerId);
    if (slot < 0 || s.status === "done") return {};
    if (s.status === "lobby") {
      // the host leaving closes the lobby; anyone else just gives up their seat
      if (slot === 0) await save(q, code, { status: "done" });
      else { s.players.splice(slot, 1); await save(q, code, { players: JSON.stringify(s.players) }); }
      return {};
    }
    ROOM.roomLeave(s.state, slot, Date.now());
    await save(q, code, { state: JSON.stringify(s.state), status: s.state.over ? "done" : "playing" });
    return {};
  });
  if (out.error) return err(res, out.status, out.error);
  return send(res, 200, { ok: true });
}

async function skip(req, res, code) {
  await limit(req, "skip", 30, 3600);
  const { playerId } = req.body || {};
  const out = await db.transaction(async (q) => {
    const s = await getSession(code, q);
    if (!s || s.status !== "playing" || !s.state) return { status: 409, error: "The round isn't being played" };
    const slot = s.players.findIndex((p) => p.id === playerId);
    if (slot < 0) return { status: 403, error: "You're not in this room" };
    const st = s.state;
    if (st.turn === slot || st.turn < 0) return { status: 409, error: "It's your turn" };
    const waited = Date.now() - st.turnAt;
    if (waited < ROOM.ROOM_SKIP_MS) return { status: 409, error: "Give them " + Math.ceil((ROOM.ROOM_SKIP_MS - waited) / 1000) + " more seconds" };
    ROOM.roomLeave(st, st.turn, Date.now());
    await save(q, code, { state: JSON.stringify(st), status: st.over ? "done" : "playing" });
    return {};
  });
  if (out.error) return err(res, out.status, out.error);
  return send(res, 200, { ok: true });
}

module.exports = async function handler(req, res) {
  const code = String(req.query.code || "").toUpperCase(), action = req.query.action || "";
  try {
    if (!code) {
      if (req.method !== "POST") return err(res, 405, "Method not allowed");
      return await create(req, res);
    }
    if (!/^[A-Z0-9]{4}$/.test(code)) return err(res, 404, "No room with that code");
    if (!action && req.method === "GET") return await poll(req, res, code);
    if (req.method !== "POST") return err(res, 405, "Method not allowed");
    if (!action) return await push(req, res, code);
    if (action === "join") return await join(req, res, code);
    if (action === "course") return await setCourse(req, res, code);
    if (action === "start") return await start(req, res, code);
    if (action === "leave") return await leave(req, res, code);
    if (action === "skip") return await skip(req, res, code);
    return err(res, 404, "Not found");
  } catch (e) {
    if (e.status === 429) return err(res, 429, e.message, { retryAfter: e.retryAfter });
    console.error(req.method, "/api/games", code, action, e);
    return err(res, 500, "Internal server error");
  }
};
module.exports.MAX_NAME = MAX_NAME;
