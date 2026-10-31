// The simulated connection between the door and the caller: round-trip delay, jitter,
// line speed and Nagle's algorithm. Output waits in dq until the time it would arrive.

// ---------- Settings ----------
export const S = { rtt: 40, jitter: 5, baud: 0, nagle: false };
export const PRESETS = [
  { name: "Local", sub: "same machine", rtt: 0, jitter: 0, baud: 0 },
  { name: "Telnet, near", sub: "40 ms", rtt: 40, jitter: 5, baud: 0 },
  { name: "Telnet, far", sub: "160 ms, jittery", rtt: 160, jitter: 40, baud: 0 },
  { name: "Wi-Fi + far", sub: "220 ms, very jittery", rtt: 220, jitter: 90, baud: 0 },
  { name: "14.4k modem", sub: "120 ms", rtt: 120, jitter: 10, baud: 14400 },
  { name: "2400 baud", sub: "150 ms", rtt: 150, jitter: 10, baud: 2400 }
];

export function linkText() {
  const sp = S.baud ? S.baud.toLocaleString() + " bps" : "telnet";
  return sp + " · " + S.rtt + " ms" + (S.jitter ? " +" + S.jitter : "") + (S.nagle ? " · Nagle" : "");
}

// ---------- The wire ----------
export const dq = [];   // { at, s, fn }: screen output on its way to the caller, in arrival order
const freshLink = () => ({ freeAt: 0, lastArrive: 0, ackAt: 0, held: [], heldTimer: 0, inFree: 0, inLast: 0 });
export const L = freshLink();
export const bytesLog = [], updLog = [];
const cps = () => (S.baud ? S.baud / 10 : 0);
const oneWay = () => S.rtt / 2 + Math.random() * S.jitter;

// A new call: drop anything still on the line.
export function resetLink() {
  dq.length = 0;
  if (L.heldTimer) clearTimeout(L.heldTimer);
  Object.assign(L, freshLink());
}

// When bytes sent at time now arrive at the far end. free/last name the L fields for this
// direction: when the line is next free, and when the last data arrived (TCP keeps order).
function arrival(now, bytes, free, last) {
  const c = cps();
  const start = Math.max(now, L[free]);
  const done = c ? start + (bytes / c) * 1000 : start;
  L[free] = done;
  const at = Math.max(done + oneWay(), L[last]);
  L[last] = at;
  return at;
}
function transmit(s) { dq.push({ at: arrival(performance.now(), s.length, "freeAt", "lastArrive"), s }); }
export function flushHeld() {
  L.heldTimer = 0;
  if (!L.held.length) return;
  const s = L.held.join(""); L.held = [];
  transmit(s);
  L.ackAt = performance.now() + S.rtt + 40; // + delayed ACK
}
export function send(s) {
  if (!s) return;
  bytesLog.push([performance.now(), s.length]);
  if (!S.nagle) { transmit(s); return; }
  const now = performance.now();
  if (now < L.ackAt) {
    L.held.push(s);
    if (!L.heldTimer) L.heldTimer = setTimeout(flushHeld, L.ackAt - now);
    return;
  }
  transmit(s);
  L.ackAt = now + S.rtt + 40;
}

// Keys and replies from the caller go to whichever session was running when they were sent
// (session.js sets it on each connect), so a key sent before a restart never reaches the new one.
let inputSink = null;
export function setInputSink(fn) { inputSink = fn; }
export function sendInput(item, bytes) {
  const now = performance.now(), at = arrival(now, bytes, "inFree", "inLast");
  const sink = inputSink;
  setTimeout(() => { if (sink) sink(item); }, at - now);
}
