from app.services.survey_nlp import analyze_answer, phrase_counts


def test_sentiment_and_keywords():
    r = analyze_answer("The customer support was great and very helpful")
    assert r["sentiment"] == "positive" and "customer" in r["keywords"] and r["word_count"] == 8


def test_negation():
    assert analyze_answer("The app is not good")["sentiment"] == "negative"


def test_phrases_need_adjacent_content_words():
    c = phrase_counts(["customer support is slow", "great customer support", "the support of customer"])
    assert c["customer support"] == 2 and "support customer" not in c
