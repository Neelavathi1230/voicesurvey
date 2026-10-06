import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import VoiceAnswer from "../components/VoiceAnswer";
import { api, ApiError } from "../services/api";
import type { PublicSurvey } from "../types";

type Answers = Record<number, { text: string; voice: boolean }>;

export default function RespondPage() {
  const { slug = "" } = useParams();
  const [survey, setSurvey] = useState<PublicSurvey | null>(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState(-1); // -1 intro, 0..n-1 questions, n done
  const [answers, setAnswers] = useState<Answers>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.publicSurvey(slug).then(setSurvey).catch((e) => setError(e instanceof ApiError ? e.message : "Could not load this survey."));
  }, [slug]);

  if (error) return <Shell><p role="alert" className="text-coral">{error}</p></Shell>;
  if (!survey) return <Shell><p>Loading…</p></Shell>;

  const n = survey.questions.length;
  const q = survey.questions[step];
  const current = q ? answers[q.id] ?? { text: "", voice: false } : null;

  async function submit() {
    const payload = survey!.questions
      .filter((x) => answers[x.id]?.text.trim())
      .map((x) => ({ question_id: x.id, transcript: answers[x.id].text.trim(), input_type: (answers[x.id].voice ? "voice" : "text") as "voice" | "text" }));
    if (payload.length === 0) { setError("Please answer at least one question."); return; }
    setBusy(true); setError("");
    try { await api.submitResponse(slug, payload); setStep(n); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Could not submit. Please try again."); }
    finally { setBusy(false); }
  }

  return (
    <Shell>
      {step === -1 && (
        <div className="space-y-4">
          <h1 className="font-display text-3xl font-bold">{survey.title}</h1>
          {survey.description && <p>{survey.description}</p>}
          <p className="rounded-lg bg-white p-3 text-sm text-ink/70">
            {n} question{n > 1 ? "s" : ""}. Answer by speaking or typing. Your answers are anonymous and only the text is saved, not your voice.
            Spoken answers are converted to text by your browser's speech service{survey.server_transcription ? " or by this site's server" : ""}, which may send audio to that service.
          </p>
          <button onClick={() => setStep(0)} className="rounded-lg bg-spruce px-6 py-3 font-medium text-mist">Start</button>
        </div>
      )}
      {q && current && (
        <div className="space-y-4">
          <p className="text-sm text-ink/60">Question {step + 1} of {n}</p>
          <div className="h-1.5 rounded-full bg-ink/10"><div className="h-full rounded-full bg-signal" style={{ width: `${((step + 1) / n) * 100}%` }} /></div>
          <h2 className="font-display text-2xl font-bold">{q.text}</h2>
          <VoiceAnswer key={q.id} value={current.text} serverTranscription={survey.server_transcription}
            onChange={(text, viaVoice) => setAnswers((a) => ({ ...a, [q.id]: { text, voice: viaVoice || a[q.id]?.voice || false } }))} />
          {error && <p role="alert" className="text-sm text-coral">{error}</p>}
          <div className="flex justify-between">
            <button onClick={() => setStep(step - 1)} disabled={step === 0} className="rounded-lg border border-ink/20 px-5 py-2.5 disabled:opacity-40">Back</button>
            {step < n - 1
              ? <button onClick={() => setStep(step + 1)} className="rounded-lg bg-spruce px-5 py-2.5 font-medium text-mist">{current.text.trim() ? "Next" : "Skip"}</button>
              : <button onClick={submit} disabled={busy} className="rounded-lg bg-signal px-5 py-2.5 font-medium text-ink disabled:opacity-50">{busy ? "Submitting…" : "Submit"}</button>}
          </div>
        </div>
      )}
      {step === n && (
        <div className="space-y-2 text-center">
          <h1 className="font-display text-3xl font-bold">Thank you!</h1>
          <p>Your response has been recorded.</p>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto min-h-screen max-w-xl p-6 pt-12">{children}</div>;
}
