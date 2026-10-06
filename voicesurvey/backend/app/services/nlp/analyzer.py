"""Lightweight, dependency-free rule/lexicon NLP baseline.

Everything here is a heuristic baseline so the app runs from a clean install.
The `analyze_text` contract is stable: swap the internals for spaCy / Transformers
models without touching the API or database layers.
"""
import re
from collections import Counter

STOPWORDS = set(
    """a an the and or but if then so of to in on at by for with about as is are was were be been am it its
    this that these those i me my we our you your he she they them his her their do does did have has had not
    no very really just can could would should will shall may might from into than too also there here what
    when where who whom which why how up out over""".split()
)
POSITIVE = set(
    """good great happy love loved like liked excellent amazing awesome wonderful fantastic nice useful helpful
    best perfect enjoy enjoyed fast easy smooth brilliant pleased glad satisfied impressive thanks thank
    fine cool""".split()
)
NEGATIVE = set(
    """bad terrible awful hate hated worst poor slow broken bug buggy crash crashed error useless annoying
    frustrating disappointed disappointing horrible sad angry problem issue fail failed failing confusing
    difficult unhappy wrong""".split()
)
NEGATORS = {"not", "no", "never", "cannot", "without"}

EMOTIONS = {
    "happy": set("happy glad love loved enjoy enjoyed wonderful great awesome amazing pleased delighted fantastic".split()),
    "sad": set("sad unhappy disappointed disappointing depressed lonely miserable sorry cry".split()),
    "angry": set("angry furious annoyed annoying hate hated mad frustrating frustrated terrible worst".split()),
    "fear": set("afraid scared worried anxious nervous fear terrified panic".split()),
    "surprise": set("surprised surprising shocked unexpected wow suddenly amazed".split()),
}

INTENT_RULES: list[tuple[str, list[str]]] = [
    ("greeting", [r"^\s*(hi|hello|hey|good (morning|afternoon|evening))\b"]),
    ("goodbye", [r"\b(bye|goodbye|see you|see ya|talk later)\b"]),
    ("thanks", [r"\b(thanks|thank you|thx|appreciate)\b"]),
    ("help", [r"\b(help|assist|support|how do i|how can i|guide)\b"]),
    ("complaint", [
        r"\b(not (working|responding|loading)|doesn'?t work|isn'?t working|broken|crash(es|ed)?|error|bug)\b",
        r"\b(terrible|awful|worst|horrible|useless|frustrat\w+|disappoint\w+|slow)\b",
    ]),
    ("feedback", [
        r"\b(love|like|enjoy|great|amazing|awesome|happy with|useful|helpful|suggest\w*|feedback|improve\w*)\b",
    ]),
    ("question", [r"\?\s*$", r"^\s*(what|why|how|when|where|who|which|can|could|do|does|is|are)\b"]),
]

MONTHS = "january february march april may june july august september october november december".split()
WEEKDAYS = "monday tuesday wednesday thursday friday saturday sunday".split()
RELATIVE_DATES = {"today", "tomorrow", "yesterday", "tonight"}
TIME_RE = re.compile(r"\b\d{1,2}(:\d{2})?\s?(am|pm)\b", re.I)
WORD_RE = re.compile(r"[A-Za-z][A-Za-z'-]*")


def tokenize(text: str) -> list[str]:
    return WORD_RE.findall(text)


def _negated(tokens: list[str], i: int) -> bool:
    for j in range(max(0, i - 2), i):
        w = tokens[j].lower()
        if w in NEGATORS or w.endswith("n't"):
            return True
    return False


def analyze_sentiment(tokens: list[str]) -> dict:
    pos = neg = 0
    for i, tok in enumerate(tokens):
        w = tok.lower()
        val = 1 if w in POSITIVE else -1 if w in NEGATIVE else 0
        if val and _negated(tokens, i):
            val = -val
        pos += val > 0
        neg += val < 0
    total = pos + neg
    polarity = (pos - neg) / total if total else 0.0
    label = "positive" if polarity > 0.15 else "negative" if polarity < -0.15 else "neutral"
    return {"label": label, "score": round(polarity, 3)}  # score: polarity in [-1, 1]


