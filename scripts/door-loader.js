// Fetches the door and the files it load()s, and joins them into one program.
// On Synchronet, load(js.exec_dir + "lib/x.js") at the top of the door runs x.js in the door's
// global scope, which is the same as pasting it in at that line, so that's what this does.
// The door then compiles as one script, and where() maps a line back to the file it came from.
const LOAD = /^\s*load\(js\.exec_dir \+ "([^"]+)"\);\s*$/;

async function fetchText(url) {
  const r = await fetch(url, { cache: "no-cache" });
  if (!r.ok) throw new Error(url + ": HTTP " + r.status);
  return r.text();
}
const linesOf = (s) => s.replace(/\r?\n$/, "").split(/\r?\n/);

export async function loadDoor(url) {
  const base = url.slice(0, url.lastIndexOf("/") + 1), name = url.slice(base.length);
  const main = linesOf(await fetchText(url));
  const loads = main.map((l) => { const m = LOAD.exec(l); return m ? m[1] : null; });
  const parts = await Promise.all(loads.map((p) => (p ? fetchText(base + p).then(linesOf) : null)));
  const src = [], from = [];   // from[i]: [file, line] that line i + 1 of src came from
  main.forEach((l, i) => {
    if (parts[i]) parts[i].forEach((pl, j) => { src.push(pl); from.push([loads[i], j + 1]); });
    else { src.push(l); from.push([name, i + 1]); }
  });
  return {
    name, src: src.join("\n"), lines: src.length, files: 1 + loads.filter(Boolean).length,
    // " (lib/putt.js line 42)" for line 42 of putt.js; "" if the line isn't known
    where(line, col) {
      const f = from[line - 1];
      return f ? " (" + f[0] + " line " + f[1] + (col != null ? ", col " + col : "") + ")" : "";
    }
  };
}
