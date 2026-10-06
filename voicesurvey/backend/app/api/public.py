import logging

from fastapi import APIRouter, Depends, File, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import AppError
from app.core.ratelimit import RateLimiter
from app.database.session import get_db
from app.models import Answer, Response, Survey
from app.schemas import ResponseIn, ok
from app.services.stt import server_transcription_enabled, transcribe_wav
from app.services.survey_nlp import analyze_answer

router = APIRouter(prefix="/api/public", tags=["public"])
log = logging.getLogger("voicesurvey.public")
submit_limiter = RateLimiter(limit=20, window_seconds=60)
transcribe_limiter = RateLimiter(limit=10, window_seconds=60)


def _client(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _open_survey(db: Session, slug: str) -> Survey:
    s = db.scalar(select(Survey).where(Survey.slug == slug))
    if not s:
        raise AppError("NOT_FOUND", "This survey does not exist.", 404)
    if not s.is_open:
        raise AppError("SURVEY_CLOSED", "This survey is no longer accepting responses.", 403)
    return s


@router.get("/surveys/{slug}")
def view_survey(slug: str, db: Session = Depends(get_db)):
    s = _open_survey(db, slug)
    return ok({
        "title": s.title, "description": s.description,
        "questions": [{"id": q.id, "text": q.text} for q in s.questions],
        "server_transcription": server_transcription_enabled(),
    })


@router.post("/surveys/{slug}/responses", status_code=201)
def submit(slug: str, body: ResponseIn, request: Request, db: Session = Depends(get_db)):
    submit_limiter.check(_client(request))
    s = _open_survey(db, slug)
    valid = {q.id for q in s.questions}
    ids = [a.question_id for a in body.answers]
    if len(set(ids)) != len(ids) or not set(ids) <= valid:
        raise AppError("INVALID_INPUT", "Answers must match this survey's questions, once each.", 422)
    resp = Response(survey_id=s.id)
    for a in body.answers:
        text = a.transcript.strip()
        if not text:
            raise AppError("INVALID_INPUT", "Answers can't be empty.", 422)
        resp.answers.append(Answer(question_id=a.question_id, transcript=text, input_type=a.input_type, **analyze_answer(text)))
    db.add(resp)
    db.commit()
    return ok(None, "Thank you! Your response was recorded.")


@router.post("/transcribe")
def transcribe(request: Request, file: UploadFile = File(...)):
    if not server_transcription_enabled():
        raise AppError("NOT_AVAILABLE", "Server transcription is not enabled.", 501)
    transcribe_limiter.check(_client(request))
    data = file.file.read(settings.max_audio_bytes + 1)
    if len(data) > settings.max_audio_bytes:
        raise AppError("FILE_TOO_LARGE", "That audio file is too large.", 413)
    if data[:4] != b"RIFF" or data[8:12] != b"WAVE":
        raise AppError("INVALID_AUDIO", "Please send a WAV file.", 415)
    try:
        result = transcribe_wav(data)
    except ImportError:
        raise AppError("NOT_AVAILABLE", "Server transcription is not installed.", 501)
    except Exception:
        log.exception("Transcription failed")
        raise AppError("TRANSCRIPTION_FAILED", "We couldn't transcribe that audio. Please type your answer instead.", 422)
    if not result["transcript"]:
        raise AppError("NO_SPEECH", "No speech was detected. Please try again.", 422)
    return ok(result, "Transcribed")
