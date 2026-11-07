// IC Disc Golf web: the game's own wording as HTML. The rule files (../bbs/lib) write CP437 text with
// Ctrl-A colour codes, for the terminal; the web page shows the same words.
"use strict";

var TEXT = (function () {
	// Quotes too: the menus put text inside attribute values (value='...', data-d='...')
	function esc(t) { return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
	// Bytes 128-255 as their DOS characters: the same table as the terminal's (scripts/terminal.js)
	var CP437_HI = "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ";
	function cp(t) { return String(t).replace(/[\x80-\xff]/g, function (c) { return CP437_HI[c.charCodeAt(0) - 128]; }); }
	function html(t) { return esc(cp(t)); }
	// The door's wording, with its Ctrl-A colour codes, as HTML (~ hotkey marks are dropped: the web has its own keys)
	var CA = { k: "c-k", r: "c-r", g: "c-g", y: "c-y", b: "c-b", m: "c-m", c: "c-c", w: "c-w" };
	function ctrlA(s) {
		s = cp(s);
		var out = "", cls = [], open = false, i, ch;
		for (i = 0; i < s.length; i++) {
			ch = s[i];
			if (ch === "\x01" && i + 1 < s.length) {
				var c = s[++i].toLowerCase();
				if (c === "n") cls = []; else if (c === "h") cls.push("hi"); else if (CA[c]) cls = cls.filter(function (x) { return x === "hi"; }).concat([CA[c]]);
				if (open) { out += "</span>"; open = false; }
				if (cls.length) { out += '<span class="' + cls.join(" ") + '">'; open = true; }
				continue;
			}
			out += esc(ch);
		}
		return out + (open ? "</span>" : "");
	}
	function plain(label) { return cp(String(label).replace("~", "")); }   // a door label ("~Backhand") as text
	return { esc: esc, cp: cp, html: html, ctrlA: ctrlA, plain: plain };
})();
