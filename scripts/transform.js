// Make the synchronous door script awaitable, and compile it against the runtime.
// Uses acorn (vendor/acorn.js), loaded by the page as a global.
//
// Door scripts call console.getkey(), mswait() and friends as if they block. Here those wait,
// so every function that can reach one of them becomes async and every call that can reach
// one is awaited. Functions that can't stay ordinary synchronous functions, which keeps the
// drawing and maths code (most of a door) at full speed.
// Array and string methods that take a callback (forEach, map, sort, replace...) are routed
// through __cb when the callback might wait; __cb runs it one item at a time.
// Constructors, getters and setters stay synchronous because JavaScript requires it.
const CB_METHODS = new Set(["forEach", "map", "filter", "some", "every", "find", "findIndex", "findLast", "findLastIndex",
  "reduce", "reduceRight", "flatMap", "sort", "replace", "replaceAll"]);
// The runtime calls that wait: global functions and console methods. compile() reads the real
// list from the runtime (its async functions); this is the same list for use without one.
const WAITS = { globals: new Set(["mswait", "sleep"]),
  methods: new Set(["getkey", "inkey", "getxy", "getstr", "getnum", "pause", "yesno", "noyes"]) };
export function transform(src, waits) {
  waits = waits || WAITS;
  src = src.replace(/^#!.*/, "");
  const ast = acorn.parse(src, { ecmaVersion: 2020, sourceType: "script", allowReturnOutsideFunction: true, locations: true });
  const ed = [];
  const isFn = (n) => n && (n.type === "FunctionExpression" || n.type === "ArrowFunctionExpression" || n.type === "FunctionDeclaration");
  const ctors = new Set();
  // Calls to the standard Math functions run without await (they're hot in door loops), but only
  // if the script uses Math purely as Math.name: never declares, reassigns, passes or patches it.
  let mathPlain = true;
  const WRITES = { AssignmentExpression: "left", UpdateExpression: "argument", ForInStatement: "left", ForOfStatement: "left",
    ArrayPattern: "elements", AssignmentPattern: "left", RestElement: "argument", Property: "value" };
  (function scan(n, parent, key) {
    if (!n || typeof n.type !== "string") return;
    if (n.type === "NewExpression" && n.callee.type === "Identifier") ctors.add(n.callee.name);
    if (n.type === "WithStatement") mathPlain = false;
    if (n.type === "Identifier" && n.name === "Math" && !(parent && parent.type === "MemberExpression" && key === "object")) mathPlain = false;
    if (n.type === "MemberExpression" && n.object.type === "Identifier" && n.object.name === "Math" && parent &&
        (WRITES[parent.type] === key || (parent.type === "UnaryExpression" && parent.operator === "delete"))) mathPlain = false;
    for (const k in n) {
      if (k === "loc") continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach((ch) => scan(ch, n, k)); else if (v && typeof v.type === "string") scan(v, n, k);
    }
  })(ast, null, null);
  const MATH_SYNC = new Set(["abs", "acos", "asin", "atan", "atan2", "cbrt", "ceil", "cos", "exp", "floor", "hypot",
    "log", "log10", "log2", "max", "min", "pow", "random", "round", "sign", "sin", "sqrt", "tan", "trunc"]);
  const isMathCall = (node) => {
    const c = node.callee;
    return mathPlain && !node.optional && c.type === "MemberExpression" && !c.computed && !c.optional &&
      c.object.type === "Identifier" && c.object.name === "Math" && c.property.type === "Identifier" && MATH_SYNC.has(c.property.name);
  };

  // ---- Which functions can wait ----
  // A call to a function declared once, at the top of the script or of a function body, and
  // never reassigned, can only land on that function, so it waits only if that function does.
  // Any other call (a method, a callback, a function held in a variable) could land on any
  // function that's used as a value, so it waits if any of those functions waits. Calls to the
  // runtime's waiting functions always wait. Anything that could hide one of those calls from
  // this (eval, with, arguments.callee, keeping console.getkey or mswait in a variable)
  // makes every function async and every call awaited, as if there were no analysis.
  const fns = [], calls = [], counts = new Map(), funcDecls = new Map(), written = new Set(), valueRefs = new Set();
  let unsafe = false, aliasRisk = false;
  const count = (name) => counts.set(name, (counts.get(name) || 0) + 1);
  const isCallee = (parent, key) => parent && parent.type === "CallExpression" && key === "callee";
  function bind(p, owner, assigning) {   // the names a declaration (or assignment) pattern binds
    if (!p) return;
    if (p.type === "Identifier") { if (assigning) written.add(p.name); else count(p.name); }
    else if (p.type === "ObjectPattern") {
      for (const q of p.properties) {
        if (q.type === "RestElement") bind(q.argument, owner, assigning);
        else { if (q.computed) visit(q.key, q, "key", owner); bind(q.value, owner, assigning); }
      }
    }
    else if (p.type === "ArrayPattern") for (const q of p.elements) bind(q, owner, assigning);
    else if (p.type === "RestElement") bind(p.argument, owner, assigning);
    else if (p.type === "AssignmentPattern") { bind(p.left, owner, assigning); visit(p.right, p, "right", owner); }
    else visit(p, null, null, owner);   // a member expression target: an ordinary reference
  }
  function visit(n, parent, key, owner) {
    if (!n || typeof n.type !== "string") return;
    // what JavaScript requires to stay synchronous
    if (n.type === "FunctionDeclaration" && n.id && ctors.has(n.id.name)) n._sync = true;
    if (n.type === "VariableDeclarator" && n.id.type === "Identifier" && ctors.has(n.id.name) && isFn(n.init)) n.init._sync = true;
    if (n.type === "AssignmentExpression" && n.left.type === "Identifier" && ctors.has(n.left.name) && isFn(n.right)) n.right._sync = true;
    if (n.type === "Property" && (n.kind === "get" || n.kind === "set") && isFn(n.value)) n.value._sync = true;
    if (n.type === "MethodDefinition" && n.kind !== "method" && isFn(n.value)) n.value._sync = true;
    switch (n.type) {
      case "WithStatement": unsafe = true; break;
      case "Identifier":
        if (n.name === "eval") unsafe = true;
        if (isCallee(parent, key)) return;   // sorted out with the call
        valueRefs.add(n.name);
        if (n.name === "console" && !(parent && parent.type === "MemberExpression" && key === "object" && !parent.computed)) aliasRisk = true;
        if (waits.globals.has(n.name)) aliasRisk = true;
        return;
      case "MemberExpression":
        if (!n.computed && n.property.type === "Identifier") {
          const p = n.property.name;
          if (p === "callee" || p === "caller") unsafe = true;
          if (waits.methods.has(p) && !isCallee(parent, key)) aliasRisk = true;
        } else if (n.computed && n.property.type === "Literal" &&
                   (n.property.value === "callee" || n.property.value === "caller" || waits.methods.has(n.property.value))) unsafe = true;
        visit(n.object, n, "object", owner);
        if (n.computed) visit(n.property, n, "property", owner);
        return;
      case "Property": case "MethodDefinition": case "PropertyDefinition":
        // method shorthand, m() {}: "async" goes before the name, not before the "("
        if (isFn(n.value) && (n.type === "MethodDefinition" ? n.kind === "method" : n.method))
          n.value._asyncAt = n.computed ? src.lastIndexOf("[", n.key.start) : n.key.start;
        if (n.computed) visit(n.key, n, "key", owner);
        visit(n.value, n, "value", owner);
        return;
      case "LabeledStatement": visit(n.body, n, "body", owner); return;
      case "BreakStatement": case "ContinueStatement": case "MetaProperty": return;
      case "VariableDeclarator": bind(n.id, owner, false); visit(n.init, n, "init", owner); return;
      case "CatchClause": bind(n.param, owner, false); visit(n.body, n, "body", owner); return;
      case "ClassDeclaration": case "ClassExpression":
        if (n.id) count(n.id.name);
        visit(n.superClass, n, "superClass", owner); visit(n.body, n, "body", owner);
        return;
      case "AssignmentExpression": bind(n.left, owner, true); visit(n.right, n, "right", owner); return;
      case "UpdateExpression": bind(n.argument, owner, true); return;
      case "ForInStatement": case "ForOfStatement":
        if (n.left.type === "VariableDeclaration") visit(n.left, n, "left", owner); else bind(n.left, owner, true);
        visit(n.right, n, "right", owner); visit(n.body, n, "body", owner);
        return;
      case "CallExpression": calls.push({ node: n, owner }); break;
    }
    if (isFn(n)) {
      fns.push(n);
      n._calls = [];
      n._escaped = !(isCallee(parent, key) && n.type !== "FunctionDeclaration");   // declarations: settled below
      if (n.id) count(n.id.name);
      if (n.type === "FunctionDeclaration" && n.id) {
        const top = parent && (parent.type === "Program" || (parent.type === "BlockStatement" && parent._fnBody));
        funcDecls.set(n.id.name, funcDecls.has(n.id.name) || !top ? null : n);
      }
      for (const p of n.params) bind(p, n, false);
      if (n.body.type === "BlockStatement") n.body._fnBody = true;
      visit(n.body, n, "body", n);
      return;
    }
    for (const k in n) {
      if (k === "type" || k === "start" || k === "end" || k === "loc" || k[0] === "_") continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach((ch) => visit(ch, n, k, owner));
      else if (v && typeof v.type === "string") visit(v, n, k, owner);
    }
  }
  visit(ast, null, null, null);
  if (unsafe) mathPlain = false;
  const direct = (name) => {
    const f = funcDecls.get(name);
    return f && counts.get(name) === 1 && !written.has(name) ? f : null;
  };
  for (const f of fns) if (f.type === "FunctionDeclaration") f._escaped = !f.id || !direct(f.id.name) || valueRefs.has(f.id.name);
  const top = [];
  for (const c of calls) {
    const k = c.node.callee;
    if (k.type === "Super" || isMathCall(c.node)) c.kind = "never";
    else if (k.type === "Identifier") c.kind = waits.globals.has(k.name) ? "wait" : (c.fn = direct(k.name)) ? "fn" : "indirect";
    else if (k.type === "MemberExpression" && !k.computed && k.property.type === "Identifier" && waits.methods.has(k.property.name)) c.kind = "wait";
    else if (isFn(k)) { c.kind = "fn"; c.fn = k; }
    else c.kind = "indirect";
    (c.owner ? c.owner._calls : top).push(c);
  }
  for (const f of fns) { f._forced = !!(f._sync || f.generator); f._async = !f._forced && (unsafe || !!f.async); }
  let indirect = true;
  const waitsAt = (c) => c.kind === "wait" || (c.kind === "fn" && c.fn._async) || (c.kind === "indirect" && indirect);
  if (unsafe) indirect = true;
  else for (let changed = true; changed;) {
    changed = false;
    indirect = aliasRisk || fns.some((f) => f._escaped && f._async);
    for (const f of fns) if (!f._async && !f._forced && f._calls.some(waitsAt)) { f._async = true; changed = true; }
  }
  for (const c of calls) c.node._await = c.kind !== "never" && (unsafe || waitsAt(c));

  function walk(node, ctx) {   // ctx: awaits are allowed here (an async function or the top level)
    if (!node || typeof node.type !== "string") return;
    if (isFn(node)) {
      ctx = node._async;
      const at = node._asyncAt != null ? node._asyncAt : node.start;
      if (ctx && !node.async) ed.push({ pos: at, text: "async ", open: true, span: node.end - at });
    }
    if (node.type === "CallExpression" && ctx && node._await) {
      const span = node.end - node.start, c = node.callee;
      ed.push({ pos: node.start, text: "(await ", open: true, span });
      ed.push({ pos: node.end, text: ")", open: false, span: 0 });
      if (c.type === "MemberExpression" && !c.computed && !c.optional && !node.optional && c.property.type === "Identifier" &&
          CB_METHODS.has(c.property.name) && node.arguments.length && node.arguments.every((a) => a.type !== "SpreadElement")) {
        const lp = src.indexOf("(", c.property.end);
        if (lp > 0 && lp < node.end && src[node.end - 1] === ")") {
          ed.push({ pos: node.start, text: "__cb(", open: true, span: span - 0.5 });
          ed.push({ pos: c.object.end, end: lp + 1, text: ', "' + c.property.name + '", [', open: true, span: 0 });
          ed.push({ pos: node.end - 1, end: node.end, text: "])", open: true, span: 0 });
        }
      }
    }
    for (const key in node) {
      if (key === "type" || key === "start" || key === "end" || key === "loc" || key[0] === "_") continue;
      const v = node[key];
      if (Array.isArray(v)) v.forEach((ch) => walk(ch, ctx));
      else if (v && typeof v.type === "string") walk(v, ctx);
    }
  }
  walk(ast, true);
  ed.sort((a, b) => a.pos - b.pos || (a.open === b.open ? b.span - a.span : (a.open ? 1 : -1)));
  let outS = "", last = 0;
  for (const e of ed) { outS += src.slice(last, e.pos) + e.text; last = e.end != null ? e.end : e.pos; }
  return outS + src.slice(last);
}

async function msort(arr, cmp) {
  if (arr.length < 2) return arr;
  const mid = arr.length >> 1;
  const l = await msort(arr.slice(0, mid), cmp), r = await msort(arr.slice(mid), cmp);
  const o = []; let i = 0, j = 0;
  while (i < l.length && j < r.length) { if (Number(await cmp(l[i], r[j])) > 0) o.push(r[j++]); else o.push(l[i++]); }
  return o.concat(l.slice(i), r.slice(j));
}
async function __cb(obj, name, args) {
  const fn = args[0];
  if (Array.isArray(obj) && typeof fn === "function") {
    const a = obj, t = args[1], n = a.length;
    switch (name) {
      case "forEach": for (let i = 0; i < n; i++) if (i in a) await fn.call(t, a[i], i, a); return undefined;
      case "map": { const r = new Array(n); for (let i = 0; i < n; i++) if (i in a) r[i] = await fn.call(t, a[i], i, a); return r; }
      case "filter": { const r = []; for (let i = 0; i < n; i++) if (i in a && await fn.call(t, a[i], i, a)) r.push(a[i]); return r; }
      case "flatMap": { const r = []; for (let i = 0; i < n; i++) if (i in a) { const v = await fn.call(t, a[i], i, a); if (Array.isArray(v)) r.push(...v); else r.push(v); } return r; }
      case "some": for (let i = 0; i < n; i++) if (i in a && await fn.call(t, a[i], i, a)) return true; return false;
      case "every": for (let i = 0; i < n; i++) if (i in a && !(await fn.call(t, a[i], i, a))) return false; return true;
      case "find": for (let i = 0; i < n; i++) if (await fn.call(t, a[i], i, a)) return a[i]; return undefined;
      case "findIndex": for (let i = 0; i < n; i++) if (await fn.call(t, a[i], i, a)) return i; return -1;
      case "findLast": for (let i = n - 1; i >= 0; i--) if (await fn.call(t, a[i], i, a)) return a[i]; return undefined;
      case "findLastIndex": for (let i = n - 1; i >= 0; i--) if (await fn.call(t, a[i], i, a)) return i; return -1;
      case "reduce": case "reduceRight": {
        const idx = []; for (let i = 0; i < n; i++) if (i in a) idx.push(i);
        if (name === "reduceRight") idx.reverse();
        let k = 0, acc;
        if (args.length > 1) acc = args[1];
        else { if (!idx.length) throw new TypeError("Reduce of empty array with no initial value"); acc = a[idx[k++]]; }
        for (; k < idx.length; k++) acc = await fn(acc, a[idx[k]], idx[k], a);
        return acc;
      }
      case "sort": {
        const items = []; let u = 0;
        for (let i = 0; i < n; i++) if (i in a) { if (a[i] === undefined) u++; else items.push(a[i]); }
        const s = await msort(items, fn);
        let k = 0;
        for (; k < s.length; k++) a[k] = s[k];
        for (let j = 0; j < u; j++, k++) a[k] = undefined;
        for (; k < n; k++) delete a[k];
        return a;
      }
    }
  }
  if (typeof obj === "string" && (name === "replace" || name === "replaceAll") && typeof args[1] === "function") {
    const calls = [];
    obj[name](args[0], (...m) => { calls.push(m); return ""; });
    const outs = [];
    for (const m of calls) outs.push(String(await args[1](...m)));
    let k = 0;
    return obj[name](args[0], () => outs[k++]);
  }
  return obj[name](...args);
}

// Line numbers in runtime errors: find how many lines new Function adds
let lineOffset = null;
export function probeOffset() {
  try { new Function("return (async function(){\nthrow new Error('probe')\n})")()().catch((e) => { lineOffset = stackLine(e) - 1; }); } catch (e) {}
}
function stackLine(e) { const m = /(?:<anonymous>|Function|eval[^:]*):(\d+):\d+/.exec(String(e && e.stack)); return m ? +m[1] : null; }
// The line of the compiled source an error was thrown from, or null if the stack doesn't say
export function errorLine(e) {
  const ln = lineOffset != null ? stackLine(e) : null;
  return ln != null ? ln - lineOffset : null;
}

// The runtime's waiting calls, for transform(): its async global functions and the async
// methods of its objects (console). Anything in the runtime that waits must be async.
function waitsOf(globals) {
  const isAsync = (f) => typeof f === "function" && f.constructor.name === "AsyncFunction";
  const w = { globals: new Set(), methods: new Set() };
  for (const [k, v] of Object.entries(globals)) {
    if (isAsync(v)) w.globals.add(k);
    else if (v && typeof v === "object")
      for (const [m, d] of Object.entries(Object.getOwnPropertyDescriptors(v))) if (isAsync(d.value)) w.methods.add(m);
  }
  return w;
}

export function compile(src, env) {
  const body = transform(src, waitsOf(env.globals));
  const g = Object.assign({ __cb }, env.globals);
  const names = Object.keys(g);
  const fn = new Function(...names, "return (async function(){\n" + body + "\n})");
  return fn(...names.map((n) => g[n]));
}
