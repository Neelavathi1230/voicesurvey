# VoiceSurvey – Spoken Survey Analyser

Create a survey, share a public link, and let people **answer out loud**. Spoken answers become text, are analysed,
and roll up into per-question results: sentiment, keywords, repeated phrases, and the most positive/negative quotes.
Owners sign in (bcrypt + JWT); respondents don't need an account and are anonymous. CSV export included.

## How it works
1. **Speech to text** (pluggable, `STT_ENGINE`):
   - `browser` (default): the respondent's browser transcribes with the Web Speech API (Chrome, Edge, Safari).
     No audio reaches this server, but **the browser vendor's speech service may receive it**. The respondent page says so.
   - `whisper`: for browsers without dictation. Install `faster-whisper`; the page records audio, converts it to WAV and
     the server transcribes it. Untested in this repo: try it on your machine before relying on it.
   - Respondents can always edit the transcript or type instead.
2. **Analysis per answer:** word-list sentiment (with negation), keywords, word count. Audio is never stored.
3. **Aggregation:** per-question sentiment split, top keywords, adjacent-word phrases repeated 2+ times, extreme quotes.

## Run
    cd backend && python -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt && cp .env.example .env      # set JWT_SECRET
    uvicorn app.main:app --reload --port 8000                    # docs at /docs
    cd ../frontend && npm install && npm run dev                 # http://localhost:5173
Microphone use needs `localhost` or HTTPS. Share link format: `http://localhost:5173/s/<slug>`.

## API
Owner (JWT): POST/GET /api/surveys, GET/PATCH/DELETE /api/surveys/{id}, GET /api/surveys/{id}/results, GET /api/surveys/{id}/export.csv
Public: GET /api/public/surveys/{slug}, POST /api/public/surveys/{slug}/responses, POST /api/public/transcribe (whisper only)
Auth: POST /api/auth/register, /api/auth/login, GET /api/auth/me

## Tests
    cd backend && pytest

## Limits
- Sentiment/keywords are a simple lexicon method, English only. Replace `app/services/nlp/analyzer.py` with a
  transformer model for better accuracy (same function contract).
- Public submissions are rate-limited per IP, in memory, per process. Behind a proxy, configure forwarded IPs or limit at the gateway.
- Results are computed in Python on each request: fine for thousands of answers, not millions.
- Not included: Docker, frontend tests, migrations, multiple-choice questions, respondent-level analytics.
