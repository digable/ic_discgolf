// Shared request/response helpers

const { timingSafeEqual } = require("crypto");

const isLoopback = (addr) => {
  const ip = addr && addr.startsWith("::ffff:") ? addr.slice(7) : addr;
  return ip === "::1" || (!!ip && ip.startsWith("127."));
};

// X-Forwarded-For is only honoured when the request arrives from a reverse proxy on this
// machine or a private network (loopback, RFC 1918, Tailscale's 100.64.0.0/10). A client
// connecting directly could otherwise put any address in the header and dodge rate limits.
function isTrustedProxy(addr) {
  if (!addr) return false;
  const ip = addr.startsWith("::ffff:") ? addr.slice(7) : addr;
  if (isLoopback(ip)) return true;
  if (ip.startsWith("10.") || ip.startsWith("192.168.")) return true;
  const [a, b] = ip.split(".").map(Number);
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return /^f[cd]/i.test(ip); // IPv6 unique local
}

function getIp(req) {
  const peer = req.socket?.remoteAddress;
  const forwarded = isTrustedProxy(peer) ? req.headers["x-forwarded-for"]?.split(",")[0].trim() : null;
  return forwarded || peer || "unknown";
}

// True for a request from the BBS door: it connected straight from this machine (not through
// nginx, which always adds X-Forwarded-For) and sent the door key the service was started with.
function isDoor(req) {
  const key = process.env.DOOR_KEY || "";
  if (!key) return false;
  if (!isLoopback(req.socket?.remoteAddress)) return false;
  if (req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || req.headers.forwarded) return false;
  const given = Buffer.from(String(req.headers["x-door-key"] || ""));
  const want = Buffer.from(key);
  return given.length === want.length && timingSafeEqual(given, want);
}

function send(res, status, body) {
  res.status(status).json(body);
}

function err(res, status, message, extra = {}) {
  res.status(status).json({ error: message, ...extra });
}

module.exports = { getIp, isDoor, send, err };
