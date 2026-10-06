"""Optional server-side speech-to-text. The default engine is the respondent's browser (Web Speech API),
so no audio reaches this server. Set STT_ENGINE=whisper and `pip install faster-whisper` to transcribe here."""
import io
import logging
from threading import Lock

from app.core.config import settings

log = logging.getLogger("voicesurvey.stt")
_model = None
_lock = Lock()


def server_transcription_enabled() -> bool:
    return settings.stt_engine == "whisper"


def transcribe_wav(data: bytes) -> dict:
    global _model
    with _lock:
        if _model is None:
            from faster_whisper import WhisperModel  # lazy: heavy optional dependency

            _model = WhisperModel(settings.whisper_model, compute_type="int8")
    segments, info = _model.transcribe(io.BytesIO(data), vad_filter=True)
    text = " ".join(s.text.strip() for s in segments).strip()
    return {"transcript": text, "language": info.language}
