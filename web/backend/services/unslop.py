"""Deterministic cleanup for user-facing prose before it reaches the client.

Any future LLM / narrative field on analyze (or related) responses MUST run
through ``unslop_text`` before it is included in an API payload. This is the
generation-side guardrail: fix copy at the source, then filter dynamic text.
Do not put unslop logic in chat bubble / Notra chrome components.
"""

from __future__ import annotations

import re

# Em / en dashes and common hyphen-as-dash stand-ins used mid-sentence.
_DASH_CHARS = "\u2014\u2013\u2212"  # em, en, minus

_CHATBOT_OPENERS = (
    r"^(?:of course[!.,]?\s*|certainly[!.,]?\s*|absolutely[!.,]?\s*|"
    r"great question[!.,]?\s*|sure[!.,]?\s*|happy to help[!.,]?\s*)"
)

_CHATBOT_CLOSERS = (
    r"(?:\s*i hope this helps!?\.?\s*$|"
    r"\s*let me know if (?:you (?:need|have) (?:anything|any questions?|more).*)!?\.?\s*$|"
    r"\s*feel free to (?:ask|reach out).*$)"
)

_FILLER_PHRASES = (
    (re.compile(r"\bin order to\b", re.I), "to"),
    (re.compile(r"\bdue to the fact that\b", re.I), "because"),
    (re.compile(r"\bit is important to note that\b", re.I), ""),
    (re.compile(r"\bit'?s important to note that\b", re.I), ""),
    (re.compile(r"\bplease note that\b", re.I), ""),
    (re.compile(r"\bat this point in time\b", re.I), "now"),
    (re.compile(r"\bin the event that\b", re.I), "if"),
    (re.compile(r"\butilize\b", re.I), "use"),
    (re.compile(r"\bleverage\b", re.I), "use"),
    (re.compile(r"\bfacilitate\b", re.I), "help"),
    (re.compile(r"\benhance\b", re.I), "improve"),
    (re.compile(r"\bdelve into\b", re.I), "look at"),
    (re.compile(r"\bcrucial\b", re.I), "important"),
)

_CURLY_QUOTES = str.maketrans({
    "\u2018": "'",
    "\u2019": "'",
    "\u201c": '"',
    "\u201d": '"',
    "\u00ab": '"',
    "\u00bb": '"',
    "\u2026": "...",
})

# Mojibake sequences often seen when UTF-8 was mis-decoded then re-encoded.
_MOJIBAKE = (
    ("\u00c3\u00a2\u20ac\u201d", ", "),   # â€" (broken em dash) -> comma
    ("\u00c3\u00a2\u20ac\u201c", ", "),   # â€œ variant
    ("\u00c3\u00a2\u20ac\u009d", ", "),
    ("â€”", ", "),
    ("â€“", ", "),
    ("Â·", ". "),
    ("Ã¢â‚¬â€", ", "),
)


def unslop_text(s: str) -> str:
    """Return plain clinical prose: no dashes-as-aside, no chatbot filler.

    Safe on empty / non-string input. Idempotent for already-clean text.
    """
    if s is None:
        return ""
    if not isinstance(s, str):
        s = str(s)
    if not s.strip():
        return s

    text = s

    for bad, good in _MOJIBAKE:
        if bad in text:
            text = text.replace(bad, good)

    text = text.translate(_CURLY_QUOTES)

    # Em/en dash -> period when it separates clauses; else comma.
    def _dash_repl(m: re.Match[str]) -> str:
        before = m.group(1)
        after = m.group(2)
        # Sentence-like break: capitalize-looking after, or end-ish.
        if after and after[0:1].isupper():
            return f"{before}. {after}"
        return f"{before}, {after}"

    text = re.sub(
        rf"(\S)\s*[{re.escape(_DASH_CHARS)}]\s*(\S)",
        _dash_repl,
        text,
    )
    # Lone leftover dash chars.
    text = re.sub(rf"[{re.escape(_DASH_CHARS)}]", ",", text)

    text = re.sub(_CHATBOT_OPENERS, "", text, flags=re.I)
    text = re.sub(_CHATBOT_CLOSERS, "", text, flags=re.I)

    for pattern, repl in _FILLER_PHRASES:
        text = pattern.sub(repl, text)

    # Collapse whitespace left by deletions.
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"\s+([,.;:!?])", r"\1", text)
    text = text.strip()

    # If openers/closers ate the whole string, keep a neutral fallback.
    if not text:
        return ""

    # Capitalize first letter if we stripped an opener.
    if text and text[0].islower():
        text = text[0].upper() + text[1:]

    return text


def unslop_detail(detail: str | list | dict | None) -> str | list | dict | None:
    """Apply ``unslop_text`` to FastAPI HTTPException detail payloads."""
    if detail is None:
        return None
    if isinstance(detail, str):
        return unslop_text(detail)
    if isinstance(detail, list):
        return [unslop_detail(x) for x in detail]
    if isinstance(detail, dict):
        out = dict(detail)
        if "msg" in out and isinstance(out["msg"], str):
            out["msg"] = unslop_text(out["msg"])
        if "detail" in out and isinstance(out["detail"], str):
            out["detail"] = unslop_text(out["detail"])
        return out
    return detail
