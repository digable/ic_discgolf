// Checks that the web page (web/index.html) loads the door's rule files in an order that works:
//   node tools/check-web-scripts.js      (or: npm run check)
//
// The web page lists bbs/lib files by hand, in the order bbs/discgolf.js loads them. If that list falls
// behind (a file it loads now needs one it skips, or the order changes), the page breaks with no
// warning. This checks:
//   1. every script the page names exists;
//   2. the bbs/lib files it loads are in the door's order (bbs/discgolf.js's load lines);
//   3. the page's scripts, run in its order (all but game.js, which needs a real page), don't stop on
//      a name that isn't defined yet.
// It prints what's wrong and exits 1, or prints "ok".
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const problems = [];
let pageName = "web/index.html";

const doorOrder = [...read("bbs/discgolf.js").matchAll(/load\(js\.exec_dir \+ "lib\/([\w-]+\.js)"\)/g)].map((m) => m[1]);
const page = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, "web/index.html");   // another page to check (a test)
if (process.argv[2]) pageName = path.basename(page);
const pageScripts = [...fs.readFileSync(page, "utf8").matchAll(/<script src="([^"]+)"/g)].map((m) => path.posix.join("web", m[1]));

// 1. every script exists
for (const s of pageScripts) if (!fs.existsSync(path.join(ROOT, s))) problems.push(`${pageName} loads ${s}, which isn't there`);

// 2. the door's files are in the door's order
const libs = pageScripts.filter((s) => s.startsWith("bbs/lib/")).map((s) => path.posix.basename(s));
let last = -1;
for (const f of libs) {
  const at = doorOrder.indexOf(f);
  if (at < 0) problems.push(`${pageName} loads bbs/lib/${f}, which bbs/discgolf.js doesn't load`);
  else if (at < last) problems.push(`${pageName} loads bbs/lib/${f} after ${doorOrder[last]}; the door loads it before`);
  else last = at;
}

// 3. run them in order: what each file does as it loads must only use names already defined
const stubCanvas = () => ({ getContext: () => new Proxy({}, { get: () => () => ({}) }) });
const sandbox = {
  Math, JSON, Date, Object, Array, String, Number, RegExp, Error,
  document: { createElement: stubCanvas, getElementById: () => null },
  window: {}, console: { log() {}, write() {} }
};
vm.createContext(sandbox);
for (const s of pageScripts) {
  if (s === "web/game.js" || problems.some((p) => p.includes(s + ","))) continue;
  try { vm.runInContext(read(s), sandbox, { filename: s }); }
  catch (e) { problems.push(`${s} stops as it loads: ${e.message}`); }
}

if (problems.length) {
  console.log(problems.map((p) => "- " + p).join("\n"));
  process.exit(1);
}
console.log(`ok: ${pageName} loads ${pageScripts.length} scripts, ${libs.length} of them the door's (in its order), and they load cleanly`);
