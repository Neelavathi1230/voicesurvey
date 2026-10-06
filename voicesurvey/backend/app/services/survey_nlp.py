"""Per-answer analysis and cross-answer phrase mining for survey text."""
from collections import Counter

from app.services.nlp.analyzer import STOPWORDS, analyze_sentiment, extract_keywords, tokenize


def analyze_answer(text: str) -> dict:
    tokens = tokenize(text)
    s = analyze_sentiment(tokens)
    return {
        "sentiment": s["label"], "sentiment_score": s["score"],
        "keywords": extract_keywords(tokens, 5), "word_count": len(tokens),
    }


def phrase_counts(texts: list[str]) -> Counter:
    """Adjacent content-word pairs (stopwords break a phrase), e.g. 'customer support'."""
    counts: Counter[str] = Counter()
    for text in texts:
        prev = None
        for tok in tokenize(text):
            w = tok.lower().strip("'-")
            if len(w) > 2 and w not in STOPWORDS:
                if prev:
                    counts[f"{prev} {w}"] += 1
                prev = w
            else:
                prev = None
    return counts