def detect_intent(text: str) -> dict:
    lowered = text.lower().strip()
    if not lowered:
        return {"intent": "unknown", "confidence": 0.0}
    for intent, patterns in INTENT_RULES:
        hits = sum(1 for p in patterns if re.search(p, lowered))
        if hits:
            return {"intent": intent, "confidence": round(min(0.6 + 0.15 * hits, 0.9), 2)}
    return {"intent": "general_conversation", "confidence": 0.4}


def detect_emotion(tokens: list[str]) -> dict:
    scores: Counter[str] = Counter()
    for i, tok in enumerate(tokens):
        w = tok.lower()
        if _negated(tokens, i):
            continue
        for name, vocab in EMOTIONS.items():
            if w in vocab:
                scores[name] += 1
    if not scores:
        return {"label": "neutral", "score": 0.0, "method": "lexicon"}
    name, count = scores.most_common(1)[0]
    return {"label": name, "score": round(count / sum(scores.values()), 2), "method": "lexicon"}


def extract_keywords(tokens: list[str], limit: int = 6) -> list[str]:
    counts: Counter[str] = Counter()
    order: dict[str, int] = {}
    for i, tok in enumerate(tokens):
        w = tok.lower().strip("'-")
        if len(w) > 2 and w not in STOPWORDS:
            counts[w] += 1
            order.setdefault(w, i)
    ranked = sorted(counts, key=lambda w: (-counts[w], order[w]))
    return ranked[:limit]


def extract_entities(text: str) -> list[dict]:
    """Heuristic entities: dates, times, and mid-sentence capitalised words (PROPER_NOUN).
    Person/organisation/location typing needs a trained model (e.g. spaCy en_core_web_sm)."""
    entities: list[dict] = []
    for m in TIME_RE.finditer(text):
        entities.append({"text": m.group(0), "label": "TIME"})
    for tok in tokenize(text):
        low = tok.lower()
        if low in MONTHS or low in WEEKDAYS or low in RELATIVE_DATES:
            entities.append({"text": tok, "label": "DATE"})
    seen = {e["text"].lower() for e in entities}
    for sentence in re.split(r"(?<=[.!?])\s+", text):
        words = sentence.split()
        for idx, raw in enumerate(words):
            tok = raw.strip(".,!?;:\"'()")
            if idx == 0 or not tok or tok == "I" or not tok[0].isupper() or tok.lower() in seen:
                continue
            if tok.lower() in STOPWORDS:
                continue
            entities.append({"text": tok, "label": "PROPER_NOUN"})
            seen.add(tok.lower())
    return entities


def text_statistics(text: str, tokens: list[str], keywords: list[str], entities: list[dict]) -> dict:
    sentences = [s for s in re.split(r"[.!?]+", text) if s.strip()]
    words = len(tokens)
    return {
        "character_count": len(text),
        "word_count": words,
        "sentence_count": max(len(sentences), 1 if words else 0),
        "average_word_length": round(sum(len(t) for t in tokens) / words, 2) if words else 0.0,
        "reading_time_seconds": round(words / 200 * 60, 1),
        "keyword_count": len(keywords),
        "entity_count": len(entities),
    }


def analyze_text(text: str) -> dict:
    text = text.strip()
    tokens = tokenize(text)
    keywords = extract_keywords(tokens)
    entities = extract_entities(text)
    return {
        "sentiment": analyze_sentiment(tokens),
        "intent": detect_intent(text),
        "emotion": detect_emotion(tokens),
        "keywords": keywords,
        "entities": entities,
        "statistics": text_statistics(text, tokens, keywords, entities),
    }
