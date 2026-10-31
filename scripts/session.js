// A session is one caller running the door: connect() starts it, finish() reports how it ended.
import { $ } from "./dom.js";
import { T, tClear, tLocal } from "./terminal.js";
import { dq, L, send, sendInput, setInputSink, resetLink, linkText } from "./wire.js";
import { makeEnv, ABORT, EXIT } from "./runtime.js";
import { compile, errorLine } from "./transform.js";

let door = { name: "discgolf.js", src: "", where: () => "" };
let sess = { id: 0, env: null, rtt: null, state: "idle" };
export function showErr(msg) { const e = $("err"); e.textContent = msg; e.hidden = !msg; }

export function connect() {
  if (sess.env) sess.env.kill();
  resetLink();
  T.attr = 7; tClear(); T.cursor = true; T.st = 0;
  const s = { id: sess.id + 1, env: null, rtt: null, state: "running" };
  sess = s;
  s.env = makeEnv();
  setInputSink((item) => { if (sess === s && s.env) s.env.deliver(item); });
  showErr("");
  tLocal("Connecting (" + linkText() + ")...\r\n", 8);
  let main;
  try { main = compile(door.src, s.env); }
  catch (e) {
    const where = e.loc ? door.where(e.loc.line, e.loc.column + 1) : "";
    showErr(door.name + ": " + String(e.message || e).replace(/ \(\d+:\d+\)$/, "") + where);
    tLocal("\r\nCan't run " + door.name + ": syntax error" + where + ".\r\n", 12);
    s.state = "ended"; return;
  }
  main().then(() => finish(s, null), (e) => finish(s, e));
}
function finish(s, e) {
  if (e === ABORT || sess !== s) return;
  if (e && e !== EXIT) {
    const ln = errorLine(e);
    const where = ln != null ? door.where(ln) : "";
    showErr(door.name + ": " + (e.message || String(e)) + where);
    window.console.error(e);
    try { s.env.reset(); } catch (x) {}
    send("\r\n");
    dq.push({ at: L.lastArrive + 1, s: "", fn: () => { tLocal("\r\nThe door crashed: " + (e.message || e) + where + "\r\nPress any key to run it again.\r\n", 12); s.state = "ended"; } });
    return;
  }
  try { s.env.reset(); } catch (x) {}
  dq.push({ at: L.lastArrive + 1, s: "", fn: () => { tLocal("\r\nDoor exited. Press any key to run it again.\r\n", 8); if (sess === s) s.state = "ended"; } });
}
export function pressKey(ch) {
  if (sess.state === "ended") { connect(); return; }
  sendInput({ ch }, 1);
}

// ---------- The door script ----------
// The page only ever runs the site's own discgolf.js; there's no way to load another script.
// d comes from loadDoor(): { name, src, lines, files, where(line, col) }
export function setDoor(d) {
  door = d;
  $("scriptName").textContent = d.name;
  $("scriptInfo").textContent = (d.files > 1 ? d.files + " files, " : "") + d.lines.toLocaleString() + " lines";
  connect();
}
// A file dropped on the page would otherwise make the browser open it and leave the game
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());
