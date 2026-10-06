from collections import Counter
from datetime import timedelta
from statistics import mean

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Answer, Response, Survey, utcnow
from app.services.survey_nlp import phrase_counts


def _sentiment_counts(answers: list[Answer]) -> dict:
    c = Counter(a.sentiment for a in answers)
    return {k: c.get(k, 0) for k in ("positive", "neutral", "negative")}


def _top(counter: Counter, n: int, min_count: int = 1) -> list[dict]:
    return [{"term": t, "count": c} for t, c in counter.most_common(n) if c >= min_count]


def _example(a: Answer) -> dict:
    return {"text": a.transcript[:300], "sentiment": a.sentiment, "score": a.sentiment_score, "input_type": a.input_type}


def build_results(db: Session, survey: Survey) -> dict:
    answers = db.scalars(
        select(Answer).join(Response, Answer.response_id == Response.id).where(Response.survey_id == survey.id)
    ).all()
    total_responses = db.scalar(select(func.count()).select_from(Response).where(Response.survey_id == survey.id)) or 0
    since = utcnow() - timedelta(days=13)
    per_day = db.execute(
        select(func.date(Response.created_at), func.count())
        .where(Response.survey_id == survey.id, Response.created_at >= since)
        .group_by(func.date(Response.created_at))
    ).all()

    by_q: dict[int, list[Answer]] = {q.id: [] for q in survey.questions}
    for a in answers:
        by_q.setdefault(a.question_id, []).append(a)

    questions = []
    for q in survey.questions:
        qa = by_q[q.id]
        kw = Counter(k for a in qa for k in a.keywords)
        ranked = sorted(qa, key=lambda a: a.sentiment_score)
        questions.append({
            "question_id": q.id, "text": q.text, "answer_count": len(qa),
            "sentiment": _sentiment_counts(qa),
            "average_polarity": round(mean(a.sentiment_score for a in qa), 3) if qa else 0.0,
            "average_words": round(mean(a.word_count for a in qa), 1) if qa else 0.0,
            "voice_answers": sum(a.input_type == "voice" for a in qa),
            "top_keywords": _top(kw, 8),
            "top_phrases": _top(phrase_counts([a.transcript for a in qa]), 5, min_count=2),
            "most_negative": [_example(a) for a in ranked[:2] if a.sentiment_score < -0.15],
            "most_positive": [_example(a) for a in reversed(ranked[-2:]) if a.sentiment_score > 0.15],
        })

    return {
        "survey": {"id": survey.id, "title": survey.title, "slug": survey.slug, "is_open": survey.is_open},
        "total_responses": total_responses, "total_answers": len(answers),
        "voice_answers": sum(a.input_type == "voice" for a in answers),
        "text_answers": sum(a.input_type == "text" for a in answers),
        "sentiment": _sentiment_counts(answers),
        "top_keywords": _top(Counter(k for a in answers for k in a.keywords), 12),
        "per_day": [{"date": str(d), "count": n} for d, n in sorted(per_day)],
        "questions": questions,
    }
