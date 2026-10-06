import csv
import io
import secrets

from fastapi import APIRouter, Depends
from fastapi.responses import Response as HttpResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.core.errors import AppError
from app.database.session import get_db
from app.models import Answer, Question, Response, Survey, User
from app.schemas import SurveyCreate, SurveyPatch, ok
from app.services.results import build_results

router = APIRouter(prefix="/api/surveys", tags=["surveys"])


def _owned(db: Session, user: User, survey_id: int) -> Survey:
    s = db.get(Survey, survey_id)
    if not s or s.user_id != user.id:
        raise AppError("NOT_FOUND", "Survey not found.", 404)
    return s


def _out(s: Survey, responses: int | None = None) -> dict:
    return {
        "id": s.id, "slug": s.slug, "title": s.title, "description": s.description, "is_open": s.is_open,
        "created_at": s.created_at.isoformat(), "response_count": responses,
        "questions": [{"id": q.id, "text": q.text} for q in s.questions],
    }


@router.post("", status_code=201)
def create_survey(body: SurveyCreate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    s = Survey(user_id=user.id, slug=secrets.token_urlsafe(6), title=body.title, description=body.description)
    s.questions = [Question(position=i, text=t) for i, t in enumerate(body.questions)]
    db.add(s)
    db.commit()
    return ok(_out(s, 0), "Survey created")


@router.get("")
def list_surveys(db: Session = Depends(get_db), user: User = Depends(current_user)):
    counts = dict(
        db.execute(
            select(Response.survey_id, func.count()).join(Survey).where(Survey.user_id == user.id).group_by(Response.survey_id)
        ).all()
    )
    rows = db.scalars(select(Survey).where(Survey.user_id == user.id).order_by(Survey.id.desc())).all()
    return ok([_out(s, counts.get(s.id, 0)) for s in rows])


@router.get("/{survey_id}")
def get_survey(survey_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return ok(_out(_owned(db, user, survey_id)))


@router.patch("/{survey_id}")
def set_open(survey_id: int, body: SurveyPatch, db: Session = Depends(get_db), user: User = Depends(current_user)):
    s = _owned(db, user, survey_id)
    s.is_open = body.is_open
    db.commit()
    return ok(_out(s), "Survey updated")


@router.delete("/{survey_id}")
def delete_survey(survey_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    db.delete(_owned(db, user, survey_id))
    db.commit()
    return ok(None, "Survey deleted")


@router.get("/{survey_id}/results")
def results(survey_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return ok(build_results(db, _owned(db, user, survey_id)))


def _safe_cell(v) -> str:
    s = str(v)
    return "'" + s if s[:1] in ("=", "+", "-", "@", "\t", "\r") else s  # block spreadsheet formula injection


@router.get("/{survey_id}/export.csv")
def export_csv(survey_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    s = _owned(db, user, survey_id)
    qtext = {q.id: q.text for q in s.questions}
    rows = db.execute(
        select(Answer, Response.created_at)
        .join(Response, Answer.response_id == Response.id)
        .where(Response.survey_id == s.id)
        .order_by(Response.id, Answer.id)
    ).all()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["response_id", "submitted_at", "question", "answer", "input_type", "sentiment", "sentiment_score", "keywords"])
    for a, created in rows:
        w.writerow([a.response_id, created.isoformat(), _safe_cell(qtext.get(a.question_id, "")), _safe_cell(a.transcript),
                    a.input_type, a.sentiment, a.sentiment_score, _safe_cell(", ".join(a.keywords))])
    return HttpResponse(buf.getvalue(), media_type="text/csv",
                        headers={"Content-Disposition": f'attachment; filename="survey-{s.id}-responses.csv"'})
