// A stand-in for the parts of Synchronet's JavaScript runtime a door uses: console, bbs,
// system, user, js and the global functions, writing to the wire and reading the caller's keys.
import { send } from "./wire.js";
import { COLS, ROWS } from "./terminal.js";

// Thrown into the door to stop it: ABORT when the session is killed, EXIT when the door calls exit().
export const ABORT = { abort: true }, EXIT = { exit: true };

export const K = { K_NONE: 0, K_UPPER: 1 << 0, K_UPRLWR: 1 << 1, K_NUMBER: 1 << 2, K_WRAP: 1 << 3, K_MSG: 1 << 4, K_SPIN: 1 << 5,
  K_LINE: 1 << 6, K_EDIT: 1 << 7, K_CHAT: 1 << 8, K_NOCRLF: 1 << 9, K_ALPHA: 1 << 10, K_GETSTR: 1 << 11, K_LOWPRIO: 1 << 12,
  K_NOEXASC: 1 << 13, K_E71DETECT: 1 << 14, K_AUTODEL: 1 << 15, K_COLD: 1 << 16, K_NOECHO: 1 << 17, K_TAB: 1 << 18,
  K_LEFTEXIT: 1 << 19, K_USEOFFSET: 1 << 20, K_NOSPIN: 1 << 21, K_ANSI_CPR: 1 << 22, K_TRIM: 1 << 23,
  KEY_UP: "\x1e", KEY_DOWN: "\x0a", KEY_LEFT: "\x1d", KEY_RIGHT: "\x06", KEY_HOME: "\x02", KEY_END: "\x05",
  BLACK: 0, RED: 1, GREEN: 2, BROWN: 3, BLUE: 4, MAGENTA: 5, CYAN: 6, LIGHTGRAY: 7, DARKGRAY: 8, LIGHTRED: 9, LIGHTGREEN: 10, YELLOW: 11, LIGHTBLUE: 12, LIGHTMAGENTA: 13, LIGHTCYAN: 14, WHITE: 15, HIGH: 8, BLINK: 0x80,
  BG_BLACK: 0, BG_RED: 0x10, BG_GREEN: 0x20, BG_BROWN: 0x30, BG_BLUE: 0x40, BG_MAGENTA: 0x50, BG_CYAN: 0x60, BG_LIGHTGRAY: 0x70 };

function sgr(from, to) {
  const p = []; let f = from;
  if (f < 0 || ((f & 8) && !(to & 8)) || (((f >> 4) & 7) && !((to >> 4) & 7))) { p.push(0); f = 7; }
  if (!(f & 8) && (to & 8)) p.push(1);
  if ((f & 7) !== (to & 7)) p.push(30 + (to & 7));
  if (((f >> 4) & 7) !== ((to >> 4) & 7)) p.push(40 + ((to >> 4) & 7));
  return p.length ? "\x1b[" + p.join(";") + "m" : "";
}
const stripCtrlA = (s) => String(s).replace(/\x01./g, "");

