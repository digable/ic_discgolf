// Player names.
//
// BBS players play under their BBS alias. Web players type a name, checked with the same
// rules Synchronet's check_name() applies to a new user's alias (bbs/lib/menus.js has the
// door's copy, nameProblem()). In shared games (cross-play, not built yet), a web player's
// name is tagged so it can't pass for a BBS player: "Digable (web)", then "Digable (web01)",
// "Digable (web02)" and so on for more web players with the same name.

const MAX_NAME = 25;   // Synchronet's LEN_ALIAS

// A short, stable tag for a name: lowercase letters, digits and _ (the same as IC Zombies)
const slugOf = (who) => String(who || "local").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "local";

// Why a typed name can't be used, or "" if it can
function nameProblem(name) {
  name = String(name);
  if (!name) return "Type your name first.";
  if (name.length > MAX_NAME) return `At most ${MAX_NAME} characters.`;
  if (!/^[\x20-\x7e]*$/.test(name)) return "Letters, digits, spaces and punctuation only.";
  if (!/^[A-Za-z]/.test(name)) return "Start with a letter.";
  if (name.endsWith(" ")) return "No space at the end.";
  if (name.includes("  ")) return "No double spaces.";
  return "";
}

// A web player's name in a shared game, given the names already in it
function webName(name, taken) {
  const used = new Set(taken.map((n) => n.toLowerCase()));
  for (let i = 0; ; i++) {
    const tagged = `${name} (web${i ? String(i).padStart(2, "0") : ""})`;
    if (!used.has(tagged.toLowerCase())) return tagged;
  }
}

module.exports = { MAX_NAME, slugOf, nameProblem, webName };
