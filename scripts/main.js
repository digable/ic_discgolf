// The page's entry point: the screen and readout loops, then load the door and connect.
import { $ } from "./dom.js";
import { T, CH, tFeed, tLocal, render, repaintAll } from "./terminal.js";
import { S, L, dq, bytesLog, updLog } from "./wire.js";
import { probeOffset } from "./transform.js";
import { setDoor, showErr } from "./session.js";
import { syncOutputs } from "./controls.js";
import { loadDoor } from "./door-loader.js";

// The door the page plays: bbs/discgolf.js, the same files the BBS runs, so editing them
// updates the web version too.
const DOOR = "bbs/discgolf.js";

// ---------- Loops ----------
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let lastBlink = 0;
function frame() {
  const now = performance.now();
  let changed = false;
  while (dq.length && dq[0].at <= now) { const d = dq.shift(); if (d.s) tFeed(d.s); if (d.fn) d.fn(); changed = true; }
  if (changed) updLog.push(now);
  if (!reduceMotion && now - lastBlink > 530) { lastBlink = now; T.blink = !T.blink; if (T.cursor) T.dirty = true; }
  if (T.dirty) { render(); T.dirty = false; }
  requestAnimationFrame(frame);
}
setInterval(() => {
  const now = performance.now();
  while (bytesLog.length && bytesLog[0][0] < now - 1000) bytesLog.shift();
  while (updLog.length && updLog[0] < now - 1000) updLog.shift();
  const bps = bytesLog.reduce((a, b) => a + b[1], 0);
  $("rBytes").textContent = bps.toLocaleString();
  $("rBytes").className = S.baud && bps > S.baud / 10 ? "c-bad" : "";
  $("rFps").textContent = String(updLog.length);
  const backlog = Math.max(0, L.freeAt - now);
  $("rBacklog").textContent = Math.round(backlog).toLocaleString() + " ms";
  $("rBacklog").className = backlog > 250 ? "c-bad" : backlog > 50 ? "c-warn" : "";
}, 250);

probeOffset();
syncOutputs();
if (document.fonts && document.fonts.load) document.fonts.load(CH + 'px "VT323"').then(repaintAll, repaintAll);
requestAnimationFrame(frame);

if (typeof acorn === "undefined") {
  showErr("The script parser didn't load, so the door can't run. Check your connection and reload the page.");
  tLocal("Script parser failed to load.\r\n", 12);
} else {
  tLocal("Loading discgolf.js...\r\n", 8);
  loadDoor(DOOR)
    .then((d) => {
      // Forget any script an older version of this page saved from "Load a .js file"
      try { localStorage.removeItem("dg-door"); } catch (e) {}
      setDoor(d);
    })
    .catch((e) => {
      showErr("Couldn't load the door (" + e.message + "). The page has to be served by a web server, not opened as a file.");
      tLocal("Couldn't load discgolf.js.\r\n", 12);
    });
}
