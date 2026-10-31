// GET  /api/players/:handle   a BBS player's saved settings ({ saved: false } and 404 if none)
// POST /api/players/:handle   save them: { name, hand, style, level, flightPath, puttView, bag }
//
// Only the BBS door can use these routes (isDoor in _helpers.js: the door key, sent straight
// from this machine). Anything else gets the same 404 as a route that doesn't exist, so web
// players can never read or change a BBS player's settings.

const { db, playerFromRow } = require("./_db");
const { checkRateLimit } = require("./_rateLimit");
const { getIp, isDoor, send, err } = require("./_helpers");
const { MAX_NAME, slugOf } = require("./_names");

const BAG_MAX = 8;        // bbs/lib/config.js
const MAX_DISC_NAME = 30;

// The settings in a POST body, or { error } if they don't make sense
function settingsFrom(b) {
  if (!b || typeof b !== "object") return { error: "Expected a JSON object" };
  if (typeof b.name !== "string" || !b.name || b.name.length > MAX_NAME || /[\x00-\x1f]/.test(b.name)) return { error: "Bad name" };
  if (!["R", "L"].includes(b.hand)) return { error: "Bad hand" };
  if (!["BH", "FH"].includes(b.style)) return { error: "Bad style" };
  if (!["reg", "pro"].includes(b.level)) return { error: "Bad level" };
  if (typeof b.flightPath !== "boolean") return { error: "Bad flightPath" };
  if (!["side", "top", "pov"].includes(b.puttView)) return { error: "Bad puttView" };
  const bag = b.bag;
  if (!Array.isArray(bag) || bag.length < 1 || bag.length > BAG_MAX ||
      bag.some((d) => typeof d !== "string" || !d || d.length > MAX_DISC_NAME) || new Set(bag).size !== bag.length) {
    return { error: "Bad bag" };
  }
  return { name: b.name, hand: b.hand, style: b.style, level: b.level, flightPath: b.flightPath, puttView: b.puttView, bag };
}

module.exports = async function handler(req, res) {
  const ip = getIp(req);
  try {
    if (!isDoor(req)) {
      await checkRateLimit(ip, "players_denied", 30, 3600);   // slows anyone guessing the key
      return err(res, 404, "Not found");
    }
    await checkRateLimit(ip, "players", 600, 60);              // every BBS node shares the door's address

    const handle = req.query.handle;
    if (!/^[a-z0-9_]{1,40}$/.test(handle)) return err(res, 400, "Bad handle");

    if (req.method === "GET") {
      const row = await db.get("SELECT * FROM players WHERE handle = ?", [handle]);
      if (!row) return send(res, 404, { saved: false });
      return send(res, 200, playerFromRow(row));
    }

    if (req.method === "POST") {
      const s = settingsFrom(req.body);
      if (s.error) return err(res, 400, s.error);
      if (slugOf(s.name) !== handle) return err(res, 400, "Name doesn't match the handle");
      const now = Date.now();
      await db.run(
        `INSERT INTO players (handle, name, hand, style, level, flight_path, putt_view, bag, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (handle) DO UPDATE SET
           name = excluded.name, hand = excluded.hand, style = excluded.style, level = excluded.level,
           flight_path = excluded.flight_path, putt_view = excluded.putt_view, bag = excluded.bag,
           updated_at = excluded.updated_at`,
        [handle, s.name, s.hand, s.style, s.level, s.flightPath ? 1 : 0, s.puttView, JSON.stringify(s.bag), now, now]
      );
      return send(res, 200, { saved: true });
    }

    return err(res, 405, "Method not allowed");
  } catch (e) {
    if (e.status === 429) return err(res, 429, e.message, { retryAfter: e.retryAfter });
    console.error(req.method, "/api/players", e);
    return err(res, 500, "Internal server error");
  }
};
