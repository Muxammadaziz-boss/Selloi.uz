"""Uzbek + Russian + Cyrillic/Latin transliteration and retail slang normalization utilities."""

from __future__ import annotations

import re

_CYRILLIC_TO_LATIN_MAP: dict[str, str] = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d",
    "е": "e", "ё": "yo", "ж": "j", "з": "z", "и": "i",
    "й": "y", "к": "k", "л": "l", "м": "m", "н": "n",
    "о": "o", "п": "p", "р": "r", "с": "s", "т": "t",
    "у": "u", "ф": "f", "х": "x", "ц": "ts", "ч": "ch",
    "ш": "sh", "щ": "sh", "ъ": "'", "ы": "i", "ь": "",
    "э": "e", "ю": "yu", "я": "ya",
    "ў": "o'", "қ": "q", "ғ": "g'", "ҳ": "h",
}

# Canonical retail concept expansions: triggers -> canonical search synonyms
_SLANG_SYNONYM_GROUPS: list[tuple[tuple[str, ...], tuple[str, ...]]] = [
    (
        ("nechpul", "nichpul", "nechipul", "nechpu", "qancha", "necha", "narh", "narx", "skolko", "stoit", "tsena", "cena", "pochem", "baho", "qanchaga"),
        ("narx", "narxi", "price"),
    ),
    (
        ("dastafka", "dastavka", "dostavka", "dastafga", "dostafka", "yetkazib", "yetkazish", "kurier", "kuryer"),
        ("yetkazib", "dostavka"),
    ),
    (
        ("optom", "optm", "ulgurji", "kotta", "partiya"),
        ("optom", "ulgurji"),
    ),
    (
        ("kredit", "nasiya", "rassrochka", "rasrochka", "bolib", "muddatli", "uzum", "alif", "zoodpay"),
        ("nasiya", "kredit", "muddatli"),
    ),
    (
        ("garantiya", "kafolat", "garanti", "garantiyasi"),
        ("kafolat", "garantiya"),
    ),
    (
        ("skidka", "skitka", "chegirma", "aksiya", "aktsiya"),
        ("chegirma", "skidka"),
    ),
    (
        ("nootbuk", "noutbuk", "nout", "laptop", "komp", "kompyuter"),
        ("noutbuk", "laptop"),
    ),
    (
        ("ayfon", "iphone", "ayphon", "iphoni"),
        ("iphone", "apple"),
    ),
    (
        ("krosovka", "krossovka", "krasovka", "krasofka", "kross", "obuv"),
        ("krossovka", "krasovka"),
    ),
    (
        ("telfon", "telefon", "tel", "smartfon", "smartphone"),
        ("telefon", "smartfon"),
    ),
    (
        ("naushnik", "navushnik", "airpods", "quloqchin"),
        ("naushnik", "quloqchin"),
    ),
    (
        ("mishka", "myshka", "sichqoncha", "mouse"),
        ("mishka", "mouse"),
    ),
]

# Semantic intent tags passed to SalesAI for clearer understanding
_INTENT_MARKERS: dict[str, tuple[str, ...]] = {
    "price_inquiry": ("nechpul", "nichpul", "nechipul", "qancha", "narx", "narh", "skolko", "stoit", "tsena", "pochem", "baho"),
    "delivery_inquiry": ("dastafka", "dastavka", "dostavka", "dastafga", "yetkazib", "kuryer", "kurier"),
    "wholesale_inquiry": ("optom", "ulgurji"),
    "installment_inquiry": ("nasiya", "kredit", "rassrochka", "rasrochka", "muddatli", "bolib"),
    "warranty_inquiry": ("kafolat", "garantiya", "garanti"),
    "availability_inquiry": ("bormi", "sotuvda", "mavjud", "nalichii", "nalichi", "qolganmi"),
    "discount_inquiry": ("skidka", "skitka", "chegirma", "aksiya", "arzonroq"),
    "location_inquiry": ("manzil", "adres", "lokatsiya", "qayerdasiz", "qatta", "qayerda"),
}


def cyrillic_to_latin(text: str) -> str:
    """Transliterate Uzbek/Russian Cyrillic text into ASCII-friendly Uzbek Latin."""
    if not text:
        return ""
    out: list[str] = []
    for ch in text.lower():
        mapped = _CYRILLIC_TO_LATIN_MAP.get(ch)
        if mapped is not None:
            out.append(mapped)
        else:
            out.append(ch)
    return "".join(out)


def normalize_for_matching(text: str) -> str:
    """Normalize Cyrillic, mixed apostrophes, and repeated characters for robust matching."""
    latin = cyrillic_to_latin(text or "")
    latin = latin.replace("`", "'").replace("’", "'").replace("ʻ", "'").replace("‘", "'")
    # Normalize o' / g' apostrophe gaps cleanly while keeping tokens intact
    latin = re.sub(r"([og])'", r"\1", latin)
    latin = re.sub(r"\s+", " ", latin).strip()
    return latin


def expand_search_tokens(query: str, max_tokens: int = 16) -> list[str]:
    """Extract clean search tokens plus Cyrillic->Latin and dialect synonyms."""
    stop_words = {"salom", "assalom", "assalomu", "alaykum", "alekum", "privet", "bormi", "nechta", "qanaqa"}
    raw = normalize_for_matching(query)
    base_tokens = [
        tok.strip("?!.,:;()[]{}\"'")
        for tok in raw.split()
        if len(tok.strip("?!.,:;()[]{}\"'")) > 2
        and tok.strip("?!.,:;()[]{}\"'") not in stop_words
    ]

    expanded: list[str] = []
    seen: set[str] = set()

    def _add(tok: str) -> None:
        clean = tok.strip()
        if len(clean) > 2 and clean not in seen:
            seen.add(clean)
            expanded.append(clean)

    for tok in base_tokens:
        _add(tok)
        for triggers, synonyms in _SLANG_SYNONYM_GROUPS:
            if any(tok == trig or tok.startswith(trig) for trig in triggers):
                for syn in synonyms:
                    _add(syn)

    # Also keep original Cyrillic tokens (if query contained Cyrillic) so Cyrillic posts still match directly
    if any("\u0400" <= ch <= "\u04ff" for ch in (query or "")):
        for orig_tok in (query or "").lower().split():
            cleaned_orig = orig_tok.strip("?!.,:;()[]{}\"'")
            _add(cleaned_orig)

    return expanded[:max_tokens]


def detect_retail_intents(text: str) -> list[str]:
    """Identify colloquial Uzbek/Russian retail intents present in customer text."""
    norm = normalize_for_matching(text)
    words = [w.strip("?!.,:;()[]{}\"'") for w in norm.split()]
    found: list[str] = []
    for intent_name, triggers in _INTENT_MARKERS.items():
        if any(any(w == trig or w.startswith(trig) for trig in triggers) for w in words):
            found.append(intent_name)
    return found


def build_normalized_query_text(query: str) -> str:
    """Return enriched search string combining original text and transliterated Latin hints."""
    norm = normalize_for_matching(query)
    if norm and norm != (query or "").strip().lower():
        return f"{query.strip()} {norm}".strip()
    return (query or "").strip()
