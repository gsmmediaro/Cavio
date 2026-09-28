/**
 * Deterministic cleanup for user-facing prose.
 * Mirror of web/backend/services/unslop.py.
 * Use on any dynamic assistant / error string before showing it.
 * Do NOT call from chat bubble / Notra chrome components — apply at the
 * point text is generated or received from the API.
 */

const DASH_CHARS = /[\u2014\u2013\u2212]/g;

const CHATBOT_OPENERS =
  /^(?:of course[!.,]?\s*|certainly[!.,]?\s*|absolutely[!.,]?\s*|great question[!.,]?\s*|sure[!.,]?\s*|happy to help[!.,]?\s*)/i;

const CHATBOT_CLOSERS =
  /(?:\s*i hope this helps!?\.?\s*$|\s*let me know if (?:you (?:need|have) (?:anything|any questions?|more).*)!?\.?\s*$|\s*feel free to (?:ask|reach out).*$)/i;

const FILLER: Array<[RegExp, string]> = [
  [/\bin order to\b/gi, "to"],
  [/\bdue to the fact that\b/gi, "because"],
  [/\bit is important to note that\b/gi, ""],
  [/\bit'?s important to note that\b/gi, ""],
  [/\bplease note that\b/gi, ""],
  [/\bat this point in time\b/gi, "now"],
  [/\bin the event that\b/gi, "if"],
  [/\butilize\b/gi, "use"],
  [/\bleverage\b/gi, "use"],
  [/\bfacilitate\b/gi, "help"],
  [/\benhance\b/gi, "improve"],
  [/\bdelve into\b/gi, "look at"],
  [/\bcrucial\b/gi, "important"],
];

const MOJIBAKE: Array<[string, string]> = [
  ["\u00c3\u00a2\u20ac\u201d", ", "],
  ["â€”", ", "],
  ["â€“", ", "],
  ["Â·", ". "],
  ["Ã¢â‚¬â€", ", "],
];

export function unslopText(s: string | null | undefined): string {
  if (s == null) return "";
  let text = String(s);
  if (!text.trim()) return text;

  for (const [bad, good] of MOJIBAKE) {
    if (text.includes(bad)) text = text.split(bad).join(good);
  }

  text = text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d\u00ab\u00bb]/g, '"')
    .replace(/\u2026/g, "...");

  text = text.replace(/(\S)\s*[\u2014\u2013\u2212]\s*(\S)/g, (_m, a: string, b: string) => {
    if (b && b[0] === b[0].toUpperCase() && /[A-Za-z]/.test(b[0])) {
      return `${a}. ${b}`;
    }
    return `${a}, ${b}`;
  });
  text = text.replace(DASH_CHARS, ",");

  text = text.replace(CHATBOT_OPENERS, "");
  text = text.replace(CHATBOT_CLOSERS, "");

  for (const [pattern, repl] of FILLER) {
    text = text.replace(pattern, repl);
  }

  text = text.replace(/[ \t]{2,}/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.replace(/\s+([,.;:!?])/g, "$1");
  text = text.trim();

  if (text && text[0] === text[0].toLowerCase()) {
    text = text[0].toUpperCase() + text.slice(1);
  }
  return text;
}
