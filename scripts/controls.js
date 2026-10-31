// The page's controls: connection settings, the on-screen keys, the phone keyboard and the real keyboard.
import { $ } from "./dom.js";
import { S, PRESETS, linkText, flushHeld } from "./wire.js";
import { K } from "./runtime.js";
import { connect, pressKey } from "./session.js";

// ---------- Connection settings ----------
export function syncOutputs() {
  $("rttOut").textContent = S.rtt + " ms";
  $("jitterOut").textContent = S.jitter ? "0–" + S.jitter + " ms" : "none";
  $("linkLabel").textContent = linkText();
  $("rCap").textContent = S.baud ? (S.baud / 10).toLocaleString() + " bytes/sec" : "unlimited";
  document.querySelectorAll("#presets button").forEach((b, i) => {
    const p = PRESETS[i];
    b.setAttribute("aria-pressed", String(p.rtt === S.rtt && p.jitter === S.jitter && p.baud === S.baud));
  });
}
PRESETS.forEach((p) => {
  const b = document.createElement("button");
  b.type = "button"; b.innerHTML = p.name + "<small>" + p.sub + "</small>";
  b.addEventListener("click", () => {
    Object.assign(S, { rtt: p.rtt, jitter: p.jitter, baud: p.baud });
    $("rtt").value = p.rtt; $("jitter").value = p.jitter; $("baud").value = String(p.baud);
    syncOutputs(); connect(); b.blur();
  });
  $("presets").appendChild(b);
});
$("rtt").addEventListener("input", (e) => { S.rtt = +e.target.value; syncOutputs(); });
$("jitter").addEventListener("input", (e) => { S.jitter = +e.target.value; syncOutputs(); });
$("baud").addEventListener("change", (e) => { S.baud = +e.target.value; syncOutputs(); e.target.blur(); });
$("nagle").addEventListener("change", (e) => { S.nagle = e.target.checked; if (!S.nagle) flushHeld(); syncOutputs(); });
$("reconnect").addEventListener("click", (e) => { connect(); e.currentTarget.blur(); });

// ---------- Keys ----------
function bindKey(id, ch) {
  const b = $(id);
  b.addEventListener("pointerdown", (e) => { e.preventDefault(); pressKey(ch); });
  b.addEventListener("click", (e) => { if (e.detail === 0) pressKey(ch); });
}
bindKey("spaceBtn", " "); bindKey("qBtn", "q"); bindKey("enterBtn", "\r");
bindKey("kLeft", K.KEY_LEFT); bindKey("kUp", K.KEY_UP); bindKey("kDown", K.KEY_DOWN); bindKey("kRight", K.KEY_RIGHT);
bindKey("kD", "d"); bindKey("kT", "t"); bindKey("kH", "h"); bindKey("kA", "a"); bindKey("kS", "s");

// abc: bring up the phone's keyboard. Letters arrive as "input" events (Android keyboards often
// send keydown with key "Unidentified"), so they're read from the input and it's cleared each time.
// Enter, Backspace and arrows still come through keydown below.
const kbIn = $("kbIn"), kbBtn = $("kbBtn");
kbBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (document.activeElement === kbIn) kbIn.blur(); else kbIn.focus({ preventScroll: true });
});
kbBtn.addEventListener("click", (e) => { if (e.detail === 0) kbIn.focus({ preventScroll: true }); });
// Keyboard up: hide the other keys and move the terminal to the top of what's still visible.
// Keyboard down: put everything back.
const vv = window.visualViewport;
let kbShown = false, fullH = 0;
function screenToTop() {
  const top = $("bezel").getBoundingClientRect().top + window.scrollY - 8;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}
kbIn.addEventListener("focus", () => {
  kbBtn.setAttribute("aria-pressed", "true");
  kbBtn.textContent = "hide keyboard";
  document.body.classList.add("kb-open");
  kbShown = false; fullH = vv ? vv.height : window.innerHeight;
  screenToTop();
});
kbIn.addEventListener("blur", () => {
  kbBtn.setAttribute("aria-pressed", "false");
  kbBtn.textContent = "abc";
  document.body.classList.remove("kb-open");
});
if (vv) vv.addEventListener("resize", () => {
  if (document.activeElement !== kbIn) return;
  if (vv.height < fullH * 0.8) { kbShown = true; screenToTop(); }      // keyboard came up
  else if (kbShown && vv.height > fullH * 0.9) kbIn.blur();           // closed with the phone's back/down key
});
kbIn.addEventListener("beforeinput", (e) => {
  if (e.inputType === "deleteContentBackward") { e.preventDefault(); pressKey("\b"); }
  else if (e.inputType === "insertLineBreak") { e.preventDefault(); pressKey("\r"); }
});
kbIn.addEventListener("input", () => {
  const v = kbIn.value;
  kbIn.value = "";
  for (const ch of v) pressKey(ch === "\n" ? "\r" : ch);
});
// Tapping the screen on a touch device opens the keyboard too.
$("screen").addEventListener("click", () => { if (matchMedia("(pointer: coarse)").matches) kbIn.focus({ preventScroll: true }); });

const SPECIAL = { Enter: "\r", Backspace: "\b", Escape: "\x1b", Tab: "\t", ArrowUp: K.KEY_UP, ArrowDown: K.KEY_DOWN, ArrowLeft: K.KEY_LEFT, ArrowRight: K.KEY_RIGHT };
window.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const tg = e.target, tag = tg.tagName;
  let ch = e.key.length === 1 ? e.key : SPECIAL[e.key];
  if (ch == null) return;
  // In the abc input, letters come through its "input" event; only special keys are handled here.
  if (tg === kbIn && e.key.length === 1) return;
  if (tag === "SELECT" && ch !== " ") return;
  if (tag === "INPUT" && tg.type === "range" && /^Arrow/.test(e.key)) return;
  if ((tag === "BUTTON" || tag === "LABEL") && e.key === "Enter") return;
  if (e.key === "Tab") return;
  e.preventDefault();
  if (e.repeat && !/^Arrow/.test(e.key)) return;   // holding an arrow keeps aiming
  pressKey(ch);
});
window.addEventListener("keyup", (e) => { if (e.key === " ") e.preventDefault(); });