function cfmt(fmt) {
  const args = Array.prototype.slice.call(arguments, 1); let ai = 0;
  return String(fmt).replace(/%([-+ 0#]*)(\*|\d+)?(?:\.(\d+))?([sdiufxXcoeg%])/g, (m, fl, w, pr, t) => {
    if (t === "%") return "%";
    if (w === "*") w = args[ai++];
    let v = args[ai++], s;
    switch (t) {
      case "s": s = String(v); if (pr != null) s = s.slice(0, +pr); break;
      case "d": case "i": case "u": s = String(Math.trunc(Number(v)) || 0); break;
      case "f": s = Number(v).toFixed(pr != null ? +pr : 6); break;
      case "e": s = Number(v).toExponential(pr != null ? +pr : 6); break;
      case "g": s = String(Number(v)); break;
      case "x": s = (Number(v) >>> 0).toString(16); break;
      case "X": s = (Number(v) >>> 0).toString(16).toUpperCase(); break;
      case "o": s = (Number(v) >>> 0).toString(8); break;
      case "c": s = typeof v === "number" ? String.fromCharCode(v) : String(v).charAt(0); break;
    }
    if (fl.indexOf("+") >= 0 && /[dif]/.test(t) && Number(v) >= 0) s = "+" + s;
    const width = w ? +w : 0;
    if (s.length < width) {
      if (fl.indexOf("-") >= 0) s = s + " ".repeat(width - s.length);
      else if (fl.indexOf("0") >= 0 && /[diufxX]/.test(t)) s = (s[0] === "-" ? "-" + "0".repeat(width - s.length) + s.slice(1) : "0".repeat(width - s.length) + s);
      else s = " ".repeat(width - s.length) + s;
    }
    return s;
  });
}

export function makeEnv() {
  const st = { dead: false, keys: [], replies: [], waiter: null, rwaiter: null, pend: 7, sentA: 7 };
  const sleep = (ms) => new Promise((res, rej) => setTimeout(() => (st.dead ? rej(ABORT) : res()), Math.max(0, ms)));
  function out(s) { if (st.dead) throw ABORT; send(s); }
  function flushAttr() { if (st.pend !== st.sentA) { out(sgr(st.sentA, st.pend)); st.sentA = st.pend; } }
  function text(s) { if (s) { flushAttr(); out(s); } }
  function ctrl(k) {
    const lk = k.toLowerCase(), fg = st.pend & 7, br = st.pend & 8, bg = st.pend & 0x70;
    const ci = "krgybmcw".indexOf(lk);
    if (lk === "n") st.pend = 7;
    else if (lk === "h") st.pend = st.pend | 8;
    else if (lk === "-" || lk === "_") st.pend = 7;
    else if (ci >= 0) st.pend = ci | br | bg;
    else if (k >= "0" && k <= "7") st.pend = fg | br | ((+k) << 4);
    else if (lk === "l") { out("\x1b[2J\x1b[H"); }
    else if (k === ">") out("\x1b[K");
    else if (k === "[") out("\r");
    else if (k === "]") out("\n");
  }
  function print(s) {
    s = String(s); let buf = "";
    for (let i = 0; i < s.length; i++) {
      if (s[i] === "\x01" && i + 1 < s.length) { text(buf); buf = ""; ctrl(s[++i]); continue; }
      buf += s[i];
    }
    text(buf);
  }
  function wait(queue, slot, ms) {
    if (st.dead) return Promise.reject(ABORT);
    if (st[queue].length) return Promise.resolve(st[queue].shift());
    return new Promise((res, rej) => {
      let to = null;
      st[slot] = () => { if (to) clearTimeout(to); st[slot] = null; if (st.dead) rej(ABORT); else res(st[queue].shift()); };
      if (ms != null) to = setTimeout(() => { st[slot] = null; st.dead ? rej(ABORT) : res(null); }, Math.max(0, ms));
    });
  }
  const keyOf = (m, mode) => { let k = m.ch; if (mode & K.K_UPPER) k = k.toUpperCase(); return k; };
  let lastYield = performance.now();

  const con = {
    get screen_columns() { return COLS; }, get screen_rows() { return ROWS; },
    get attributes() { return st.pend; }, set attributes(v) { st.pend = Number(v) & 0x7f; },
    aborted: false, line_counter: 0, ctrlkey_passthru: 0, autoterm: 1, terminal: "ANSI",
    print, putmsg: (s) => print(s), write: (s) => { s = String(s); if (/\x1b\[[0-9;]*m/.test(s)) st.sentA = -1; out(s); },
    writeln: (s) => print((s == null ? "" : s) + "\r\n"), crlf: () => out("\r\n"),
    center: (s) => { const n = stripCtrlA(s).length; print(" ".repeat(Math.max(0, Math.floor((COLS - n) / 2))) + s + "\r\n"); },
    strlen: (s) => stripCtrlA(s).length,
    gotoxy: (x, y) => { if (typeof x === "object" && x) { y = x.y; x = x.x; } out("\x1b[" + y + ";" + x + "H"); },
    home: () => out("\x1b[H"), up: (n) => out("\x1b[" + (n || 1) + "A"), down: (n) => out("\x1b[" + (n || 1) + "B"),
    right: (n) => out("\x1b[" + (n || 1) + "C"), left: (n) => out("\x1b[" + (n || 1) + "D"),
    cleartoeol: (a) => { if (a != null) st.pend = a; flushAttr(); out("\x1b[K"); },
    clear: (a) => { if (a != null) st.pend = a; flushAttr(); out("\x1b[2J\x1b[H"); },
    beep: () => out("\x07"), flush: () => {}, clearkeybuffer: () => { st.keys.length = 0; },
    async getkey(mode) { const m = await wait("keys", "waiter", null); return keyOf(m, mode || 0); },
    async inkey(mode, ms) {
      const m = await wait("keys", "waiter", ms || 0);
      if (!m) { if (performance.now() - lastYield > 30) { lastYield = performance.now(); await sleep(0); } return ""; }
      return keyOf(m, mode || 0);
    },
    async getxy() { out("\x1b[6n"); return await wait("replies", "rwaiter", 1000); },
    async getstr(def, max, mode) {
      if (typeof def === "number") { mode = max; max = def; def = ""; }
      max = max || 80; let s = def ? String(def) : ""; if (s) print(s);
      for (;;) {
        const m = await wait("keys", "waiter", null); let k = m.ch;
        if (k === "\r") { if (!((mode || 0) & K.K_NOCRLF)) out("\r\n"); return s; }
        if (k === "\b" || k === "\x7f") { if (s.length) { s = s.slice(0, -1); out("\b \b"); } continue; }
        if (k < " " || s.length >= max) continue;
        if ((mode || 0) & K.K_UPPER) k = k.toUpperCase();
        s += k; out(k);
      }
    },
    async getnum(max) { const s = await con.getstr(String(max || 0).length || 5, K.K_NUMBER); const n = parseInt(s, 10); return isNaN(n) ? -1 : n; },
    async pause() { print("\x01n\x01h[Hit a key]"); await wait("keys", "waiter", null); out("\r\x1b[K"); },
    yesno: async (q) => ask(q, "Y"), noyes: async (q) => ask(q, "N")
  };
  // yesno/noyes: def is the answer ENTER gives; true when the answer is def
  async function ask(q, def) {
    print("\x01n\x01h" + q + (def === "Y" ? "? [Y/n] " : "? [y/N] "));
    for (;;) {
      const m = await wait("keys", "waiter", null), k = m.ch === "\r" ? def : m.ch.toUpperCase();
      if (k === "Y" || k === "N") { out(k === "Y" ? "Yes\r\n" : "No\r\n"); return k === def; }
    }
  }
  const bbs = { get online() { return !st.dead; }, sys_status: 0, node_num: 1, get time_left() { return 3600; }, nodesync() {}, log_str() {} };
  const system = { get timer() { return performance.now() / 1000; }, name: "Emulator BBS", operator: "Sysop", node_list: [], get secondary_timer() { return performance.now() / 1000; } };
  const user = { alias: "Tester", name: "Test Caller", number: 1, handle: "Tester", security: { level: 50 }, settings: 0 };
  const js = { get terminated() { return st.dead; }, auto_terminate: true, exec_dir: "./", on_exit() {}, global: null, gc() {} };

  return {
    st,
    deliver(item) {
      if (item.reply) { st.replies.push(item.reply); if (st.rwaiter) st.rwaiter(); return; }
      st.keys.push(item); if (st.waiter) st.waiter();
    },
    kill() { st.dead = true; if (st.waiter) st.waiter(); if (st.rwaiter) st.rwaiter(); },
    reset() { out("\x1b[0m\x1b[?25h"); st.sentA = 7; },
    globals: Object.assign({}, K, {
      console: con, bbs, system, user, js, argv: [], client: { protocol: "Telnet", socket: {} }, server: { version: "emulated" },
      format: cfmt, printf: (...a) => print(cfmt(...a)), print: (s) => print(String(s) + "\r\n"), write: (s) => print(s), writeln: (s) => print((s == null ? "" : s) + "\r\n"),
      log: (...a) => window.console.log("[door]", ...a), alert: (s) => print("\x01n\x01h\x01r" + s + "\x01n\r\n"),
      mswait: async (ms) => sleep(ms), sleep: async (ms) => sleep(ms),
      require: () => ({}), load: () => ({}), exit: () => { throw EXIT; },
      ascii: (v) => (typeof v === "number" ? String.fromCharCode(v) : String(v).charCodeAt(0)),
      strip_ctrl: stripCtrlA, truncsp: (s) => String(s).replace(/\s+$/, ""), random: (n) => Math.floor(Math.random() * n),
      time: () => Math.floor(Date.now() / 1000), file_exists: () => false
    })
  };
}
